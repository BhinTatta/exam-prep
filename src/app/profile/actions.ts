"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AcademicStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { uploadFile } from "@/lib/supabase";
import { MAX_AVATAR_UPLOAD_BYTES } from "@/lib/image";

const ALLOWED_AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const profileSchema = z.object({
  name: z.string().min(2).max(80),
  bio: z.string().max(1000).optional(),
  collegeName: z.string().max(160).optional(),
  academicStatus: z.nativeEnum(AcademicStatus).optional(),
});

export async function updateProfile(formData: FormData) {
  const user = await requireUser();

  const parsed = profileSchema.parse({
    name: formData.get("name"),
    bio: formData.get("bio") || undefined,
    collegeName: formData.get("collegeName") || undefined,
    academicStatus: formData.get("academicStatus") || undefined,
  });

  let image: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    // The client always crops + downscales before uploading; this is just the backstop.
    if (avatar.size > MAX_AVATAR_UPLOAD_BYTES) {
      throw new Error("Profile picture is too large — try again with a smaller image.");
    }
    if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
      throw new Error("Profile picture must be a JPEG, PNG, or WebP image.");
    }
    image = await uploadFile(`avatars/${user.id}-${Date.now()}.jpg`, avatar);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ...parsed, ...(image ? { image } : {}) },
  });

  revalidatePath("/profile");
}
