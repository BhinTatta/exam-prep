import { Star } from "lucide-react";
import { Stars } from "@/components/reviews/stars";
import { averageRating, formatRating, type RatingRollup } from "@/lib/reviews";
import { cn } from "@/lib/utils";

/**
 * The rating, written out. Reads straight off the mentor's rollup columns, so
 * a page showing twenty of these still runs zero extra queries.
 */
export function RatingSummary({ rollup, className }: { rollup: RatingRollup; className?: string }) {
  const average = averageRating(rollup);

  if (average === null) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        No ratings yet — you could be the first to leave one.
      </p>
    );
  }

  return (
    <div className={cn("flex items-baseline gap-2.5", className)}>
      {/* Not tabular: tabular figures give the decimal point a full digit
          cell, which reads as "5 . 0" at this size. Column alignment is a
          listing concern, and there is only ever one of these on a page. */}
      <span className="font-heading text-3xl leading-none font-bold tracking-tight">
        {formatRating(average)}
      </span>
      <div className="flex flex-col gap-1">
        <Stars value={average} size="md" />
        <span className="text-xs text-muted-foreground">
          {rollup.reviewCount} {rollup.reviewCount === 1 ? "student" : "students"} rated their session
        </span>
      </div>
    </div>
  );
}

/**
 * The same number at listing scale: one star, one figure, no row of icons.
 * Five stars in a card competes with the credential strip next to it, and the
 * credential is what a student is actually deciding on.
 */
export function RatingChip({ rollup, className }: { rollup: RatingRollup; className?: string }) {
  const average = averageRating(rollup);
  if (average === null) return null;

  return (
    <span
      className={cn("flex items-center gap-1 font-medium text-foreground", className)}
      title={`${formatRating(average)} out of 5 from ${rollup.reviewCount} rated sessions`}
    >
      <Star className="size-3.5 fill-highlight text-highlight" />
      <span className="tabular-nums">{formatRating(average)}</span>
      <span className="font-normal text-muted-foreground tabular-nums">({rollup.reviewCount})</span>
    </span>
  );
}
