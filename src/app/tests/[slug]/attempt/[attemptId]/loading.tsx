import { Skeleton } from "@/components/ui/skeleton";

/** Test player boot state — mirrors the CBT layout: question column + palette. */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_220px]">
        <div className="space-y-4 rounded-xl bg-card p-6 ring-1 ring-border shadow-sm">
          <Skeleton className="h-3 w-48" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-4/5" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
          <Skeleton className="h-3 w-16" />
          <div className="mt-3 grid grid-cols-5 gap-2 lg:grid-cols-4">
            {Array.from({ length: 20 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-md" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
