"use client";

import { useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pin, PinOff, Lock, LockOpen, Trash2, Eye, EyeOff, Star } from "lucide-react";
import { pinQuestion, lockQuestion, deleteQuestion, deleteComment } from "@/app/qa/actions";
import { setReviewVisibility } from "@/app/reviews/actions";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

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

type ReviewRow = {
  id: string;
  rating: number;
  comment: string | null;
  published: boolean;
  createdAt: Date;
  mentorId: string;
  author: { name: string | null };
  mentor: { user: { name: string | null } };
};

export function ModerationQueue({
  questions,
  comments,
  reviews,
}: {
  questions: QuestionRow[];
  comments: CommentRow[];
  reviews: ReviewRow[];
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Tabs defaultValue="questions">
      <TabsList>
        <TabsTrigger value="questions">Questions ({questions.length})</TabsTrigger>
        <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
        <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
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

      {/* Reviews hide rather than delete: the student keeps their own words and
          can fix them, and a hide is reversible from this same row. Hiding also
          pulls the stars out of the mentor's public rating — see
          setReviewVisibility. */}
      <TabsContent value="reviews" className="flex flex-col gap-2">
        {reviews.map((r) => (
          <Card key={r.id} className={r.published ? undefined : "opacity-60"}>
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary" className="gap-1">
                    <Star className="fill-highlight text-highlight" /> {r.rating}
                  </Badge>
                  <Link href={`/mentors/${r.mentorId}`} className="text-sm font-medium hover:underline">
                    {r.mentor.user.name}
                  </Link>
                  {!r.published && <Badge variant="outline">Hidden</Badge>}
                </div>
                {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                <p className="mt-1 text-sm text-muted-foreground">
                  {r.author.name} · {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-8 shrink-0",
                  r.published ? "text-destructive hover:text-destructive" : "text-muted-foreground"
                )}
                disabled={isPending}
                aria-label={r.published ? "Hide this review" : "Restore this review"}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      await setReviewVisibility(r.id, !r.published);
                      toast.success(r.published ? "Review hidden" : "Review restored");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Couldn't update that review");
                    }
                  })
                }
              >
                {r.published ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </CardContent>
          </Card>
        ))}
        {reviews.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nothing here.</p>}
      </TabsContent>
    </Tabs>
  );
}
