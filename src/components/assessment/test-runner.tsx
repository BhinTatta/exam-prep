"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { KatexContent } from "@/components/katex-content";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { submitAttempt } from "@/app/tests/[slug]/attempt/[attemptId]/actions";
import type { QuestionOption } from "@/lib/assessment/types";
import { Clock, ArrowLeft, ArrowRight, Check } from "lucide-react";

type RunnerQuestion = {
  id: string;
  section: "PROFILE" | "CONTENT";
  topic: string;
  prompt: string;
  imageUrl: string | null;
  options: QuestionOption[];
};

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SCORING_MESSAGES = [
  "Checking your answers...",
  "Building your topic breakdown...",
  "Writing your study plan...",
  "Almost there...",
];

export function TestRunner({
  attemptId,
  slug,
  testTitle,
  durationMinutes,
  questions,
}: {
  attemptId: string;
  slug: string;
  testTitle: string;
  durationMinutes: number;
  questions: RunnerQuestion[];
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSubmitting, startTransition] = useTransition();
  const [scoringMessageIndex, setScoringMessageIndex] = useState(0);
  const submittedRef = useRef(false);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const progressPct = ((index + 1) / questions.length) * 100;

  const answeredCount = useMemo(
    () => questions.filter((q) => (answers[q.id]?.length ?? 0) > 0).length,
    [answers, questions]
  );

  function doSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;

    const payload = questions.map((q) => ({ questionId: q.id, selectedOptionIds: answers[q.id] ?? [] }));
    startTransition(async () => {
      try {
        await submitAttempt(attemptId, payload);
        router.push(`/tests/${slug}/attempt/${attemptId}/results`);
      } catch {
        submittedRef.current = false;
        toast.error("Couldn't submit — check your connection and try again.");
      }
    });
  }

  function requestSubmit() {
    if (answeredCount < questions.length) {
      setConfirmOpen(true);
    } else {
      doSubmit();
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          doSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSubmitting) return;
    const interval = setInterval(() => {
      setScoringMessageIndex((i) => Math.min(i + 1, SCORING_MESSAGES.length - 1));
    }, 1800);
    return () => clearInterval(interval);
  }, [isSubmitting]);

  if (isSubmitting) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-32 text-center">
        <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-lg font-medium">{SCORING_MESSAGES[scoringMessageIndex]}</p>
      </div>
    );
  }

  function selectOption(optionId: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: [optionId] }));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <p className="text-sm font-medium">{testTitle}</p>
          <p className="text-xs text-muted-foreground">
            Question {index + 1} of {questions.length} · {answeredCount} answered
          </p>
        </div>
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold tabular-nums",
            secondsLeft <= 60 && "animate-pulse border-destructive/40 text-destructive"
          )}
        >
          <Clock className="size-3.5" /> {formatTime(secondsLeft)}
        </div>
      </div>

      <Progress value={progressPct} />

      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-6 shadow-sm">
          {question.section === "CONTENT" && <Badge variant="secondary">{question.topic}</Badge>}
          <KatexContent text={question.prompt} className="text-lg font-medium" />
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="" className="max-h-72 w-auto rounded-md border object-contain" />
          )}

          <div className="mt-2 flex flex-col gap-2.5">
            {question.options.map((opt) => {
              const selected = answers[question.id]?.[0] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => selectOption(opt.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 font-medium"
                      : "hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-full border",
                      selected ? "border-primary bg-primary" : "border-muted-foreground/40"
                    )}
                  >
                    {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                  </span>
                  <KatexContent text={opt.label} />
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" /> Back
            </Button>
            {isLast ? (
              <Button onClick={requestSubmit} className="gap-1.5">
                Submit test
              </Button>
            ) : (
              <Button onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))} className="gap-1.5">
                Next <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>

        <QuestionPalette
          questions={questions}
          answers={answers}
          currentIndex={index}
          onJump={setIndex}
          onSubmit={requestSubmit}
        />
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {questions.length - answeredCount} question{questions.length - answeredCount === 1 ? "" : "s"} unanswered
            </AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve answered {answeredCount} of {questions.length}. Unanswered questions score zero. Submit anyway?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>Keep going</AlertDialogCancel>
            <AlertDialogAction onClick={doSubmit}>Submit anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function QuestionPalette({
  questions,
  answers,
  currentIndex,
  onJump,
  onSubmit,
}: {
  questions: RunnerQuestion[];
  answers: Record<string, string[]>;
  currentIndex: number;
  onJump: (i: number) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-3 rounded-xl border bg-card p-4 md:w-44">
      <p className="text-xs font-medium text-muted-foreground">Jump to question</p>
      <div className="grid grid-cols-8 gap-1.5 md:grid-cols-5">
        {questions.map((q, i) => {
          const answered = (answers[q.id]?.length ?? 0) > 0;
          const current = i === currentIndex;
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex size-8 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                current && "border-primary ring-2 ring-primary/30",
                answered && !current && "border-emerald-500/50 bg-emerald-500/10 text-emerald-600",
                !answered && !current && "border-muted-foreground/20 text-muted-foreground hover:border-primary/40"
              )}
            >
              {answered && !current ? <Check className="size-3.5" /> : i + 1}
            </button>
          );
        })}
      </div>
      <Button variant="outline" size="sm" onClick={onSubmit} className="mt-1">
        Submit test
      </Button>
    </div>
  );
}
