import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { KatexContent } from "@/components/katex-content";
import { StartTestButton } from "@/components/assessment/start-test-button";
import { cn } from "@/lib/utils";
import { Clock, ListChecks, UserX, Sparkles, Target, ListOrdered, MessagesSquare } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = await prisma.test.findUnique({ where: { slug }, select: { title: true, description: true } });
  return { title: test?.title ?? "Diagnostic Test", description: test?.description ?? undefined };
}

export default async function TestIntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ utm_source?: string; utm_medium?: string; utm_campaign?: string }>;
}) {
  const { slug } = await params;
  const utm = await searchParams;

  const [test, session] = await Promise.all([
    prisma.test.findUnique({
      where: { slug },
      include: {
        _count: { select: { questions: { where: { section: "CONTENT", isActive: true } } } },
        questions: {
          where: { section: "CONTENT", isActive: true },
          select: { topic: true },
          orderBy: { topic: "asc" },
        },
      },
    }),
    auth(),
  ]);

  if (!test || !test.published) notFound();

  const sampleTopics = [...new Set(test.questions.map((q) => q.topic))].slice(0, 3);
  const noQuestions = test._count.questions === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Everything above this comment has to fit on one phone screen: the
          point of this page is to start the test, not to read about it. */}
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Sparkles className="size-3.5" /> Free — no account required
        </Badge>
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          {test.title}
        </h1>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" /> {test.durationMinutes} min
          </span>
          <span className="flex items-center gap-1.5">
            <ListChecks className="size-4 text-primary" /> {test._count.questions} questions
          </span>
          <span className="flex items-center gap-1.5">
            <UserX className="size-4 text-primary" /> No sign-up
          </span>
        </div>

        <div className="mt-2 w-full">
          <StartTestButton
            testId={test.id}
            slug={test.slug}
            utm={{ source: utm.utm_source, medium: utm.utm_medium, campaign: utm.utm_campaign }}
            disabled={noQuestions}
          />
        </div>

        {noQuestions ? (
          <p className="text-xs text-muted-foreground">
            This test has no active questions yet — check back soon.
          </p>
        ) : (
          !session?.user && (
            <p className="text-xs text-muted-foreground">
              Nothing to fill in first — but refreshing mid-test resets your progress.
            </p>
          )
        )}
      </div>

      {test.description && (
        <div className="mt-10 text-pretty text-center text-muted-foreground">
          <KatexContent text={test.description} />
        </div>
      )}

      {/* Show the reward instead of describing it. */}
      <section className="mt-10">
        <h2 className="text-center font-heading text-lg font-semibold">
          What you get the moment you finish
        </h2>
        <SampleResult topics={sampleTopics} />
        <ul className="mt-6 flex flex-col gap-3">
          <Payoff icon={Target}>
            A score per topic — so &ldquo;I&apos;m weak at Physics&rdquo; becomes two specific
            chapters.
          </Payoff>
          <Payoff icon={ListOrdered}>
            A study plan built from your answers: what to fix first, what can wait.
          </Payoff>
          <Payoff icon={MessagesSquare}>
            The option to take the result to someone who&apos;s already cleared this exam. Never
            required.
          </Payoff>
        </ul>
      </section>
    </div>
  );
}

/**
 * A mock of the report, clearly labelled. Uses this test's real topics so it
 * looks like the student's own result, with fixed sample numbers.
 */
function SampleResult({ topics }: { topics: string[] }) {
  const sample = [
    { accuracy: 0.85, tone: "bg-success" },
    { accuracy: 0.5, tone: "bg-highlight" },
    { accuracy: 0.25, tone: "bg-destructive" },
  ];
  const rows = topics.length > 0 ? topics : ["Mechanics", "Optics", "Quantum Mechanics"];

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-sm">
      <p className="mb-4 text-[0.625rem] font-semibold tracking-wide text-muted-foreground uppercase">
        Sample result
      </p>
      <div className="flex items-center gap-5">
        <div className="relative flex size-20 shrink-0 items-center justify-center">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="54" fill="none" stroke="var(--muted)" strokeWidth="12" />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 54}
              strokeDashoffset={2 * Math.PI * 54 * 0.42}
            />
          </svg>
          <span className="absolute font-heading text-lg font-bold tabular-nums">58%</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {rows.map((topic, i) => (
            <div key={topic} className="flex flex-col gap-1">
              <span className="truncate text-xs font-medium">{topic}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", sample[i].tone)}
                  style={{ width: `${sample[i].accuracy * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Payoff({ icon: Icon, children }: { icon: typeof Target; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-[0.9375rem] leading-relaxed">
      <Icon className="mt-0.5 size-4.5 shrink-0 text-primary" />
      <span className="text-pretty">{children}</span>
    </li>
  );
}
