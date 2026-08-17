"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/supabase";
import { subjects } from "@/config/site";

const applySchema = z.object({
  institute: z.string().min(2).max(120),
  rank: z.string().max(120).optional(),
  subjects: z.array(z.enum(subjects.map((s) => s.slug) as [string, ...string[]])).min(1),
  rate: z.coerce.number().int().min(0).max(100000),
  upiId: z.string().min(3).max(80),
  bio: z.string().max(2000).optional(),
});

export async function applyAsMentor(formData: FormData) {
  const user = await requireUser();

  const existing = await prisma.mentorProfile.findUnique({ where: { userId: user.id } });
  if (existing) throw new Error("You've already applied");

  const parsed = applySchema.parse({
    institute: formData.get("institute"),
    rank: formData.get("rank") || undefined,
    subjects: formData.getAll("subjects"),
    rate: formData.get("rate"),
    upiId: formData.get("upiId"),
    bio: formData.get("bio") || undefined,
  });

  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Proof document is required");
  }
  const proofUrl = await uploadFile(`mentor-proofs/${user.id}-${Date.now()}-${proof.name}`, proof);

  await prisma.$transaction([
    prisma.mentorProfile.create({
      data: { ...parsed, userId: user.id, proofUrl },
    }),
    // USER -> MENTOR so they get dashboard access while awaiting verification.
    // Moderators/admins keep their higher-privilege role.
    prisma.user.updateMany({
      where: { id: user.id, role: "USER" },
      data: { role: "MENTOR" },
    }),
  ]);

  revalidatePath("/mentor/dashboard");
  redirect("/mentor/dashboard");
}

const availabilitySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  duration: z.coerce.number().int().min(15).max(180),
});

export async function addAvailability(formData: FormData) {
  const user = await requireUser();
  const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });

  const parsed = availabilitySchema.parse({
    dayOfWeek: formData.get("dayOfWeek"),
    startTime: formData.get("startTime"),
    duration: formData.get("duration"),
  });

  await prisma.availability.create({ data: { ...parsed, mentorId: profile.id } });
  revalidatePath("/mentor/dashboard");
}

export async function removeAvailability(id: string) {
  const user = await requireUser();
  const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });
  await prisma.availability.deleteMany({ where: { id, mentorId: profile.id, isBooked: false } });
  revalidatePath("/mentor/dashboard");
}

export async function bookSlot(mentorId: string, slotId: string) {
  const user = await requireUser();

  const mentor = await prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorId } });
  if (!mentor.verified) throw new Error("This mentor isn't verified yet");
  if (mentor.userId === user.id) throw new Error("You can't book your own slot");

  const booking = await prisma.$transaction(async (tx) => {
    const slot = await tx.availability.updateMany({
      where: { id: slotId, mentorId, isBooked: false },
      data: { isBooked: true },
    });
    if (slot.count === 0) throw new Error("That slot was just booked — pick another one.");

    return tx.booking.create({
      data: {
        menteeId: user.id,
        mentorId,
        slotId,
        amount: mentor.rate,
      },
    });
  });

  redirect(`/bookings/${booking.id}`);
}
