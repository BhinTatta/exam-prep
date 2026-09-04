import { SkeletonPage, SkeletonHeader, SkeletonCardGrid } from "@/components/skeletons";

export default function Loading() {
  return (
    <SkeletonPage>
      <SkeletonHeader lines={1} />
      <div className="mt-8">
        <SkeletonCardGrid count={6} />
      </div>
    </SkeletonPage>
  );
}
