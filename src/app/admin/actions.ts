"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { createRefund, fetchOrderPayments } from "@/lib/razorpay/client";
import { applyPaymentEntity, applyRefundEntity } from "@/lib/payments/sync";
import { formatInr } from "@/lib/razorpay/money";
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
 * Set the hand-picked order verified mentors appear in, across every listing.
 *
 * Takes the full pinned list rather than one mentor's position, because a
 * position is only meaningful relative to the others: sending "put her at 2"
 * one row at a time is how two mentors end up both claiming slot 2. The whole
 * order arrives at once, gets written as 1..n, and every mentor left out is
 * unpinned in the same transaction — so what the admin sees on screen is
 * exactly what the database holds when this returns.
 *
 * Unpinned mentors aren't hidden; they simply fall back to the automatic
 * soonest-slot order below the pinned ones (see src/lib/mentors/list.ts).
 */
export async function setMentorDisplayOrder(orderedMentorIds: string[]) {
  await requireRole("ADMIN");

  const ids = [...new Set(orderedMentorIds)];
  if (ids.length !== orderedMentorIds.length) {
    throw new Error("A mentor can only appear once in the order");
  }

  const verifiedCount = await prisma.mentorProfile.count({
    where: { id: { in: ids }, verified: true },
  });
  if (verifiedCount !== ids.length) {
    throw new Error("Only verified mentors can be pinned");
  }

  await prisma.$transaction([
    // Clear first, so a mentor dragged out of the list doesn't keep a stale
    // position, and so no two rows briefly share one.
    prisma.mentorProfile.updateMany({
      where: { displayOrder: { not: null } },
      data: { displayOrder: null },
    }),
    ...ids.map((id, index) =>
      prisma.mentorProfile.update({ where: { id }, data: { displayOrder: index + 1 } })
    ),
  ]);

  // Every surface that renders a mentor listing.
  revalidatePath("/");
  revalidatePath("/mentors");
  revalidatePath("/admin/mentors");
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
