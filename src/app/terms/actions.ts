"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

export async function acceptTerms() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { termsAcceptedAt: new Date() },
  });
  revalidatePath("/", "layout");
}
