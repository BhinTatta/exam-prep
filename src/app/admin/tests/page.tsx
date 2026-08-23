import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList } from "lucide-react";
import { TestFormDialog } from "@/components/admin/test-form-dialog";

export const metadata = { title: "Assessment tests" };
export const dynamic = "force-dynamic";

export default async function AdminTestsPage() {
  const tests = await prisma.test.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });

  return (
    <div>
      <PageHeader
        title="Assessment tests"
        description="Diagnostic tests users can take without logging in. Question content is managed per test."
        action={<TestFormDialog mode="create" />}
      />

      {tests.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No tests yet"
          description="Create the first diagnostic test, e.g. the JAM Physics diagnostic."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tests.map((t) => (
            <Link key={t.id} href={`/admin/tests/${t.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">{t.title}</CardTitle>
                    <Badge variant={t.published ? "default" : "secondary"}>
                      {t.published ? "Published" : "Draft"}
                    </Badge>
                  </div>
                  <CardDescription>/tests/{t.slug}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
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
