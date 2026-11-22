"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/supabase";
import { mentorSubjects, mentorLanguages, examCredentials, sessionPricing } from "@/config/site";
import { minutesOfDay } from "@/lib/days";
import { expireStaleHolds, holdDeadline } from "@/lib/payments/sync";
import { busyIntervalsByMentor } from "@/lib/mentors/availability";
import { SESSION_LENGTHS, expandRule, isBusy, sessionStartsOf } from "@/lib/slots";
import { isValidPrice, mentorShare } from "@/lib/pricing";

// Everything here is required. A half-filled mentor profile converts nobody,
// and letting one through means an empty card sitting next to a complete one.
const applySchema = z.object({
  institute: z.string().min(2).max(120),
  rank: z.string().min(1).max(120),
  examCleared: z.enum(examCredentials as [string, ...string[]]),
  examYear: z.coerce.number().int().min(1990).max(new Date().getFullYear()),
  currentRole: z.string().min(2).max(120),
  languages: z.array(z.enum(mentorLanguages as unknown as [string, ...string[]])).min(1),
  story: z.string().min(60).max(400),
  subjects: z.array(z.enum(mentorSubjects.map((s) => s.slug) as [string, ...string[]])).min(1),
  upiId: z.string().min(3).max(80),
  bio: z.string().min(40).max(2000),
});

