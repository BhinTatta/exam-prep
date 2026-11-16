"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Calculator, CloudOff, FileText, Info, LayoutGrid, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { saveMockProgress, submitMockAttempt } from "@/app/mock-tests/actions";
import { formatMarks, formatNegative } from "@/lib/mock-tests/scoring";
import { isAnsweredStatus, type MockOption, type ResponseEntry, type ResponseStatus } from "@/lib/mock-tests/types";
import { ScientificCalculator } from "./calculator";
import { ExamInstructions, buildPattern } from "./instructions";
import { StatusMark, STATUS_LABEL } from "./palette";
import { OptionContent, QuestionPrompt } from "./question-content";

export type ExamQuestion = {
  id: string;
  number: number;
  type: "MCQ" | "MSQ" | "NAT";
  prompt: string;
  imageUrl: string | null;
  options: MockOption[];
  marks: number;
  negativeMarks: number;
};
export type ExamSection = { id: string; name: string; instructions: string | null; questions: ExamQuestion[] };

type Draft = { selected: string[]; numeric: string };

const TYPE_LABEL = { MCQ: "MCQ", MSQ: "MSQ", NAT: "NAT" } as const;
const TYPE_HINT = {
  MCQ: "Only one option is correct",
  MSQ: "One or more options are correct",
  NAT: "Enter a numerical value",
} as const;
const LEGEND: ResponseStatus[] = ["ANSWERED", "NOT_ANSWERED", "NOT_VISITED", "MARKED", "ANSWERED_MARKED"];
const NAT_PATTERN = /^-?\d*\.?\d*$/;
const AUTOSAVE_MS = 20_000;

const emptyEntry = (questionId: string): ResponseEntry => ({
  questionId,
  selectedOptionIds: [],
  numericAnswer: null,
  status: "NOT_VISITED",
  timeSpentSeconds: 0,
});

const draftFrom = (entry: ResponseEntry | undefined): Draft => ({
  selected: entry?.selectedOptionIds ?? [],
  numeric: entry?.numericAnswer ?? "",
});

