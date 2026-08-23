"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
    <Button size="lg" className="gap-1.5" onClick={onClick} disabled={disabled || isPending}>
      {isPending ? "Starting..." : "Start test"} <ArrowRight className="size-4" />
    </Button>
  );
}
