"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ArrowBigUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { KatexContent } from "@/components/katex-content";
import { toggleUpvote, deleteComment } from "@/app/qa/actions";
import { cn } from "@/lib/utils";

export function CommentItem({
  comment,
  questionId,
  hasUpvoted,
  canModerate,
}: {
  comment: { id: string; body: string; upvotes: number; createdAt: Date; user: { name: string | null; image: string | null } };
  questionId: string;
  hasUpvoted: boolean;
  canModerate: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex gap-3 border-b py-4 last:border-0">
      <Avatar className="size-8">
        <AvatarImage src={comment.user.image ?? undefined} />
        <AvatarFallback>{(comment.user.name ?? "U").slice(0, 1)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">
            {comment.user.name}{" "}
            <span className="font-normal text-muted-foreground">
              · {formatDistanceToNow(comment.createdAt, { addSuffix: true })}
            </span>
          </p>
          {canModerate && (
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-destructive"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteComment(comment.id, questionId);
                  toast.success("Comment removed");
                })
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
        </div>
        <KatexContent text={comment.body} className="mt-1 text-sm" />
        <Button
          variant="ghost"
          size="sm"
          disabled={isPending}
          className={cn("mt-1 h-7 gap-1 px-2 text-xs", hasUpvoted && "text-primary")}
          onClick={() =>
            startTransition(async () => {
              await toggleUpvote(comment.id, questionId);
            })
          }
        >
          <ArrowBigUp className={cn("size-3.5", hasUpvoted && "fill-primary")} /> {comment.upvotes}
        </Button>
      </div>
    </div>
  );
}
