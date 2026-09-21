import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
} as const;

/**
 * A read-only rating, rendered to the tenth of a star.
 *
 * Two stacked rows — muted outlines underneath, marigold fills on top clipped
 * to the score — so 4.3 looks like 4.3 rather than being rounded to whatever
 * is easiest to draw. Marigold is the design system's rationed accent; a
 * rating is exactly the kind of thing it is rationed for.
 */
export function Stars({
  value,
  size = "sm",
  className,
  label,
}: {
  value: number;
  size?: keyof typeof SIZES;
  className?: string;
  /** Override the accessible name, e.g. "Your rating: 4 out of 5". */
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(5, value));
  const star = cn(SIZES[size], "shrink-0");

  return (
    <span
      role="img"
      aria-label={label ?? `${clamped.toFixed(1)} out of 5 stars`}
      // `w-fit` is load-bearing: as a child of a column flex container this
      // span would otherwise stretch to the container's width, and the overlay
      // below is clipped to a *percentage* of it — a 4-star rating would fill
      // all five stars because 80% of a 600px row is wider than five icons.
      className={cn("relative inline-flex w-fit shrink-0 align-middle", className)}
    >
      <span aria-hidden className="flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(star, "text-muted-foreground/30")} />
        ))}
      </span>
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden"
        style={{ width: `${(clamped / 5) * 100}%` }}
      >
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={cn(star, "fill-highlight text-highlight")} />
        ))}
      </span>
    </span>
  );
}
