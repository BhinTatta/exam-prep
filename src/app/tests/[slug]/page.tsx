import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { KatexContent } from "@/components/katex-content";
import { StartTestButton } from "@/components/assessment/start-test-button";
import { Clock, ListChecks, Target, Sparkles, Users, LogIn } from "lucide-react";

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
      include: { _count: { select: { questions: { where: { section: "CONTENT", isActive: true } } } } },
    }),
    auth(),
  ]);

  if (!test || !test.published) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Badge variant="secondary" className="gap-1.5 px-3 py-1">
          <Sparkles className="size-3.5" /> Free — no account required
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{test.title}</h1>
        {test.description && (
          <div className="max-w-xl text-muted-foreground">
            <KatexContent text={test.description} />
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Clock} label="Duration" value={`${test.durationMinutes} min`} />
        <StatCard icon={ListChecks} label="Questions" value={`${test._count.questions.toString()} scored`} />
        <StatCard icon={Target} label="You get" value="Score + study plan" />
      </div>

      <Card className="mt-6">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">A real topic-by-topic breakdown</p>
              <p className="text-sm text-muted-foreground">
                Not just a score — where you&apos;re strong, where you&apos;re weak, and a study plan built from it.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-medium">Matched to a mentor if it&apos;ll help</p>
              <p className="text-sm text-muted-foreground">
                If a topic is genuinely holding you back, we&apos;ll point you to a verified mentor who&apos;s strong there — never required.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {!session?.user && (
        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <LogIn className="size-3.5 shrink-0" /> No login needed — but refreshing mid-test resets your progress.
        </p>
      )}

      <div className="mt-8 flex justify-center">
        <StartTestButton
          testId={test.id}
          slug={test.slug}
          utm={{ source: utm.utm_source, medium: utm.utm_medium, campaign: utm.utm_campaign }}
          disabled={test._count.questions === 0}
        />
      </div>
      {test._count.questions === 0 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          This test has no active questions yet — check back soon.
        </p>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1.5 py-6 text-center">
        <Icon className="size-5 text-primary" />
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}
