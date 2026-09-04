"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileInput } from "@/components/ui/file-input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AvatarCropDialog } from "@/components/profile/avatar-crop-dialog";
import { updateProfile } from "@/app/profile/actions";
import { academicStatusOptions } from "@/lib/academic-status";
import { MAX_AVATAR_SOURCE_BYTES } from "@/lib/image";
import type { AcademicStatus } from "@prisma/client";

export function ProfileForm({
  name,
  bio,
  image,
  collegeName,
  academicStatus,
}: {
  name: string | null;
  bio: string | null;
  image: string | null;
  collegeName: string | null;
  academicStatus: AcademicStatus | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(image);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  // Bumped after every crop to remount the file input, clearing its value so
  // the original uncropped file can never end up in the form submission.
  const [fileInputKey, setFileInputKey] = useState(0);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_AVATAR_SOURCE_BYTES) {
      toast.error("That image is too large — pick one under 20MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result as string);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function onCropped(blob: Blob) {
    setAvatarBlob(blob);
    setPreview(URL.createObjectURL(blob));
    setFileInputKey((k) => k + 1);
  }

  function onSubmit(formData: FormData) {
    if (avatarBlob) {
      formData.set("avatar", new File([avatarBlob], "avatar.jpg", { type: "image/jpeg" }));
    }
    startTransition(async () => {
      try {
        await updateProfile(formData);
        toast.success("Profile updated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't update profile");
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Avatar className="size-16">
          <AvatarImage src={preview ?? undefined} alt={name ?? "User"} />
          <AvatarFallback className="text-lg">{(name ?? "U").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="grid flex-1 gap-2">
          <Label htmlFor="avatar-source">Profile picture</Label>
          <FileInput
            key={fileInputKey}
            id="avatar-source"
            accept="image/*"
            onChange={onFileChange}
          />
          <p className="text-xs text-muted-foreground">
            You&apos;ll be able to crop it next. JPEG, PNG or WebP, up to 20MB.
          </p>
        </div>
      </div>

      <AvatarCropDialog
        imageSrc={cropSrc}
        open={cropOpen}
        onOpenChange={setCropOpen}
        onCropped={onCropped}
      />

      <div className="grid gap-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={name ?? ""} required maxLength={80} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
        <div className="grid gap-2">
          <Label htmlFor="collegeName">College / institute</Label>
          <Input
            id="collegeName"
            name="collegeName"
            defaultValue={collegeName ?? ""}
            placeholder="e.g. Delhi University"
            maxLength={160}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="academicStatus">Current status</Label>
          <Select name="academicStatus" defaultValue={academicStatus ?? undefined}>
            <SelectTrigger id="academicStatus" className="w-full">
              <SelectValue placeholder="Select one" />
            </SelectTrigger>
            <SelectContent>
              {academicStatusOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="bio">Bio</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={bio ?? ""}
          placeholder="A couple of lines about yourself."
          rows={4}
          maxLength={1000}
        />
      </div>

      <Button type="submit" disabled={isPending} className="mt-2 self-start">
        {isPending ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}
