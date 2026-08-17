"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { jitsiRoomUrl } from "@/config/site";
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

export async function confirmPayment(bookingId: string, approve: boolean) {
  const admin = await requireRole("ADMIN");

  const booking = await prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { mentor: true } });
  if (booking.status !== "PAYMENT_SUBMITTED") throw new Error("Nothing to confirm for this booking");

  if (approve) {
    await prisma.booking.update({
      where: { id: bookingId },
      data: {
        status: "CONFIRMED",
        paymentVerifiedBy: admin.id,
        paymentVerifiedAt: new Date(),
        meetLink: jitsiRoomUrl(booking.mentor.id.slice(0, 8), booking.id),
      },
    });
  } else {
    await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: "CANCELLED" } }),
      prisma.availability.update({ where: { id: booking.slotId }, data: { isBooked: false } }),
    ]);
  }

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
