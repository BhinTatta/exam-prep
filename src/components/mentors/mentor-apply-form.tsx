"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FileInput } from "@/components/ui/file-input";
import { subjects } from "@/config/site";
import { applyAsMentor } from "@/app/mentors/actions";

export function MentorApplyForm() {
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await applyAsMentor(formData);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Couldn't submit application");
      }
    });
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="institute">Institute</Label>
            <Input id="institute" name="institute" placeholder="Fiziks / CED / IISc ..." required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rank">Rank / AIR (optional but improves verification odds)</Label>
            <Input id="rank" name="rank" placeholder="AIR 12, JAM 2024" />
          </div>
          <div className="grid gap-2">
            <Label>Subjects you can mentor</Label>
            <div className="flex flex-col gap-2">
              {subjects.map((s) => (
                <label key={s.slug} className="flex items-center gap-2 text-sm">
                  <Checkbox name="subjects" value={s.slug} defaultChecked={subjects.length === 1} />
                  {s.label}
                </label>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="rate">Rate per session (INR)</Label>
              <Input id="rate" name="rate" type="number" min={0} step={50} placeholder="300" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="upiId">UPI ID</Label>
              <Input id="upiId" name="upiId" placeholder="you@upi" required />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" name="bio" placeholder="A couple of lines about your background." rows={3} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="proof">Proof (rank card, ID, certificate — image or PDF)</Label>
            <FileInput id="proof" name="proof" accept="image/*,.pdf" required />
          </div>
          <Button type="submit" disabled={isPending} className="mt-2">
            {isPending ? "Submitting..." : "Submit application"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
