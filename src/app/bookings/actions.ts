"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/supabase";

async function requireOwnBooking(bookingId: string, userId: string) {
  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
  if (booking.menteeId !== userId) throw new Error("Not your booking");
  return booking;
}

export async function submitPayment(bookingId: string, formData: FormData) {
  const user = await requireUser();
  const booking = await requireOwnBooking(bookingId, user.id);
  if (booking.status !== "PENDING_PAYMENT") throw new Error("This booking isn't awaiting payment");

  const utrReference = String(formData.get("utrReference") ?? "").trim();
  if (!utrReference) throw new Error("UTR / transaction reference is required");

  let paymentProofUrl: string | undefined;
  const screenshot = formData.get("screenshot");
  if (screenshot instanceof File && screenshot.size > 0) {
    paymentProofUrl = await uploadFile(`payment-proofs/${bookingId}-${Date.now()}-${screenshot.name}`, screenshot);
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { utrReference, paymentProofUrl, status: "PAYMENT_SUBMITTED" },
  });

  revalidatePath(`/bookings/${bookingId}`);
}

export async function cancelBooking(bookingId: string) {
  const user = await requireUser();
  const booking = await requireOwnBooking(bookingId, user.id);
  if (!["PENDING_PAYMENT", "PAYMENT_SUBMITTED"].includes(booking.status)) {
    throw new Error("This booking can no longer be cancelled");
  }

  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
    prisma.availability.update({ where: { id: booking.slotId }, data: { isBooked: false } }),
  ]);

  revalidatePath(`/bookings/${bookingId}`);
  revalidatePath("/mentor/dashboard");
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
