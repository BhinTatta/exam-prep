import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { hasRole } from "@/lib/auth-helpers";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { KatexContent } from "@/components/katex-content";
import { CommentForm } from "@/components/qa/comment-form";
import { CommentItem } from "@/components/qa/comment-item";
import { QuestionModActions } from "@/components/qa/question-mod-actions";
import { ReportButton } from "@/components/report-button";
import { chatGptDeepLink } from "@/config/site";
import { formatDistanceToNow } from "date-fns";
import { Bot, Lock, Pin } from "lucide-react";
import Link from "next/link";

export default async function QuestionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, image: true } },
      comments: {
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        include: {
          user: { select: { name: true, image: true } },
          votes: session?.user ? { where: { userId: session.user.id } } : false,
        },
      },
    },
  });

  if (!question || question.deleted) notFound();

  const canModerate = hasRole(session?.user?.role, "MODERATOR");

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
          <div className="flex items-start gap-3">
            <Avatar className="size-9">
              <AvatarImage src={question.user.image ?? undefined} />
              <AvatarFallback>{(question.user.name ?? "U").slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-1.5">
                {question.pinned && <Pin className="size-3.5 text-primary" />}
                {question.locked && <Lock className="size-3.5 text-muted-foreground" />}
                <h1 className="text-lg font-semibold leading-snug">{question.title}</h1>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {question.user.name} · {formatDistanceToNow(question.createdAt, { addSuffix: true })} ·{" "}
                <Badge variant="secondary" className="align-middle">
                  {question.subject}
                </Badge>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {session?.user && <ReportButton targetType="QUESTION" targetId={question.id} />}
            {canModerate && <QuestionModActions id={question.id} pinned={question.pinned} locked={question.locked} />}
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <KatexContent text={question.body} className="text-sm leading-relaxed" />
          {question.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={question.imageUrl} alt="Question attachment" className="max-h-96 rounded-md border object-contain" />
          )}
          <a href={chatGptDeepLink(`${question.title}\n\n${question.body}`)} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Bot className="size-4" /> Ask ChatGPT
            </Button>
          </a>
        </CardContent>
      </Card>

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">
          {question.comments.length} {question.comments.length === 1 ? "reply" : "replies"}
        </h2>
        <Card>
          <CardContent className="pt-2">
            {question.comments.map((c) => (
              <CommentItem
                key={c.id}
                comment={c}
                questionId={question.id}
                hasUpvoted={Array.isArray(c.votes) && c.votes.length > 0}
                canModerate={canModerate}
                canReport={!!session?.user}
              />
            ))}
            {question.comments.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">No replies yet — be the first.</p>
            )}
          </CardContent>
        </Card>

        <div className="mt-4">
          {question.locked ? (
            <p className="text-sm text-muted-foreground">This thread is locked. No new replies.</p>
          ) : session?.user ? (
            <CommentForm questionId={question.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              <Link href="/sign-in" className="text-primary hover:underline">
                Sign in
              </Link>{" "}
              to reply.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
