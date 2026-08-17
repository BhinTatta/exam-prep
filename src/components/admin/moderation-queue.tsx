"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pin, PinOff, Lock, LockOpen, Trash2 } from "lucide-react";
import { pinQuestion, lockQuestion, deleteQuestion, deleteComment } from "@/app/qa/actions";
import { formatDistanceToNow } from "date-fns";

type QuestionRow = {
  id: string;
  title: string;
  pinned: boolean;
  locked: boolean;
  createdAt: Date;
  user: { name: string | null };
};

type CommentRow = {
  id: string;
  body: string;
  questionId: string;
  createdAt: Date;
  user: { name: string | null };
  question: { title: string };
};

export function ModerationQueue({ questions, comments }: { questions: QuestionRow[]; comments: CommentRow[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Tabs defaultValue="questions">
      <TabsList>
        <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
        <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="questions" className="flex flex-col gap-2">
        {questions.map((q) => (
          <Card key={q.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link href={`/qa/${q.id}`} className="truncate font-medium hover:underline">
                  {q.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {q.user.name} · {formatDistanceToNow(q.createdAt, { addSuffix: true })}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={isPending}
                  onClick={() => startTransition(() => pinQuestion(q.id, !q.pinned))}
                >
                  {q.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  disabled={isPending}
                  onClick={() => startTransition(() => lockQuestion(q.id, !q.locked))}
                >
                  {q.locked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive hover:text-destructive"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteQuestion(q.id);
                      toast.success("Question deleted");
                    })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {questions.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
      </TabsContent>

      <TabsContent value="comments" className="flex flex-col gap-2">
        {comments.map((c) => (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm">{c.body}</p>
                <p className="text-sm text-muted-foreground">
                  <Badge variant="outline" className="mr-1 align-middle">
                    {c.question.title}
                  </Badge>
                  {c.user.name} · {formatDistanceToNow(c.createdAt, { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0 text-destructive hover:text-destructive"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await deleteComment(c.id, c.questionId);
                    toast.success("Comment deleted");
                  })
                }
              >
                <Trash2 className="size-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {comments.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
      </TabsContent>
    </Tabs>
  );
}
