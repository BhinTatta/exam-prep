import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Stars } from "@/components/reviews/stars";
import { ReportButton } from "@/components/report-button";
import { reviewerName } from "@/lib/reviews";
import { cn } from "@/lib/utils";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  author: { name: string | null; image: string | null };
};

/**
 * One student's verdict.
 *
 * Deliberately not a card. The profile already leads with the mentor's own
 * quote in a hairline-ruled blockquote, and a testimonial is the same gesture
 * from the other side of the call — boxing these would turn the page into a
 * grid of containers and flatten the difference between what the mentor says
 * about themselves and what a student says about them. A rating with no words
 * drops the quote entirely and renders as a single line, because padding
 * around an empty quote is how a page starts looking padded out.
 */
export function ReviewQuote({
  review,
  canReport = false,
  className,
}: {
  review: ReviewItem;
  canReport?: boolean;
  className?: string;
}) {
  const name = reviewerName(review.author.name);
  const when = formatDistanceToNow(review.createdAt, { addSuffix: true });

  const byline = (
    <>
      <Avatar className="size-7 shrink-0">
        <AvatarImage src={review.author.image ?? undefined} alt="" />
        <AvatarFallback className="bg-accent text-[0.6875rem] font-semibold text-accent-foreground">
          {name.slice(0, 1)}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-sm font-medium">{name}</span>
      <span aria-hidden className="text-muted-foreground/50">
        ·
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{when}</span>
    </>
  );

  if (!review.comment) {
    return (
      <div className={cn("group flex items-center gap-2 py-1", className)}>
        {byline}
        <Stars value={review.rating} className="ml-auto shrink-0" />
        {canReport && <ReportBadge id={review.id} />}
      </div>
    );
  }

  return (
    <article className={cn("group flex flex-col gap-2.5 border-l-2 border-primary/25 pl-4", className)}>
      <Stars value={review.rating} size="md" />
      <blockquote className="text-[0.9375rem] leading-relaxed text-pretty">
        &ldquo;{review.comment}&rdquo;
      </blockquote>
      <footer className="flex items-center gap-2">
        {byline}
        {canReport && <ReportBadge id={review.id} className="ml-auto" />}
      </footer>
    </article>
  );
}

/** Kept out of the way until the row is hovered or something in it is focused. */
function ReportBadge({ id, className }: { id: string; className?: string }) {
  return (
    <ReportButton
      targetType="REVIEW"
      targetId={id}
      className={cn(
        "size-7 shrink-0 text-muted-foreground opacity-0 transition-opacity",
        "group-hover:opacity-100 focus-visible:opacity-100 hover:text-destructive",
        className
      )}
    />
  );
}
