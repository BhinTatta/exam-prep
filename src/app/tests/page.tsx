import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, ListChecks, ClipboardList, ArrowRight } from "lucide-react";

export const metadata = { title: "Diagnostic Tests" };
export const dynamic = "force-dynamic";

export default async function TestsPage() {
  const tests = await prisma.test.findMany({
    where: { published: true },
    include: { _count: { select: { questions: { where: { section: "CONTENT", isActive: true } } } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Free diagnostic tests"
        description="No account needed. See exactly where you stand, topic by topic, in one sitting."
      />

      {tests.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No tests published yet" description="Check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tests.map((t) => (
            <Link key={t.id} href={`/tests/${t.slug}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{t.title}</CardTitle>
                    <Badge variant="secondary">Free</Badge>
                  </div>
                  {t.description && <CardDescription>{t.description}</CardDescription>}
                </CardHeader>
                <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" /> {t.durationMinutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <ListChecks className="size-3.5" /> {t._count.questions} questions
                    </span>
                  </div>
                  <ArrowRight className="size-4" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
