import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth-helpers";
import { hasRole } from "@/lib/roles";
import { finalizeIfExpired } from "@/lib/mock-tests/attempts";
import { formatMarks } from "@/lib/mock-tests/scoring";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamInstructions, buildPattern } from "@/components/mock-tests/instructions";
import { StartMockButton } from "@/components/mock-tests/start-mock-button";
import { ArrowRight, Clock, ListChecks, Trophy } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = await prisma.mockTest.findUnique({ where: { slug }, select: { title: true, description: true } });
  return { title: test ? `${test.title} — Mock Test` : "Mock Test", description: test?.description ?? undefined };
}

export default async function MockTestIntroPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [test, session] = await Promise.all([
    prisma.mockTest.findUnique({
      where: { slug },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: { questions: { select: { number: true, type: true, marks: true, negativeMarks: true } } },
        },
      },
    }),
    getSession(),
  ]);
  // Admins can open a draft to proof-read it before publishing.
  if (!test || (!test.published && !hasRole(session?.user?.role, "ADMIN"))) notFound();

  const pattern = buildPattern(test.sections);
  const questionCount = test.sections.reduce((n, s) => n + s.questions.length, 0);
  const totalMarks = test.sections.reduce((n, s) => n + s.questions.reduce((m, q) => m + q.marks, 0), 0);

  let attempts = session?.user
    ? await prisma.mockAttempt.findMany({
        where: { testId: test.id, userId: session.user.id },
        orderBy: { startedAt: "desc" },
        take: 10,
      })
    : [];
  // Close anything whose clock ran out while the student was away, so the
  // list never offers to "resume" a paper with no time left.
  if ((await Promise.all(attempts.map(finalizeIfExpired))).some(Boolean)) {
    attempts = await prisma.mockAttempt.findMany({
      where: { testId: test.id, userId: session!.user!.id },
      orderBy: { startedAt: "desc" },
      take: 10,
    });
  }
  const running = attempts.find((a) => a.status === "IN_PROGRESS");
  const finishedAttempts = attempts.filter((a) => a.status === "SUBMITTED");

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge variant="secondary" className="px-3 py-1">
          {test.year ? `${test.exam} ${test.year}` : test.exam} · Free mock test
        </Badge>
        {!test.published && <Badge variant="outline">Draft — only admins can see this</Badge>}
        <h1 className="text-balance font-heading text-3xl font-bold tracking-tight sm:text-4xl">{test.title}</h1>
        {test.description && <p className="max-w-xl text-pretty text-muted-foreground">{test.description}</p>}

        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4 text-primary" /> {test.durationMinutes} minutes
          </span>
          <span className="flex items-center gap-1.5">
            <ListChecks className="size-4 text-primary" /> {questionCount} questions
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-4 text-primary" /> {formatMarks(totalMarks)} marks
          </span>
        </div>

        <div className="mt-2 flex w-full flex-col items-center gap-2">
          {questionCount === 0 ? (
            <p className="text-sm text-muted-foreground">This paper has no questions yet — check back soon.</p>
          ) : session?.user ? (
            <>
              <StartMockButton testId={test.id} resume={Boolean(running)} />
              <p className="text-xs text-muted-foreground">
                {running
                  ? "You have a paper in progress — its clock is still running."
                  : "The clock starts the moment you press this and does not pause."}
              </p>
            </>
          ) : (
            <>
              <Button asChild size="hero" emphasis="glow" className="w-full sm:w-auto">
                <Link href={`/sign-in?callbackUrl=${encodeURIComponent(`/mock-tests/${test.slug}`)}`}>
                  Sign in to start <ArrowRight />
                </Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Free. An account is what lets you resume a paper and keep your scorecards.
              </p>
            </>
          )}
        </div>
      </div>

      {finishedAttempts.length > 0 && (
        <section className="mt-10">
          <h2 className="font-heading text-lg font-semibold">Your attempts</h2>
          <ul className="mt-3 divide-y rounded-lg border">
            {finishedAttempts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/mock-tests/${test.slug}/attempt/${a.id}/result`}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50"
                >
                  <span className="text-muted-foreground">
                    {(a.submittedAt ?? a.startedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                  <span className="flex items-center gap-2 font-medium tabular-nums">
                    {formatMarks(a.score ?? 0)} / {formatMarks(a.maxScore ?? 0)}
                    <ArrowRight className="size-4 text-muted-foreground" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="mb-4 font-heading text-lg font-semibold">Before you start</h2>
        <ExamInstructions durationMinutes={test.durationMinutes} calculator={test.calculator} pattern={pattern} />
      </section>
    </div>
  );
}
