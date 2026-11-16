import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportMockTestDialog } from "@/components/admin/mock-test-actions";
import { FileText } from "lucide-react";

export const metadata = { title: "Mock tests" };
export const dynamic = "force-dynamic";

export default async function AdminMockTestsPage() {
  const tests = await prisma.mockTest.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Mock tests"
        description="Full-length papers students sit in the exam interface. Papers are imported from a JSON file."
        action={<ImportMockTestDialog />}
      />

      {tests.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No mock tests yet"
          description="Import a paper file to create the first one — content/mock-tests has a demo to start from."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Link key={t.id} href={`/admin/mock-tests/${t.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <Badge variant={t.published ? "default" : "secondary"}>{t.published ? "Published" : "Draft"}</Badge>
                  </div>
                  <CardDescription>/mock-tests/{t.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span>{t._count.questions} questions</span>
                  <span>{t._count.attempts} attempts</span>
                  <span>{t.durationMinutes} min</span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
