"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { siteConfig } from "@/config/site";
import { createOrder, fetchPayment } from "@/lib/razorpay/client";
import { razorpayCredentials } from "@/lib/razorpay/config";
import { verifyPaymentSignature } from "@/lib/razorpay/signature";
import { assertPayableAmount, toPaise } from "@/lib/razorpay/money";
import { applyPaymentEntity, expireStaleHolds, releaseBookingSlot } from "@/lib/payments/sync";

async function requireOwnBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.menteeId !== userId) throw new Error("Not your booking");
  return booking;
}

export type CheckoutOrder = {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string };
};

/**
 * Create (or reuse) the Razorpay order for a booking and hand Checkout what it
 * needs to open.
 *
 * The amount is read from the booking row, which was locked to the mentor's
 * rate when the slot was taken. Nothing about the price comes from the client.
 */
export async function createPaymentOrder(bookingId: string): Promise<CheckoutOrder> {
  const user = await requireUser();

  // Sweep first, so a mentee who sat on the page past the deadline gets a clear
  // "expired" error rather than paying for a slot we are about to release.
  await expireStaleHolds();

  const booking = await prisma.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { mentor: { include: { user: { select: { name: true } } } } },
  });
  if (booking.menteeId !== user.id) throw new Error("Not your booking");
  if (booking.status !== "PENDING_PAYMENT") {
    throw new Error("This booking isn't awaiting payment");
  }
  if (booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
    throw new Error("This booking's payment window has closed — please book the slot again.");
  }

  const amount = toPaise(booking.amount);
  assertPayableAmount(amount);

  const { keyId } = razorpayCredentials();

  // Razorpay lets a customer retry against the same order (a declined card then
  // UPI, say), so reuse the open one rather than creating a fresh order per click.
  const existing = await prisma.payment.findFirst({
    where: { bookingId, status: "CREATED", amount },
    orderBy: { createdAt: "desc" },
  });

  let orderId = existing?.razorpayOrderId;

  if (!orderId) {
    const receipt = `bk_${booking.id}`.slice(0, 40);
    const order = await createOrder({
      amount,
      currency: "INR",
      receipt,
      notes: {
        bookingId: booking.id,
        menteeId: booking.menteeId,
        mentorId: booking.mentorId,
      },
    });

    await prisma.payment.create({
      data: {
        bookingId: booking.id,
        razorpayOrderId: order.id,
        receipt,
        amount,
        currency: order.currency,
      },
    });
    orderId = order.id;
  }

  return {
    keyId,
    orderId,
    amount,
    currency: "INR",
    name: siteConfig.name,
    description: `Mentoring session with ${booking.mentor.user.name ?? "your mentor"}`,
    prefill: {
      name: user.name ?? "",
      email: user.email ?? "",
    },
  };
}

const verifySchema = z.object({
  razorpayOrderId: z.string().min(1).max(255),
  razorpayPaymentId: z.string().min(1).max(255),
  razorpaySignature: z.string().min(1).max(255),
});

/**
 * Verify the signature Checkout handed the browser, then reconcile the payment.
 *
 * Two things make this safe: the order id used for the HMAC is read from our
 * own database, and the payment's real status is fetched from Razorpay rather
 * than taken from the browser's word for it.
 */
export async function verifyPayment(input: z.infer<typeof verifySchema>): Promise<void> {
  const user = await requireUser();
  const parsed = verifySchema.parse(input);

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: parsed.razorpayOrderId },
    include: { booking: { select: { id: true, menteeId: true } } },
  });
  if (!payment) throw new Error("We couldn't find that payment");
  if (payment.booking.menteeId !== user.id) throw new Error("Not your booking");

  const valid = verifyPaymentSignature(
    payment.razorpayOrderId, // from OUR database, never the request body
    parsed.razorpayPaymentId,
    parsed.razorpaySignature
  );
  if (!valid) {
    console.error("razorpay: signature verification failed", {
      orderId: payment.razorpayOrderId,
      paymentId: parsed.razorpayPaymentId,
      bookingId: payment.booking.id,
    });
    throw new Error("We couldn't verify that payment. Please contact support.");
  }

  const entity = await fetchPayment(parsed.razorpayPaymentId);
  if (entity.order_id !== payment.razorpayOrderId) {
    throw new Error("We couldn't verify that payment. Please contact support.");
  }

  await applyPaymentEntity(entity);

  revalidatePath(`/bookings/${payment.booking.id}`);
  revalidatePath("/bookings");
}

const failureSchema = z.object({
  razorpayOrderId: z.string().min(1).max(255),
  code: z.string().max(255).optional(),
  description: z.string().max(1000).optional(),
});

/**
 * Record a failure reported by Checkout's `payment.failed` event, so the mentee
 * sees why it failed without waiting on the webhook. Best-effort only — the
 * webhook remains the source of truth.
 */
export async function recordPaymentFailure(input: z.infer<typeof failureSchema>): Promise<void> {
  const user = await requireUser();
  const parsed = failureSchema.parse(input);

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: parsed.razorpayOrderId },
    include: { booking: { select: { menteeId: true } } },
  });
  if (!payment || payment.booking.menteeId !== user.id) return;
  if (payment.status !== "CREATED") return; // never overwrite a real outcome

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      errorCode: parsed.code ?? null,
      errorDescription: parsed.description ?? null,
    },
  });
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await requireOwnBooking(bookingId, user.id);

  // Once money is in flight, cancelling is a refund decision and refunds are
  // admin-only — the mentee asks via requestCancellation() instead.
  if (booking.status !== "PENDING_PAYMENT") {
    throw new Error("This booking can no longer be cancelled on your own");
  }

  await prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } });
  await releaseBookingSlot(bookingId, booking.slotId);

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/bookings");
  revalidatePath("/mentor/dashboard");
}

const cancellationSchema = z.object({
  reason: z.string().trim().min(5).max(1000),
});

/** Flag a paid booking for admin review. Does not move any money. */
export async function requestCancellation(bookingId: string, formData: FormData) {
  const user = await requireUser();
  const booking = await requireOwnBooking(bookingId, user.id);

  if (!["PAYMENT_PROCESSING", "CONFIRMED"].includes(booking.status)) {
    throw new Error("There's nothing to cancel on this booking");
  }
  if (booking.cancellationRequestedAt) {
    throw new Error("You've already requested a cancellation for this booking");
  }

  const { reason } = cancellationSchema.parse({ reason: formData.get("reason") });

  await prisma.booking.update({
    where: { id: bookingId },
    data: { cancellationRequestedAt: new Date(), cancellationReason: reason },
  });

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/admin/payments");
}

export async function confirmHappened(bookingId: string, happened: boolean) {
  const user = await requireUser();
  const booking = await requireOwnBooking(bookingId, user.id);
  if (booking.status !== "CONFIRMED") throw new Error("This session hasn't been confirmed yet");

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      menteeConfirmedHappened: happened,
      status: happened ? "COMPLETED" : "DISPUTED",
    },
  });

  revalidatePath(`/bookings/${bookingId}`);
}