function formatClock(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

/**
 * The exam screen. Laid out and behaving like the real JAM computer-based
 * test — section tabs, the five-state palette, Save & Next / Mark for Review,
 * a numeric keypad for NAT and the floating calculator — so that exam day
 * holds no interface surprises.
 *
 * Where the answers live: `responsesRef` is the truth while the page is open.
 * Every change is queued and pushed to the server in the background
 * (`saveMockProgress`), which is what a refresh reloads from; the final
 * submit sends the whole picture again so nothing depends on the last
 * background save having landed.
 */
export function ExamRunner({
  attemptId,
  slug,
  title,
  durationMinutes,
  calculator,
  sections,
  initialResponses,
  deadlineAt,
  serverNow,
  candidate,
}: {
  attemptId: string;
  slug: string;
  title: string;
  durationMinutes: number;
  calculator: boolean;
  sections: ExamSection[];
  initialResponses: ResponseEntry[];
  /** Epoch ms, from the server. */
  deadlineAt: number;
  /** The server's clock when it rendered this page — the countdown runs off it, not the device clock. */
  serverNow: number;
  candidate: { name: string; image: string | null };
}) {
  const router = useRouter();
  const resultUrl = `/mock-tests/${slug}/attempt/${attemptId}/result`;

  const flat = useMemo(
    () => sections.flatMap((s, sectionIndex) => s.questions.map((q) => ({ ...q, sectionIndex }))),
    [sections]
  );
  const pattern = useMemo(() => buildPattern(sections), [sections]);

  const [responses, setResponses] = useState<Record<string, ResponseEntry>>(() => {
    const map: Record<string, ResponseEntry> = {};
    for (const q of flat) map[q.id] = emptyEntry(q.id);
    for (const r of initialResponses) if (map[r.questionId]) map[r.questionId] = r;
    // The first question is on screen from the first frame, so it is visited.
    const first = flat[0].id;
    if (map[first].status === "NOT_VISITED") map[first] = { ...map[first], status: "NOT_ANSWERED" };
    return map;
  });
  const [index, setIndex] = useState(0);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(responses[flat[0].id]));
  const [secondsLeft, setSecondsLeft] = useState(() => Math.max(0, Math.ceil((deadlineAt - serverNow) / 1000)));
  const [saveFailed, setSaveFailed] = useState(false);
  const [submitting, setSubmitting] = useState<null | "manual" | "timeout" | "stuck">(null);

  const [calcOpen, setCalcOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "instructions" | "paper" | "submit">(null);

  // Mutable mirrors, written only from event handlers and timers.
  const responsesRef = useRef(responses);
  const indexRef = useRef(0);
  const dirty = useRef(new Set<string>([flat[0].id]));
  const flushing = useRef(false);
  const finished = useRef(false);
  const enteredAt = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  // The timer and autosave effects are set up once; this lets them call the
  // latest closures without being torn down on every render.
  const live = useRef({ tick: () => {}, autosave: () => {} });

  const question = flat[index];
  const section = sections[question.sectionIndex];

  // ---- state plumbing ------------------------------------------------------

  function update(questionId: string, change: (entry: ResponseEntry) => ResponseEntry) {
    const before = responsesRef.current[questionId];
    const after = change(before);
    if (after === before) return;
    responsesRef.current = { ...responsesRef.current, [questionId]: after };
    dirty.current.add(questionId);
  }
  const publish = () => setResponses(responsesRef.current);

  /** Credits the time since the last call to the question on screen. */
  function settleTime() {
    const elapsed = Math.floor((Date.now() - enteredAt.current) / 1000);
    if (elapsed <= 0) return;
    enteredAt.current += elapsed * 1000;
    update(flat[indexRef.current].id, (e) => ({ ...e, timeSpentSeconds: e.timeSpentSeconds + elapsed }));
  }

  async function flush() {
    if (flushing.current || finished.current || dirty.current.size === 0) return;
    flushing.current = true;
    const ids = [...dirty.current];
    dirty.current.clear();
    let ok = true;
    try {
      const { closed } = await saveMockProgress(
        attemptId,
        ids.map((id) => responsesRef.current[id])
      );
      setSaveFailed(false);
      if (closed) {
        // Submitted from another tab, or the server's clock ran out first.
        finished.current = true;
        router.replace(resultUrl);
      }
    } catch {
      ok = false;
      // Put them back; the next change or the autosave tick retries.
      for (const id of ids) dirty.current.add(id);
      setSaveFailed(true);
    } finally {
      flushing.current = false;
    }
    if (ok && dirty.current.size > 0) void flush();
  }

  // ---- navigation and answering -------------------------------------------

  function goTo(next: number) {
    settleTime();
    const target = flat[next];
    update(target.id, (e) => (e.status === "NOT_VISITED" ? { ...e, status: "NOT_ANSWERED" } : e));
    indexRef.current = next;
    setIndex(next);
    // Whatever was chosen but not saved on the question being left is dropped
    // here — the draft is reloaded from what was actually recorded.
    setDraft(draftFrom(responsesRef.current[target.id]));
    setPaletteOpen(false);
    publish();
    void flush();
    scrollRef.current?.scrollTo({ top: 0 });
  }

  function record(markForReview: boolean) {
    const answered = question.type === "NAT" ? /\d/.test(draft.numeric) : draft.selected.length > 0;
    update(question.id, (e) => ({
      ...e,
      selectedOptionIds: answered && question.type !== "NAT" ? draft.selected : [],
      numericAnswer: answered && question.type === "NAT" ? draft.numeric : null,
      status: answered
        ? markForReview
          ? "ANSWERED_MARKED"
          : "ANSWERED"
        : markForReview
          ? "MARKED"
          : "NOT_ANSWERED",
    }));
    // On the last question there is no "next"; stay put with the answer saved.
    goTo(Math.min(index + 1, flat.length - 1));
  }

  function clearResponse() {
    setDraft({ selected: [], numeric: "" });
    update(question.id, (e) => ({ ...e, selectedOptionIds: [], numericAnswer: null, status: "NOT_ANSWERED" }));
    publish();
    void flush();
  }

  function toggleOption(optionId: string) {
    setDraft((d) =>
      question.type === "MCQ"
        ? { ...d, selected: [optionId] }
        : {
            ...d,
            selected: d.selected.includes(optionId)
              ? d.selected.filter((id) => id !== optionId)
              : [...d.selected, optionId],
          }
    );
  }

  function setNumeric(value: string) {
    if (value.length <= 20 && NAT_PATTERN.test(value)) setDraft((d) => ({ ...d, numeric: value }));
  }

  function pressKeypad(key: string) {
    if (key === "clear") return setDraft((d) => ({ ...d, numeric: "" }));
    if (key === "back") return setDraft((d) => ({ ...d, numeric: d.numeric.slice(0, -1) }));
    if (key === "-") {
      // The sign only ever goes at the front, so the key toggles it.
      return setDraft((d) => ({ ...d, numeric: d.numeric.startsWith("-") ? d.numeric.slice(1) : `-${d.numeric}` }));
    }
    setNumeric(draft.numeric + key);
  }

  // ---- submitting ----------------------------------------------------------

  async function submit(timedOut: boolean) {
    if (finished.current) return;
    setDialog(null);
    setSubmitting(timedOut ? "timeout" : "manual");
    settleTime();
    const entries = Object.values(responsesRef.current);

    // A student on a weak connection when the clock hits zero must not lose
    // the paper to one failed request, so the timed-out path keeps trying.
    const tries = timedOut ? 8 : 2;
    for (let attempt = 0; attempt < tries; attempt++) {
      try {
        await submitMockAttempt(attemptId, entries, { timedOut });
        finished.current = true;
        router.replace(resultUrl);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 2500));
      }
    }

    if (timedOut) {
      setSubmitting("stuck");
    } else {
      setSubmitting(null);
      toast.error("Couldn't submit — check your connection and try again. Your answers are still here.");
    }
  }

  useEffect(() => {
    live.current = {
      tick: () => void submit(true),
      autosave: () => {
        settleTime();
        void flush();
      },
    };
  });

  useEffect(() => {
    // How far this device's clock is from the server's. Measured once; every
    // later reading of Date.now() is corrected by it.
    const skew = serverNow - Date.now();
    enteredAt.current = Date.now();
    void flush();

    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadlineAt - (Date.now() + skew)) / 1000));
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timer);
        live.current.tick();
      }
    }, 500);
    const autosave = setInterval(() => live.current.autosave(), AUTOSAVE_MS);

    const warn = (e: BeforeUnloadEvent) => {
      if (!finished.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    // Hiding the tab is the last reliable moment on a phone before the
    // browser may freeze the page.
    const onHide = () => {
      if (document.visibilityState === "hidden") live.current.autosave();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      clearInterval(timer);
      clearInterval(autosave);
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", onHide);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- derived -------------------------------------------------------------

  const counts = useMemo(() => {
    const total: Record<ResponseStatus, number> = {
      NOT_VISITED: 0,
      NOT_ANSWERED: 0,
      ANSWERED: 0,
      MARKED: 0,
      ANSWERED_MARKED: 0,
    };
    const bySection = sections.map((s) => {
      const c = { ...total };
      for (const q of s.questions) c[responses[q.id].status] += 1;
      return c;
    });
    for (const c of bySection) for (const k of LEGEND) total[k] += c[k];
    return { total, bySection };
  }, [responses, sections]);

  const lowTime = secondsLeft <= 300;

  if (submitting === "timeout" || submitting === "manual" || submitting === "stuck") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        {submitting === "stuck" ? (
          <>
            <CloudOff className="size-10 text-muted-foreground" />
            <p className="max-w-md text-lg font-medium">Time is up, but we couldn&apos;t reach the server.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Every answer you saved before the clock ran out is already stored and will be scored. Once you&apos;re
              back online, open your result.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => void submit(true)}>
                Try again
              </Button>
              <Button onClick={() => router.replace(resultUrl)}>Open my result</Button>
            </div>
          </>
        ) : (
          <>
            <Loader2 className="size-10 animate-spin text-primary" />
            <p className="text-lg font-medium">
              {submitting === "timeout" ? "Time's up — submitting your paper…" : "Submitting your paper…"}
            </p>
          </>
        )}
      </div>
    );
  }

  const palette = (
    <PalettePanel
      candidate={candidate}
      sections={sections}
      sectionIndex={question.sectionIndex}
      currentId={question.id}
      responses={responses}
      totals={counts.total}
      flat={flat}
      onJump={goTo}
      onSubmit={() => setDialog("submit")}
    />
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {/* Title bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 bg-primary px-3 text-primary-foreground sm:px-4">
        <h1 className="min-w-0 truncate font-heading text-sm font-semibold sm:text-base">{title}</h1>
        <div className="flex shrink-0 items-center gap-1">
          <HeaderButton icon={Info} label="Instructions" onClick={() => setDialog("instructions")} />
          <HeaderButton icon={FileText} label="Question Paper" onClick={() => setDialog("paper")} />
          {calculator && (
            <HeaderButton icon={Calculator} label="Calculator" onClick={() => setCalcOpen((o) => !o)} active={calcOpen} />
          )}
        </div>
      </header>

      {/* Sections + clock */}
      <div className="flex shrink-0 items-stretch justify-between gap-2 border-b bg-card">
        <div role="tablist" aria-label="Sections" className="flex min-w-0 overflow-x-auto">
          {sections.map((s, i) => {
            const active = i === question.sectionIndex;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => goTo(flat.findIndex((q) => q.sectionIndex === i))}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-4",
                  active
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {s.name}
                <span className="ml-1.5 text-xs tabular-nums opacity-70">
                  {counts.bySection[i].ANSWERED + counts.bySection[i].ANSWERED_MARKED}/{s.questions.length}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-2 pr-2 sm:pr-4">
          {saveFailed && (
            <span className="hidden items-center gap-1 text-xs text-destructive sm:flex" title="Answers will sync when you're back online">
              <CloudOff className="size-3.5" /> Offline
            </span>
          )}
          <div
            role="timer"
            aria-label="Time left"
            className={cn(
              "flex items-baseline gap-1.5 rounded-md px-2 py-1 text-sm",
              lowTime && "bg-destructive/10 text-destructive"
            )}
          >
            <span className="hidden text-xs text-muted-foreground sm:inline">Time Left</span>
            <span className="font-mono text-base font-bold tabular-nums">{formatClock(secondsLeft)}</span>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            aria-label="Open question palette"
            onClick={() => setPaletteOpen(true)}
          >
            <LayoutGrid />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Question column */}
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b bg-muted/40 px-3 py-2 sm:px-5">
            <div className="flex items-baseline gap-2">
              <h2 className="font-heading text-base font-semibold">Question {question.number}</h2>
              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
                {TYPE_LABEL[question.type]}
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">{TYPE_HINT[question.type]}</span>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span>
                Correct: <strong className="text-green-700 dark:text-green-400">+{formatMarks(question.marks)}</strong>
              </span>
              <span>
                Wrong:{" "}
                <strong className={cn(question.negativeMarks > 0 && "text-red-700 dark:text-red-400")}>
                  {question.negativeMarks > 0 ? `−${formatNegative(question.marks, question.negativeMarks)}` : "0"}
                </strong>
              </span>
            </div>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              <QuestionPrompt
                number={question.number}
                prompt={question.prompt}
                imageUrl={question.imageUrl}
                className="text-[0.9375rem] sm:text-base"
              />

              {question.type === "NAT" ? (
                <NatInput value={draft.numeric} onChange={setNumeric} onKey={pressKeypad} />
              ) : (
                <div
                  role={question.type === "MCQ" ? "radiogroup" : "group"}
                  aria-label={`Options for question ${question.number}`}
                  className="flex flex-col gap-2.5"
                >
                  {question.options.map((opt) => {
                    const selected = draft.selected.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role={question.type === "MCQ" ? "radio" : "checkbox"}
                        aria-checked={selected}
                        onClick={() => toggleOption(opt.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left text-[0.9375rem] transition-colors",
                          selected ? "border-primary bg-primary/5" : "hover:border-primary/40 hover:bg-muted/50"
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center border-2 text-[0.625rem] font-bold",
                            question.type === "MCQ" ? "rounded-full" : "rounded",
                            selected
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted-foreground/50"
                          )}
                        >
                          {selected && (question.type === "MCQ" ? <span className="size-2 rounded-full bg-current" /> : "✓")}
                        </span>
                        <span className="w-5 shrink-0 font-semibold">{opt.id}.</span>
                        <OptionContent option={opt} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Action bar */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-card px-3 py-2.5 sm:px-5">
            <div className="flex min-w-0 gap-2">
              <Button variant="outline" size="lg" onClick={() => record(true)}>
                <span className="sm:hidden">Mark &amp; Next</span>
                <span className="hidden sm:inline">Mark for Review &amp; Next</span>
              </Button>
              <Button variant="outline" size="lg" onClick={clearResponse}>
                <span className="sm:hidden">Clear</span>
                <span className="hidden sm:inline">Clear Response</span>
              </Button>
            </div>
            <Button size="lg" className="rounded-lg px-4" onClick={() => record(false)}>
              Save &amp; Next
            </Button>
          </div>
        </main>

        {/* Palette: a fixed column on desktop, a slide-over on small screens. */}
        <aside className="hidden w-72 shrink-0 border-l bg-card lg:flex xl:w-80">{palette}</aside>
        {paletteOpen && (
          <div className="fixed inset-0 z-[55] flex justify-end lg:hidden">
            <button
              type="button"
              aria-label="Close question palette"
              className="absolute inset-0 bg-black/40"
              onClick={() => setPaletteOpen(false)}
            />
            <aside className="relative flex w-[min(20rem,88vw)] bg-card shadow-xl">
              <button
                type="button"
                aria-label="Close question palette"
                onClick={() => setPaletteOpen(false)}
                className="absolute top-2 right-2 z-10 rounded-md p-1.5 hover:bg-muted"
              >
                <X className="size-4" />
              </button>
              {palette}
            </aside>
          </div>
        )}
      </div>

      {calculator && <ScientificCalculator open={calcOpen} onClose={() => setCalcOpen(false)} />}

      <Dialog open={dialog === "instructions"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Instructions</DialogTitle>
            <DialogDescription>The clock keeps running while this is open.</DialogDescription>
          </DialogHeader>
          {section.instructions && (
            <div className="rounded-lg border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{section.name}</p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{section.instructions}</p>
            </div>
          )}
          <ExamInstructions durationMinutes={durationMinutes} calculator={calculator} pattern={pattern} />
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "paper"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Question Paper</DialogTitle>
            <DialogDescription>Read-only. Pick a question to jump to it.</DialogDescription>
          </DialogHeader>
          {dialog === "paper" && (
            <div className="flex flex-col gap-6">
              {sections.map((s) => (
                <section key={s.id} className="flex flex-col gap-3">
                  <h3 className="sticky -top-4 z-10 -mx-4 border-b bg-popover px-4 py-2 font-heading text-sm font-semibold">
                    {s.name}
                  </h3>
                  {s.questions.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setDialog(null);
                        goTo(flat.findIndex((f) => f.id === q.id));
                      }}
                      className="flex gap-3 rounded-lg border p-3 text-left hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span className="w-8 shrink-0 font-semibold tabular-nums">Q{q.number}</span>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <QuestionPrompt number={q.number} prompt={q.prompt} imageUrl={q.imageUrl} />
                        {q.options.map((opt) => (
                          <div key={opt.id} className="flex gap-2 text-muted-foreground">
                            <span className="shrink-0 font-medium">({opt.id})</span>
                            <OptionContent option={opt} />
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "submit"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submit the test?</DialogTitle>
            <DialogDescription>
              {secondsLeft > 0 ? `${formatClock(secondsLeft)} still on the clock. ` : ""}
              Once submitted you cannot change any answer.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Section</th>
                  <th className="px-2 py-2 text-right font-medium">Questions</th>
                  <th className="px-2 py-2 text-right font-medium">Answered</th>
                  <th className="px-2 py-2 text-right font-medium">Not answered</th>
                  <th className="px-2 py-2 text-right font-medium">Marked</th>
                  <th className="px-2 py-2 text-right font-medium">Answered &amp; marked</th>
                  <th className="px-3 py-2 text-right font-medium">Not visited</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {sections.map((s, i) => {
                  const c = counts.bySection[i];
                  return (
                    <tr key={s.id} className="border-t">
                      <td className="px-3 py-2 text-left font-medium">{s.name}</td>
                      <td className="px-2 py-2 text-right">{s.questions.length}</td>
                      <td className="px-2 py-2 text-right">{c.ANSWERED}</td>
                      <td className="px-2 py-2 text-right">{c.NOT_ANSWERED}</td>
                      <td className="px-2 py-2 text-right">{c.MARKED}</td>
                      <td className="px-2 py-2 text-right">{c.ANSWERED_MARKED}</td>
                      <td className="px-3 py-2 text-right">{c.NOT_VISITED}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {(question.type === "NAT" ? /\d/.test(draft.numeric) : draft.selected.length > 0) &&
            !isAnsweredStatus(responses[question.id].status) && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                Your answer to Question {question.number} is not saved yet. Go back and press Save &amp; Next if you
                want it counted.
              </p>
            )}
          <DialogFooter>
            <Button variant="outline" size="lg" onClick={() => setDialog(null)}>
              Go back to the test
            </Button>
            <Button size="lg" className="rounded-lg px-4" onClick={() => void submit(false)}>
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderButton({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors hover:bg-white/15 sm:text-sm",
        active && "bg-white/20"
      )}
    >
      <Icon className="size-4" />
      <span className="hidden md:inline">{label}</span>
      <span className="sr-only md:hidden">{label}</span>
    </button>
  );
}

const KEYPAD = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0", ".", "-"] as const;

function NatInput({
  value,
  onChange,
  onKey,
}: {
  value: string;
  onChange: (value: string) => void;
  onKey: (key: string) => void;
}) {
  return (
    <div className="flex w-full max-w-64 flex-col gap-2">
      <label htmlFor="nat-answer" className="text-sm font-medium">
        Your answer
      </label>
      <input
        id="nat-answer"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        inputMode="decimal"
        autoComplete="off"
        placeholder="Enter a number"
        className="h-11 rounded-lg border border-input bg-background px-3 font-mono text-lg tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40"
      />
      <div className="grid grid-cols-3 gap-1.5">
        <button type="button" onClick={() => onKey("back")} className={cn(keypadKey, "col-span-2 text-sm")}>
          Backspace
        </button>
        <button type="button" onClick={() => onKey("clear")} className={cn(keypadKey, "text-sm")}>
          Clear
        </button>
        {KEYPAD.map((k) => (
          <button key={k} type="button" onClick={() => onKey(k)} className={keypadKey} aria-label={k === "-" ? "minus sign" : undefined}>
            {k === "-" ? "−" : k}
          </button>
        ))}
      </div>
    </div>
  );
}
const keypadKey =
  "flex h-10 items-center justify-center rounded-md border bg-card text-base font-semibold transition-colors hover:bg-muted active:translate-y-px";

function PalettePanel({
  candidate,
  sections,
  sectionIndex,
  currentId,
  responses,
  totals,
  flat,
  onJump,
  onSubmit,
}: {
  candidate: { name: string; image: string | null };
  sections: ExamSection[];
  sectionIndex: number;
  currentId: string;
  responses: Record<string, ResponseEntry>;
  totals: Record<ResponseStatus, number>;
  flat: { id: string }[];
  onJump: (index: number) => void;
  onSubmit: () => void;
}) {
  const section = sections[sectionIndex];
  return (
    <div className="flex min-h-0 w-full flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b px-4 py-3">
        <Avatar size="lg">
          {candidate.image && <AvatarImage src={candidate.image} alt="" />}
          <AvatarFallback>{candidate.name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <p className="min-w-0 truncate pr-6 text-sm font-medium">{candidate.name}</p>
      </div>

      <ul className="grid shrink-0 grid-cols-2 gap-x-2 gap-y-2 border-b px-4 py-3 text-xs">
        {LEGEND.map((status) => (
          <li key={status} className={cn("flex items-center gap-2", status === "ANSWERED_MARKED" && "col-span-2")}>
            <StatusMark status={status} className="size-7 [&>span:first-child]:text-xs">
              {totals[status]}
            </StatusMark>
            <span className="leading-tight">{STATUS_LABEL[status]}</span>
          </li>
        ))}
      </ul>

      <p className="shrink-0 bg-primary/10 px-4 py-2 text-sm font-semibold text-primary">{section.name}</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="mb-2 text-xs text-muted-foreground">Choose a question</p>
        <div className="grid grid-cols-5 gap-2.5">
          {section.questions.map((q) => {
            const status = responses[q.id].status;
            const current = q.id === currentId;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => onJump(flat.findIndex((f) => f.id === q.id))}
                aria-label={`Question ${q.number}, ${STATUS_LABEL[status]}`}
                aria-current={current ? "true" : undefined}
                className={cn(
                  "flex items-center justify-center rounded-md p-0.5 outline-offset-2 transition-transform hover:scale-105",
                  current && "outline-2 outline-foreground"
                )}
              >
                <StatusMark status={status}>{q.number}</StatusMark>
              </button>
            );
          })}
        </div>
      </div>

      <div className="shrink-0 border-t p-3">
        <Button size="lg" className="w-full rounded-lg" onClick={onSubmit}>
          Submit
        </Button>
      </div>
    </div>
  );
}
