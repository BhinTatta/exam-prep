import "server-only";

import { prisma } from "@/lib/prisma";
import { jitsiRoomUrl } from "@/config/site";
import { decrementPaidSessions, incrementPaidSessions } from "@/lib/mentors/rollup";
import { planBookingNotifications } from "@/lib/notifications/enqueue";
import {
  capturePayment,
  createRefund,
  fetchOrderPayments,
  fetchPayment,
  type RazorpayPayment,
  type RazorpayRefund,
} from "@/lib/razorpay/client";
import type { BookingStatus, PaymentStatus } from "@prisma/client";

/**
 * The single writer of payment -> booking state.
 *
 * Four callers funnel through `applyPaymentEntity`: the browser callback after
 * Checkout closes, the Razorpay webhook, the admin "Sync" button, and the lazy
 * reconcile on the booking page. Keeping one implementation means they cannot
 * disagree, and every transition below is written to be idempotent (conditional
 * `updateMany` rather than `update`) so a replayed webhook is a no-op.
 */

/** How long a mentee has to pay before the slot is released. */
export const HOLD_MINUTES = 15;

export function holdDeadline(from: Date = new Date()): Date {
  return new Date(from.getTime() + HOLD_MINUTES * 60_000);
}

/** Booking states that still hold a claim on the mentor's slot. */
const SLOT_HOLDING_STATUSES: BookingStatus[] = [
  "PENDING_PAYMENT",
  "PAYMENT_PROCESSING",
  "CONFIRMED",
  "COMPLETED",
  "DISPUTED",
];

/** Booking states where money arriving means "too late, refund it". */
const DEAD_STATUSES: BookingStatus[] = ["EXPIRED", "CANCELLED", "REFUNDED"];

/**
 * Booking states a captured payment has already counted towards
 * MentorProfile.paidSessions. Reaching any of these means the increment below
 * has run, so a later refund has something to take back off.
 */
const COUNTED_PAID_STATUSES: BookingStatus[] = ["CONFIRMED", "COMPLETED", "DISPUTED"];

/**
 * Release a slot, unless another live booking has since claimed it.
 *
 * Availability rows are recurring weekly slots, so `isBooked` is a shared flag:
 * blindly clearing it could hand away a slot somebody else is now holding.
 */
async function releaseSlot(slotId: string, exceptBookingId: string): Promise<void> {
  const stillClaimed = await prisma.booking.count({
    where: {
      slotId,
      id: { not: exceptBookingId },
      status: { in: SLOT_HOLDING_STATUSES },
    },
  });
  if (stillClaimed === 0) {
    await prisma.availability.updateMany({
      where: { id: slotId },
      data: { isBooked: false },
    });
  }
}

function mapPaymentStatus(entity: RazorpayPayment): PaymentStatus {
  switch (entity.status) {
    case "captured":
      return "CAPTURED";
    case "authorized":
      return "AUTHORIZED";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return "CREATED";
  }
}

/**
 * Refund a payment that arrived for a booking we can no longer honour — a hold
 * that lapsed before the bank authorised (Razorpay calls this Late Auth), or a
 * second payment against a booking another payment already confirmed.
 */
async function refundUnfulfillable(
  entity: RazorpayPayment,
  paymentRowId: string,
  reason: string
): Promise<void> {
  // Razorpay's own view of what has been refunded, plus ours — either being
  // non-zero means a previous delivery of this event already refunded it.
  if (entity.amount_refunded > 0) return;
  const alreadyRefunded = await prisma.refund.count({ where: { paymentId: paymentRowId } });
  if (alreadyRefunded > 0) return;

  const refund = await createRefund(entity.id, {
    amount: entity.amount,
    notes: { reason },
  });
  await applyRefundEntity(refund, { reason });
}

/**
 * Capture an authorised payment, tolerating the usual race.
 *
 * Returns the captured entity when this call is what captured it, or null when
 * there is nothing further to apply. On failure we ask Razorpay for the
 * payment's real state rather than parsing the error text: automatic capture
 * beating us to it is the common case and is not a problem.
 */
