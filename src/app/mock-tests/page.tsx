import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMarks } from "@/lib/mock-tests/scoring";
import { ArrowRight, BarChart3, Clock, FileText, ListChecks, Trophy } from "lucide-react";

export const metadata = {
  title: "Free Mock Tests",
  description:
    "Full-length mock tests in the real exam interface — MCQ, MSQ and NAT, on-screen calculator, question palette and a running clock. Free.",
};
export const dynamic = "force-dynamic";

export default async function MockTestsPage() {
  const tests = await prisma.mockTest.findMany({
    where: { published: true },
    orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    include: { questions: { select: { marks: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Free mock tests"
        description="Full papers in the real exam interface — same sections, same marking, same clock. Sign in and sit one."
        action={
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">
              <BarChart3 /> My progress
            </Link>
          </Button>
        }
      />

      {tests.length === 0 ? (
        <EmptyState icon={FileText} title="No mock tests published yet" description="Check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <Link key={t.id} href={`/mock-tests/${t.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle>{t.title}</CardTitle>
                    <Badge variant="secondary">{t.year ? `${t.exam} ${t.year}` : t.exam}</Badge>
                  </div>
                  {t.description && <CardDescription className="line-clamp-2">{t.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {t.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="size-3.5" /> {t.questions.length} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Trophy className="size-3.5" /> {formatMarks(t.questions.reduce((n, q) => n + q.marks, 0))} marks
                    </span>
                  </div>
                  <ArrowRight className="size-4 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
