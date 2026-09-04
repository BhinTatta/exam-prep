import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonHeader } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeader lines={2} />
      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 rounded-xl bg-card p-6 ring-1 ring-border shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-4">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="mt-2 h-10 w-40 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}
