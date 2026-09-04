import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonHeader, SkeletonList } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeader lines={1} />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-card p-5 ring-1 ring-border shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 h-5 w-40" />
      <div className="mt-4">
        <SkeletonList rows={5} />
      </div>
    </SkeletonPage>
  );
}
