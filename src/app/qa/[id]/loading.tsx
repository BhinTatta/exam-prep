import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="max-w-3xl">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-full" />
      <Skeleton className="mt-2 h-8 w-3/4" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="mt-6 space-y-3 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <Skeleton className="mt-8 h-5 w-32" />
      <div className="mt-4 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
