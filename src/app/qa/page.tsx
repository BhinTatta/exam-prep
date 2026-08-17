import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessagesSquare, Plus, Pin, Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Q&A" };
export const dynamic = "force-dynamic";

export default async function QAPage() {
  const questions = await prisma.question.findMany({
    where: { deleted: false },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { name: true, image: true } }, _count: { select: { comments: true } } },
    take: 50,
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        title="Community Q&A"
        description="Ask anything physics — full LaTeX support, or ping ChatGPT for a first pass."
        action={
          <Link href="/qa/new">
            <Button className="gap-1.5">
              <Plus className="size-4" /> Ask a question
            </Button>
          </Link>
        }
      />

      {questions.length === 0 ? (
        <EmptyState icon={MessagesSquare} title="No questions yet" description="Be the first to ask one." />
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q) => (
            <Link key={q.id} href={`/qa/${q.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-start gap-3 space-y-0">
                  <Avatar className="size-8">
                    <AvatarImage src={q.user.image ?? undefined} />
                    <AvatarFallback>{(q.user.name ?? "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      {q.pinned && <Pin className="size-3.5 text-primary" />}
                      {q.locked && <Lock className="size-3.5 text-muted-foreground" />}
                      <h3 className="font-medium leading-snug">{q.title}</h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {q.user.name} · {formatDistanceToNow(q.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex items-center gap-2 pt-0">
                  <Badge variant="secondary">{q.subject}</Badge>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MessagesSquare className="size-3.5" /> {q._count.comments}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
