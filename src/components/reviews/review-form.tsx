"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Stars } from "@/components/reviews/stars";
import { StarInput } from "@/components/reviews/star-input";
import { submitReview } from "@/app/reviews/actions";
import { COMMENT_PROMPTS, MAX_COMMENT_LENGTH, RATING_LABELS } from "@/lib/reviews";
import { cn } from "@/lib/utils";

export type ExistingReview = {
  rating: number;
  comment: string | null;
  published: boolean;
};

/**
 * Rating a session you took.
 *
 * The comment box is withheld until a star is picked. The ask is then one tap
 * — which almost everyone will do — and the writing, which most people won't,
 * is offered only once they're already committed. Asking for both at once is
 * how you get neither.
 */
export function ReviewForm({
  bookingId,
  mentorName,
  existing = null,
  className,
}: {
  bookingId: string;
  /** First name — the question reads better as "How was it with Ananya?". */
  mentorName: string;
  existing?: ExistingReview | null;
  className?: string;
}) {
  const [editing, setEditing] = useState(!existing);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    if (rating === 0) {
      toast.error("Pick a star rating first");
      return;
    }
    startTransition(async () => {
      try {
        await submitReview({ bookingId, rating, comment: comment.trim() });
        toast.success(existing ? "Review updated" : "Thanks — your feedback is live on their profile");
        setEditing(false);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Couldn't save your review");
      }
    });
  }

  // Already reviewed and not editing: show it back to them, exactly as a
  // future student will read it.
  if (existing && !editing) {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={existing.rating} size="md" label={`You rated this ${existing.rating} out of 5`} />
          <span className="text-sm font-medium">{RATING_LABELS[existing.rating]}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-muted-foreground"
            onClick={() => setEditing(true)}
          >
            <Pencil /> Edit
          </Button>
        </div>

        {existing.comment && (
          <blockquote className="border-l-2 border-primary/30 pl-3 text-sm leading-relaxed text-pretty italic">
            &ldquo;{existing.comment}&rdquo;
          </blockquote>
        )}

        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {existing.published ? (
            <>
              <Check className="size-3.5 text-success" />
              Live on {mentorName}&apos;s profile.
            </>
          ) : (
            <>
              <EyeOff className="size-3.5" />
              Hidden by a moderator. {mentorName} and future students can&apos;t see it.
            </>
          )}
        </p>
      </div>
    );
  }

  const remaining = MAX_COMMENT_LENGTH - comment.length;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <StarInput value={rating} onChange={setRating} disabled={isPending} />

      {rating > 0 && (
        <div className="flex flex-col gap-2 duration-200 animate-in fade-in slide-in-from-top-1">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder={COMMENT_PROMPTS[rating]}
            rows={3}
            disabled={isPending}
            aria-label="What you'd tell another student about this session"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Optional — posted publicly under your first name.
            </p>
            <span
              className={cn(
                "shrink-0 text-xs tabular-nums",
                remaining <= 50 ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {remaining}
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="lg"
          emphasis={rating > 0 ? "lift" : "none"}
          disabled={rating === 0}
          loading={isPending}
          loadingText="Saving…"
          onClick={save}
        >
          {existing ? "Update review" : "Post review"}
        </Button>
        {existing && (
          <Button
            variant="ghost"
            size="lg"
            disabled={isPending}
            onClick={() => {
              setRating(existing.rating);
              setComment(existing.comment ?? "");
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
