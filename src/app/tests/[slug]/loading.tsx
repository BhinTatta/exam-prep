import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="max-w-3xl">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-9 w-3/4" />
      <Skeleton className="mt-3 h-4 w-full" />
      <Skeleton className="mt-2 h-4 w-5/6" />

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-4 ring-1 ring-border shadow-sm">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-6 w-12" />
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3 rounded-xl bg-card p-6 ring-1 ring-border shadow-sm">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <Skeleton className="mt-8 h-11 w-48 rounded-full" />
    </SkeletonPage>
  );
}
