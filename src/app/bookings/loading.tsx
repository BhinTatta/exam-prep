import { SkeletonPage, SkeletonHeader, SkeletonList } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage className="max-w-3xl">
      <SkeletonHeader lines={1} />
      <div className="mt-8">
        <SkeletonList rows={5} />
      </div>
    </SkeletonPage>
  );
}
