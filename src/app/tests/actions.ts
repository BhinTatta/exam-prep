"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function startAttempt(
  testId: string,
  utm?: { source?: string; medium?: string; campaign?: string }
) {
  const session = await auth();

  const attempt = await prisma.assessmentAttempt.create({
    data: {
      testId,
      userId: session?.user?.id ?? null,
      utmSource: utm?.source,
      utmMedium: utm?.medium,
      utmCampaign: utm?.campaign,
    },
  });

  return attempt.id;
}