export async function applyAsMentor(formData: FormData) {
  const user = await requireUser();

  const existing = await prisma.mentorProfile.findUnique({ where: { userId: user.id } });
  if (existing) throw new Error("You've already applied");

  const parsed = applySchema.parse({
    institute: formData.get("institute"),
    rank: formData.get("rank"),
    examCleared: formData.get("examCleared"),
    examYear: formData.get("examYear"),
    currentRole: formData.get("currentRole"),
    languages: formData.getAll("languages"),
    story: formData.get("story"),
    subjects: formData.getAll("subjects"),
    upiId: formData.get("upiId"),
    bio: formData.get("bio"),
  });

  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    throw new Error("Proof document is required");
  }
  const proofUrl = await uploadFile(`mentor-proofs/${user.id}-${Date.now()}-${proof.name}`, proof);

  await prisma.$transaction([
    prisma.mentorProfile.create({
      // The rate comes from config, never from the form. Applicants don't set a
      // price (that unlocks after verification), so a `rate` in this payload
      // could only have been forged — a hidden input is editable by anyone with
      // devtools, and this one decides what a mentee is charged.
      data: { ...parsed, rate: sessionPricing.defaultPrice, userId: user.id, proofUrl },
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

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Most sessions one rule may produce in a day — a guard against a 00:00–23:59 typo. */
const MAX_SESSIONS_PER_DAY = 16;

const availabilitySchema = z
  .object({
    days: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Pick at least one day"),
    startTime: z.string().regex(HHMM),
    // Empty means "one session at startTime"; a value means "sessions back to back until then".
    endTime: z
      .string()
      .regex(HHMM)
      .nullable()
      .or(z.literal("").transform(() => null)),
    // Fixed choices: a session is at least what a mentee paid for, and odd
    // lengths make a range chop into odd times.
    duration: z.coerce
      .number()
      .int()
      .refine((d) => (SESSION_LENGTHS as readonly number[]).includes(d), "Pick a session length"),
  })
  .superRefine((rule, ctx) => {
    if (!rule.endTime) return;
    if (minutesOfDay(rule.endTime) - minutesOfDay(rule.startTime) < rule.duration) {
      ctx.addIssue({ code: "custom", message: "The range must fit at least one session" });
    } else if (sessionStartsOf(rule).length > MAX_SESSIONS_PER_DAY) {
      ctx.addIssue({ code: "custom", message: `That range is more than ${MAX_SESSIONS_PER_DAY} sessions a day` });
    }
  });

/**
 * Add a recurring availability rule: one or more weekdays, and either a single
 * session time or a time range that is split into back-to-back sessions.
 * It keeps producing bookable sessions every week until the mentor removes it.
 */
export async function addAvailability(formData: FormData) {
  const user = await requireUser();
  const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });

  const parsed = availabilitySchema.parse({
    days: [...new Set(formData.getAll("days"))],
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime") ?? null,
    duration: formData.get("duration"),
  });

  await prisma.availability.create({
    data: { ...parsed, days: [...new Set(parsed.days)].sort(), mentorId: profile.id },
  });
  revalidatePath("/mentor/dashboard");
  revalidatePath(`/mentors/${profile.id}`);
}

/**
 * Remove a rule. Bookings already made from it stand: those are dated, paid
 * sessions. A rule that bookings still point at is switched off rather than
 * deleted, so their history keeps its row.
 */
export async function removeAvailability(id: string) {
  const user = await requireUser();
  const profile = await prisma.mentorProfile.findUniqueOrThrow({ where: { userId: user.id } });

  const used = await prisma.booking.count({ where: { slotId: id } });
  if (used > 0) {
    await prisma.availability.updateMany({ where: { id, mentorId: profile.id }, data: { active: false } });
  } else {
    await prisma.availability.deleteMany({ where: { id, mentorId: profile.id } });
  }
  revalidatePath("/mentor/dashboard");
  revalidatePath(`/mentors/${profile.id}`);
}

/** Set the mentor's own session price. The platform cut follows from it (src/lib/pricing.ts). */
export async function updateRate(formData: FormData) {
  const user = await requireUser();
  const rate = Number(formData.get("rate"));
  if (!isValidPrice(rate)) {
    throw new Error(`Pick a whole-rupee price from ₹${sessionPricing.minPrice} to ₹${sessionPricing.maxPrice}`);
  }

  const profile = await prisma.mentorProfile.update({ where: { userId: user.id }, data: { rate }, select: { id: true } });
  revalidatePath("/mentor/dashboard");
  revalidatePath(`/mentors/${profile.id}`);
  revalidatePath("/mentors");
}

/**
 * Book one dated session of a mentor's recurring rule.
 *
 * `startsAtIso` comes from the page, so it is checked, not trusted: it must be
 * a session the rule really produces inside the booking window. Then, with the
 * mentor's row locked so two students cannot both pass the check at once, it
 * must not overlap any live booking.
 */
export async function bookSlot(mentorId: string, slotId: string, startsAtIso: string) {
  const user = await requireUser(`/mentors/${mentorId}`);

  // Put lapsed holds back on offer before checking what is free.
  await expireStaleHolds();

  const mentor = await prisma.mentorProfile.findUniqueOrThrow({ where: { id: mentorId } });
  if (!mentor.verified) throw new Error("This mentor isn't verified yet");
  if (mentor.userId === user.id) throw new Error("You can't book your own slot");

  const rule = await prisma.availability.findFirst({ where: { id: slotId, mentorId, active: true } });
  const startsAt = new Date(startsAtIso);
  const occurrence = rule
    ? expandRule(rule).find((o) => o.startsAt.getTime() === startsAt.getTime())
    : undefined;
  if (!rule || !occurrence) throw new Error("That time is no longer available — pick another one.");

  const booking = await prisma.$transaction(async (tx) => {
    // Serialise bookings per mentor: the overlap check below and the insert
    // after it must not interleave with another student's.
    await tx.$queryRaw`SELECT id FROM "MentorProfile" WHERE id = ${mentorId} FOR UPDATE`;

    const busy = await busyIntervalsByMentor([mentorId], new Date(), tx);
    if (isBusy(occurrence, busy.get(mentorId) ?? [])) {
      throw new Error("That time was just booked — pick another one.");
    }

    return tx.booking.create({
      data: {
        menteeId: user.id,
        mentorId,
        slotId,
        amount: mentor.rate,
        mentorPayout: mentorShare(mentor.rate),
        expiresAt: holdDeadline(),
        // The dated session, fixed here and never re-derived from the rule.
        scheduledStartAt: occurrence.startsAt,
        durationMinutes: occurrence.duration,
      },
    });
  });

  redirect(`/bookings/${booking.id}`);
}