async function captureAuthorized(entity: RazorpayPayment): Promise<RazorpayPayment | null> {
  try {
    return await capturePayment(entity.id, entity.amount, entity.currency);
  } catch (err) {
    const fresh = await fetchPayment(entity.id).catch(() => null);
    if (fresh?.status === "captured") return fresh;

    // Genuinely not captured. Deliberately not rethrown: that would make the
    // payment.authorized delivery retry hourly for a day. The payment.captured
    // webhook, or the admin's Sync button, is the path back from here, and the
    // booking sits visibly in PAYMENT_PROCESSING meanwhile.
    console.error("razorpay: could not capture an authorised payment", {
      paymentId: entity.id,
      orderId: entity.order_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Reconcile one Razorpay payment entity into our Payment + Booking rows.
 *
 * `entity` must come from Razorpay (a webhook payload or a Fetch Payment call),
 * never from the browser.
 */
export async function applyPaymentEntity(entity: RazorpayPayment): Promise<void> {
  if (!entity.order_id) {
    // Payments made without an order are auto-refunded by Razorpay and are not
    // something this app can create.
    console.warn("razorpay: payment with no order_id, ignoring", { paymentId: entity.id });
    return;
  }

  const payment = await prisma.payment.findUnique({
    where: { razorpayOrderId: entity.order_id },
    include: { booking: { select: { id: true, status: true, slotId: true, mentorId: true } } },
  });

  if (!payment) {
    // An order we did not create, or one whose row is gone. Deliberately NOT
    // auto-refunded: we cannot tell a lost row from another integration sharing
    // this Razorpay account, and the money is safely in the account for an
    // admin to refund by hand.
    console.error("razorpay: no Payment row for order — needs manual review", {
      orderId: entity.order_id,
      paymentId: entity.id,
    });
    return;
  }

  // The order amount is fixed when the order is created, so a mismatch means
  // something is badly wrong. Record it, but never fulfil on it.
  const amountMismatch = entity.amount !== payment.amount;
  if (amountMismatch) {
    console.error("razorpay: payment amount does not match our order", {
      orderId: entity.order_id,
      paymentId: entity.id,
      expected: payment.amount,
      received: entity.amount,
    });
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      razorpayPaymentId: entity.id,
      status: mapPaymentStatus(entity),
      method: entity.method ?? null,
      email: entity.email ?? null,
      contact: entity.contact ?? null,
      refundedAmount: entity.amount_refunded ?? 0,
      errorCode: entity.error_code ?? null,
      errorDescription: entity.error_description ?? null,
      ...(entity.status === "authorized" && !payment.authorizedAt
        ? { authorizedAt: new Date() }
        : {}),
      ...(entity.status === "captured" && !payment.capturedAt ? { capturedAt: new Date() } : {}),
      ...(entity.status === "failed" && !payment.failedAt ? { failedAt: new Date() } : {}),
    },
  });

  const booking = payment.booking;

  if (entity.status === "failed") {
    // Leave the booking in PENDING_PAYMENT so the mentee can retry against the
    // same order for whatever is left of the hold.
    return;
  }

  if (entity.status !== "authorized" && entity.status !== "captured") return;
  if (amountMismatch) return;

  // Has some *other* payment already paid for this booking? Comparing against
  // this row's own razorpayPaymentId would not catch it: on a second order the
  // column is still null at this point.
  const otherCaptured = await prisma.payment.count({
    where: {
      bookingId: booking.id,
      id: { not: payment.id },
      status: { in: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"] },
    },
  });

  const unfulfillable = DEAD_STATUSES.includes(booking.status) || otherCaptured > 0;

  if (unfulfillable) {
    // Only a captured payment can be refunded — refunding one that is merely
    // authorised errors at Razorpay. With capture: automatic the captured event
    // follows within seconds, and it refunds then.
    if (entity.status === "captured") {
      await refundUnfulfillable(
        entity,
        payment.id,
        otherCaptured > 0 ? "duplicate_payment" : `booking_${booking.status.toLowerCase()}`
      );
    }
    return;
  }

  if (entity.status === "authorized") {
    await prisma.booking.updateMany({
      where: { id: booking.id, status: "PENDING_PAYMENT" },
      data: { status: "PAYMENT_PROCESSING" },
    });

    // Razorpay auto-refunds an authorised payment that is never captured, so
    // the booking would be paid for, never fulfilled, and then silently
    // reversed. The Dashboard's automatic capture normally gets there first and
    // this is a no-op; it is here so correctness does not depend on a setting
    // outside the codebase.
    const captured = await captureAuthorized(entity);
    if (captured) await applyPaymentEntity(captured);
    return;
  }

  // Captured — the only state where it is safe to hand over the session.
  const confirmed = await prisma.booking.updateMany({
    where: { id: booking.id, status: { in: ["PENDING_PAYMENT", "PAYMENT_PROCESSING"] } },
    data: {
      status: "CONFIRMED",
      meetLink: jitsiRoomUrl(booking.mentorId.slice(0, 8), booking.id),
      expiresAt: null,
    },
  });

  // This is where a paid session starts counting towards the mentor's public
  // session count. It hangs off `confirmed.count` rather than off reaching this
  // line, because the updateMany above is conditional: a webhook Razorpay
  // delivers three times moves the booking once and so counts once.
  if (confirmed.count > 0) {
    await incrementPaidSessions(prisma, booking.mentorId);

    // Tell both sides that this is happening.
    //
    // Wrapped, and deliberately so: the money has moved and the session is real
    // whether or not an email ever goes out, so notifications get no veto over
    // payment processing. Nothing below this line may throw upwards, fail a
    // capture, or roll anything back.
    //
    // That is safe rather than lossy because the outbox is repaired on every
    // cron tick — planMissingNotifications() re-queues any confirmed booking
    // that ended up with no rows, so losing this call delays the email, it does
    // not drop it.
    try {
      await planBookingNotifications(booking.id);
    } catch (error) {
      console.error("notifications: could not queue for a confirmed booking", {
        bookingId: booking.id,
        error,
      });
    }
  }
}

/** Reconcile a refund entity into our Refund + Payment + Booking rows. */
export async function applyRefundEntity(
  entity: RazorpayRefund,
  opts?: { initiatedBy?: string; reason?: string }
): Promise<void> {
  const payment = await prisma.payment.findUnique({
    where: { razorpayPaymentId: entity.payment_id },
    include: { booking: { select: { id: true, status: true, slotId: true, mentorId: true } } },
  });

  if (!payment) {
    console.error("razorpay: refund for an unknown payment", {
      refundId: entity.id,
      paymentId: entity.payment_id,
    });
    return;
  }

  await prisma.refund.upsert({
    where: { razorpayRefundId: entity.id },
    create: {
      paymentId: payment.id,
      razorpayRefundId: entity.id,
      amount: entity.amount,
      status: entity.status,
      reason: opts?.reason ?? null,
      initiatedBy: opts?.initiatedBy ?? null,
    },
    update: { status: entity.status },
  });

  // A failed refund never returned the money, so it must not count towards the
  // refunded total. Razorpay's `refund.failed` needs a human either way.
  const settled = await prisma.refund.findMany({
    where: { paymentId: payment.id, status: { not: "failed" } },
    select: { amount: true },
  });
  const refundedAmount = settled.reduce((sum, r) => sum + r.amount, 0);

  const paymentStatus: PaymentStatus =
    refundedAmount >= payment.amount
      ? "REFUNDED"
      : refundedAmount > 0
        ? "PARTIALLY_REFUNDED"
        : payment.status;

  await prisma.payment.update({
    where: { id: payment.id },
    data: { refundedAmount, status: paymentStatus },
  });

  if (refundedAmount < payment.amount) return;

  // Fully refunded. A session that already happened stays COMPLETED — the money
  // went back, but the history should not claim the session never occurred.
  const moved = await prisma.booking.updateMany({
    where: {
      id: payment.booking.id,
      status: { in: ["PENDING_PAYMENT", "PAYMENT_PROCESSING", "CONFIRMED", "DISPUTED"] },
    },
    data: { status: "REFUNDED", expiresAt: null },
  });

  if (moved.count > 0) {
    await releaseSlot(payment.booking.slotId, payment.booking.id);

    // Take the session back off the mentor's count, but only if it was ever on
    // it. CONFIRMED and DISPUTED are the two states above that a capture can
    // have counted; a booking refunded straight out of PENDING_PAYMENT or
    // PAYMENT_PROCESSING was never counted and must not go negative.
    if (COUNTED_PAID_STATUSES.includes(payment.booking.status)) {
      await decrementPaidSessions(prisma, payment.booking.mentorId);
    }
  }
}

/**
 * Release slots held by bookings whose payment window has lapsed.
 *
 * Called lazily from the pages that read slot availability — this repo has no
 * scheduler, and adding one would mean a platform-specific cron. Backed by the
 * [status, expiresAt] index, and bounded so one unlucky request never does
 * unbounded work.
 */
export async function expireStaleHolds(): Promise<number> {
  const stale = await prisma.booking.findMany({
    where: {
      status: "PENDING_PAYMENT",
      expiresAt: { lt: new Date() },
      // Never expire a booking whose money is already in flight: a slow UPI
      // payer must not lose the slot out from under their own payment.
      payments: { none: { status: { in: ["AUTHORIZED", "CAPTURED"] } } },
    },
    select: { id: true, slotId: true },
    take: 100,
  });

  if (stale.length === 0) return 0;

  const ids = stale.map((b) => b.id);
  const expired = await prisma.booking.updateMany({
    where: { id: { in: ids }, status: "PENDING_PAYMENT" },
    data: { status: "EXPIRED" },
  });

  for (const booking of stale) {
    await releaseSlot(booking.slotId, booking.id);
  }

  return expired.count;
}

/**
 * Fallback for a webhook that never arrived: ask Razorpay what actually
 * happened to this booking's latest order and apply it.
 *
 * Safe to call on a page render — it no-ops unless there is an order worth
 * asking about.
 */
export async function reconcileBookingPayments(bookingId: string): Promise<void> {
  const payment = await prisma.payment.findFirst({
    where: { bookingId, status: { in: ["CREATED", "AUTHORIZED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!payment) return;

  // Nothing to reconcile in the first minute — Checkout has not finished and
  // the webhook has not had a chance to land.
  if (Date.now() - payment.createdAt.getTime() < 60_000) return;

  try {
    const attempts = await fetchOrderPayments(payment.razorpayOrderId);
    for (const entity of attempts) {
      await applyPaymentEntity(entity);
    }
  } catch (err) {
    // Never break the page over a reconcile; the webhook is the primary path.
    console.error("razorpay: reconcile failed", {
      bookingId,
      orderId: payment.razorpayOrderId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Release a slot from a booking the mentee or an admin cancelled. */
export async function releaseBookingSlot(bookingId: string, slotId: string): Promise<void> {
  await releaseSlot(slotId, bookingId);
}
