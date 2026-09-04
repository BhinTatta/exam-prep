import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="max-w-4xl">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-8 w-2/3" />

      {/* verdict header */}
      <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-xl ring-1 ring-border shadow-sm">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border-r bg-card p-5 last:border-0">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-8 w-24" />
          </div>
        ))}
      </div>

      {/* topic breakdown */}
      <Skeleton className="mt-10 h-5 w-48" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid grid-cols-[160px_1fr_48px] items-center gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>

      {/* study plan */}
      <Skeleton className="mt-10 h-5 w-40" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
