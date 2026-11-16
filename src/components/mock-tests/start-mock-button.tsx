"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startNavProgress } from "@/components/nav-progress";
import { startMockAttempt } from "@/app/mock-tests/actions";

export function StartMockButton({ testId, resume }: { testId: string; resume: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onClick() {
    startNavProgress();
    startTransition(async () => {
      try {
        const { slug, attemptId } = await startMockAttempt(testId);
        router.push(`/mock-tests/${slug}/attempt/${attemptId}`);
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
      loading={isPending}
      loadingText="Setting up your paper…"
    >
      {resume ? "Resume your test" : "Start the test"} <ArrowRight />
    </Button>
  );
}
