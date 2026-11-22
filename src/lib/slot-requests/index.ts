import "server-only";

import { prisma } from "@/lib/prisma";

/**
 * Identifies one kind of request: which mentor (or any) on which day (or any).
 * A student has at most one OPEN request per key — asking twice for the same
 * thing is the same signal, not twice the demand.
 */
export function slotRequestKey(mentorId: string | null, dayOfWeek: number | null) {
  return `${mentorId ?? "any"}:${dayOfWeek ?? "any"}`;
}

/** The keys of every open request this user has, for rendering "you're on the list". */
export async function openSlotRequestKeys(userId: string | undefined): Promise<string[]> {
  if (!userId) return [];
  const rows = await prisma.slotRequest.findMany({
    where: { userId, status: "OPEN" },
    select: { mentorId: true, dayOfWeek: true },
  });
  return rows.map((r) => slotRequestKey(r.mentorId, r.dayOfWeek));
}
