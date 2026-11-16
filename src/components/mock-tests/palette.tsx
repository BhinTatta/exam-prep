import { cn } from "@/lib/utils";
import type { ResponseStatus } from "@/lib/mock-tests/types";

// Shape and colour both change with the state, as on the real exam screen, so
// the palette is still readable without colour vision. These are fixed hues
// rather than theme tokens on purpose: students learn "green = answered,
// purple = review" here and should meet the same thing on exam day.
const SHAPE: Record<ResponseStatus, string> = {
  NOT_VISITED: "rounded-md border border-foreground/25 bg-muted text-foreground",
  // Flat top, pointed bottom.
  NOT_ANSWERED: "bg-red-600 text-white [clip-path:polygon(0_0,100%_0,100%_68%,50%_100%,0_68%)]",
  // Pointed top, flat bottom.
  ANSWERED: "bg-green-600 text-white [clip-path:polygon(50%_0,100%_32%,100%_100%,0_100%,0_32%)]",
  MARKED: "rounded-full bg-violet-600 text-white",
  ANSWERED_MARKED: "rounded-full bg-violet-600 text-white",
};

export const STATUS_LABEL: Record<ResponseStatus, string> = {
  NOT_VISITED: "Not Visited",
  NOT_ANSWERED: "Not Answered",
  ANSWERED: "Answered",
  MARKED: "Marked for Review",
  ANSWERED_MARKED: "Answered & Marked for Review",
};

/** One palette tile: a question number (or a count, in the legend) in its state's shape. */
export function StatusMark({
  status,
  children,
  className,
}: {
  status: ResponseStatus;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-9 shrink-0", className)}>
      <span className={cn("flex size-full items-center justify-center text-sm font-semibold tabular-nums", SHAPE[status])}>
        {children}
      </span>
      {status === "ANSWERED_MARKED" && (
        <span className="absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-background bg-green-500" />
      )}
    </span>
  );
}
