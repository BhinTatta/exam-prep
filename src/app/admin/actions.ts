"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { createRefund, fetchOrderPayments } from "@/lib/razorpay/client";
import { applyPaymentEntity, applyRefundEntity } from "@/lib/payments/sync";
import { formatInr } from "@/lib/razorpay/money";
import { revalidateMentorPages } from "@/lib/cache";
import type { Role } from "@prisma/client";

export async function verifyMentor(mentorProfileId: string, approve: boolean) {
  const admin = await requireRole("ADMIN");

  if (approve) {
    await prisma.mentorProfile.update({
      where: { id: mentorProfileId },
      data: { verified: true, verifiedBy: admin.id, verifiedAt: new Date() },
    });
  } else {
    const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorProfileId } });
    await prisma.$transaction([
      prisma.mentorProfile.delete({ where: { id: mentorProfileId } }),
      prisma.user.updateMany({ where: { id: profile.userId, role: "MENTOR" }, data: { role: "USER" } }),
    ]);
  }

  revalidatePath("/admin/mentors");
  revalidatePath("/admin");
}

/**
 * Pin a mentor to the home page, or unpin them.
 *
 * `rank` is an ordering, not a flag: the home page shows three cards and which
 * one leads is a marketing decision. null clears the pin and drops the mentor
 * back into the weighted-rating order with everyone else.
 *
 * This is the one mentor change the home page is not allowed to discover an
 * hour late. Ratings and session counts can ride the ISR timer — an admin who
 * pins someone for a campaign is watching the page, so bust the cached copy
 * here. src/lib/cache.ts documents what that costs (one visitor pays for one
 * re-render).
 */
export async function setFeaturedRank(mentorProfileId: string, rank: number | null) {
  await requireRole("ADMIN");

  if (rank !== null && (!Number.isInteger(rank) || rank < 1 || rank > 99)) {
    throw new Error("Featured rank must be a whole number between 1 and 99");
  }

  await prisma.mentorProfile.update({
    where: { id: mentorProfileId },
    data: { featuredRank: rank },
  });

  revalidatePath("/admin/mentors");
  revalidateMentorPages();
}

/**
 * Refund a captured payment, in full or in part.
 *
 * Refunds are admin-only by design: a mentee who has already paid files a
 * cancellation request (see requestCancellation in app/bookings/actions.ts) and
 * an admin decides. The booking moves to REFUNDED and the slot is released once
 * the refund covers the whole payment — that bookkeeping lives in
 * applyRefundEntity so the webhook and this action agree.
 */
export async function refundPayment(paymentId: string, amountPaise: number, reason?: string) {
  const admin = await requireRole("ADMIN");

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (!payment.razorpayPaymentId) throw new Error("This payment was never completed");
  if (payment.status !== "CAPTURED" && payment.status !== "PARTIALLY_REFUNDED") {
    throw new Error("Only a captured payment can be refunded");
  }

  const refundable = payment.amount - payment.refundedAmount;
  if (refundable <= 0) throw new Error("This payment has already been fully refunded");

  const amount = Math.round(amountPaise);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a refund amount");
  if (amount > refundable) {
    throw new Error(`You can refund at most ${formatInr(refundable)} on this payment`);
  }

  const refund = await createRefund(payment.razorpayPaymentId, {
    amount,
    notes: { bookingId: payment.bookingId, refundedBy: admin.id },
  });

  await applyRefundEntity(refund, { initiatedBy: admin.id, reason });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath(`/bookings/${payment.bookingId}`);
}

/**
 * Pull this payment's current state from Razorpay and re-apply it. The manual
 * escape hatch for a webhook that never arrived.
 */
export async function syncPaymentFromRazorpay(paymentId: string) {
  await requireRole("ADMIN");

  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });

  const attempts = await fetchOrderPayments(payment.razorpayOrderId);
  for (const entity of attempts) {
    await applyPaymentEntity(entity);
  }

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${paymentId}`);
  revalidatePath(`/bookings/${payment.bookingId}`);
}

/** Dismiss a mentee's cancellation request without refunding. */
export async function dismissCancellationRequest(bookingId: string) {
  await requireRole("ADMIN");

  await prisma.booking.update({
    where: { id: bookingId },
    data: { cancellationRequestedAt: null, cancellationReason: null },
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/bookings/${bookingId}`);
}

export async function markPayoutPaid(bookingId: string, amount: number, notes?: string) {
  const admin = await requireRole("ADMIN");

  await prisma.payout.upsert({
    where: { bookingId },
    create: { bookingId, amount, paidByAdmin: admin.id, paidAt: new Date(), notes },
    update: { paidAt: new Date(), notes },
  });

  revalidatePath("/admin/sessions");
}

export async function promoteUser(userId: string, role: Role) {
  await requireRole("ADMIN");
  await prisma.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/admin/users");
}
