import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonList } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      </div>
      <div className="mt-8">
        <SkeletonList rows={8} />
      </div>
    </SkeletonPage>
  );
}
