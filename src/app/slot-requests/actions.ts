"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const requestSchema = z.object({
  mentorId: z.string().min(1).nullable(),
  dayOfWeek: z.number().int().min(0).max(6).nullable(),
  source: z.enum(["mentor_profile", "mentor_list"]),
});

export type SlotRequestInput = z.infer<typeof requestSchema>;

/** Where to send the student back to after signing in, and what to refresh. */
function pathFor(input: SlotRequestInput) {
  return input.mentorId ? `/mentors/${input.mentorId}` : "/mentors";
}

/**
 * "Notify me when something opens up."
 *
 * Only records the request — nothing is sent yet (docs/slot-requests.md has
 * the plan for that). Idempotent per (student, mentor, day): a second click
 * leaves the one open row alone rather than counting the same student twice
 * on the admin demand page.
 */
export async function requestSlotAlert(raw: SlotRequestInput) {
  const input = requestSchema.parse(raw);
  const user = await requireUser(pathFor(input));

  if (input.mentorId) {
    const mentor = await prisma.mentorProfile.findUnique({
      where: { id: input.mentorId },
      select: { verified: true, userId: true },
    });
    // No waiting list for an unlisted mentor, or for yourself.
    if (!mentor?.verified || mentor.userId === user.id) throw new Error("Mentor not found");
  }

  const existing = await prisma.slotRequest.findFirst({
    where: { userId: user.id, mentorId: input.mentorId, dayOfWeek: input.dayOfWeek, status: "OPEN" },
    select: { id: true },
  });
  if (!existing) {
    await prisma.slotRequest.create({ data: { ...input, userId: user.id } });
  }

  revalidatePath(pathFor(input));
  revalidatePath("/admin/demand");
}

/** Withdraw an open request. Kept (as CANCELLED) so demand history survives. */
export async function cancelSlotAlert(raw: SlotRequestInput) {
  const input = requestSchema.parse(raw);
  const user = await requireUser(pathFor(input));

  await prisma.slotRequest.updateMany({
    where: { userId: user.id, mentorId: input.mentorId, dayOfWeek: input.dayOfWeek, status: "OPEN" },
    data: { status: "CANCELLED" },
  });

  revalidatePath(pathFor(input));
  revalidatePath("/admin/demand");
}
