import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="max-w-4xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="mt-6 h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="space-y-3 rounded-xl bg-card p-5 ring-1 ring-border shadow-sm">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-full" />
        </div>
      </div>
    </SkeletonPage>
  );
}
