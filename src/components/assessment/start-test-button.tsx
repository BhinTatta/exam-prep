"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { startNavProgress } from "@/components/nav-progress";
import { startAttempt } from "@/app/tests/actions";
import { ArrowRight } from "lucide-react";

export function StartTestButton({
  testId,
  slug,
  utm,
  disabled,
}: {
  testId: string;
  slug: string;
  utm?: { source?: string; medium?: string; campaign?: string };
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    // `router.push` isn't observable by the global progress bar, so kick it off
    // here — the button spinner covers the action, this covers the navigation.
    startNavProgress();
    startTransition(async () => {
      try {
        const attemptId = await startAttempt(testId, utm);
        router.push(`/tests/${slug}/attempt/${attemptId}`);
      } catch {
        toast.error("Couldn't start the test — try again in a moment.");
      }
    });
  }

  return (
    <Button
      size="hero"
      emphasis="glow"
      className="w-full sm:w-auto"
      onClick={onClick}
      disabled={disabled}
      loading={isPending}
      loadingText="Setting up your test…"
    >
      Start the test <ArrowRight />
    </Button>
  );
}
