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
import { subjects, mentorLanguages, examCredentials } from "@/config/site";
import { applyAsMentor } from "@/app/mentors/actions";

const CURRENT_YEAR = new Date().getFullYear();

/** Mirrors the `Input` styling so the native select doesn't look bolted on. */
const SELECT_CLASS =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

export function MentorApplyForm() {
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    // Checkbox groups can't be `required` in HTML, so these two are checked
    // here to fail fast instead of round-tripping to the server.
    if (formData.getAll("subjects").length === 0) {
      toast.error("Pick at least one subject you can mentor.");
      return;
    }
    if (formData.getAll("languages").length === 0) {
      toast.error("Pick at least one language you can take a session in.");
      return;
    }

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
        <form action={onSubmit} className="flex flex-col gap-5">
          <Section
            title="What you cleared"
            hint="This is the first thing a student reads, and the reason they trust the rest."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="examCleared">Exam you cleared</Label>
                <select id="examCleared" name="examCleared" required className={SELECT_CLASS} defaultValue="">
                  <option value="" disabled>
                    Select an exam
                  </option>
                  {examCredentials.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="examYear">Year you cleared it</Label>
                <Input
                  id="examYear"
                  name="examYear"
                  type="number"
                  min={1990}
                  max={CURRENT_YEAR}
                  placeholder={String(CURRENT_YEAR - 1)}
                  required
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rank">Your rank / AIR</Label>
              <Input id="rank" name="rank" placeholder="AIR 12" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="institute">Institute you prepared at / are from</Label>
              <Input id="institute" name="institute" placeholder="Fiziks / CED / IISc ..." required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currentRole">What you&apos;re doing now</Label>
              <Input
                id="currentRole"
                name="currentRole"
                placeholder="MSc Physics, IIT Bombay"
                required
              />
              <p className="text-xs text-muted-foreground">
                Shown under your name — it&apos;s the proof that clearing the exam went somewhere.
              </p>
            </div>
          </Section>

          <Section
            title="Why a student should pick you"
            hint="Skip the CV voice. The mentors who get booked sound like a person, not a brochure."
          >
            <div className="grid gap-2">
              <Label htmlFor="story">Your &ldquo;I was where you are&rdquo; line</Label>
              <Textarea
                id="story"
                name="story"
                rows={3}
                minLength={60}
                maxLength={400}
                required
                placeholder="I failed my first attempt with 22%. The second time I changed one thing about how I revised — that's mostly what I end up talking about."
              />
              <p className="text-xs text-muted-foreground">
                One honest sentence about your own struggle beats three about your achievements.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bio">Short bio</Label>
              <Textarea
                id="bio"
                name="bio"
                rows={3}
                minLength={40}
                maxLength={2000}
                required
                placeholder="How you prepared, what you're good at explaining, what you're not."
              />
            </div>
          </Section>

          <Section title="How you'll mentor">
            <div className="grid gap-2">
              <Label>Subjects you can mentor</Label>
              <div className="flex flex-wrap gap-4">
                {subjects.map((s) => (
                  <label key={s.slug} className="flex items-center gap-2 text-sm">
                    <Checkbox name="subjects" value={s.slug} defaultChecked={subjects.length === 1} />
                    {s.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Languages you can take a session in</Label>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {mentorLanguages.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <Checkbox name="languages" value={l} defaultChecked={l === "English"} />
                    {l}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="rate">Rate per session (INR)</Label>
                <Input id="rate" name="rate" type="number" min={0} step={50} placeholder="300" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="upiId">UPI ID (for your payout)</Label>
                <Input id="upiId" name="upiId" placeholder="you@upi" required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="proof">Proof (rank card, ID, certificate — image or PDF)</Label>
              <FileInput id="proof" name="proof" accept="image/*,.pdf" required />
              <p className="text-xs text-muted-foreground">
                Checked by a human before your profile goes live. Students are told that, and it&apos;s
                why they book.
              </p>
            </div>
          </Section>

          <Button
            type="submit"
            size="xl"
            emphasis="lift"
            loading={isPending}
            loadingText="Submitting…"
            className="mt-1 w-full"
          >
            Submit application
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-4 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{title}</legend>
      <div>
        <p className="font-heading text-base font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </fieldset>
  );
}
