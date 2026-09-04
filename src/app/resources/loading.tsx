import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonPage, SkeletonHeader, SkeletonList } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeader lines={1} />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded-full" />
        ))}
      </div>
      <div className="mt-8">
        <SkeletonList rows={7} />
      </div>
    </SkeletonPage>
  );
}
