import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Page shell matching the app's standard centered container. */
export function SkeletonPage({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-12", className)}>
      {children}
    </div>
  );
}

/** Title + supporting line. */
export function SkeletonHeader({ lines = 1 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-64 max-w-[70%]" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-4 w-96 max-w-[90%]" />
      ))}
    </div>
  );
}

/** A card-shaped block. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm",
        className,
      )}
    >
      <Skeleton className="size-10 rounded-lg" />
      <Skeleton className="h-5 w-3/5" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
}

/** Responsive grid of card skeletons. */
export function SkeletonCardGrid({
  count = 6,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Stacked list rows. */
export function SkeletonList({
  rows = 6,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 rounded-xl bg-card p-4 ring-1 ring-border shadow-sm"
        >
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <Skeleton className="hidden h-8 w-20 shrink-0 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Table-ish rows with a header. */
export function SkeletonTable({
  rows = 8,
  cols = 4,
}: {
  rows?: number;
  cols?: number;
}) {
  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-border shadow-sm">
      <div
        className="grid gap-4 border-b bg-muted/40 px-4 py-3"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid gap-4 border-b px-4 py-3 last:border-0"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4" style={{ width: `${55 + ((r + c) % 4) * 10}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}
