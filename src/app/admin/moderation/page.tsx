import { PageHeader } from "@/components/page-header";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { loadModerationQueue } from "@/lib/moderation";

export const metadata = { title: "Moderation" };

export default async function AdminModerationPage() {
  const queue = await loadModerationQueue();

  return (
    <div>
      <PageHeader
        title="Moderation"
        description="Latest questions, comments and session reviews across the platform."
      />
      <ModerationQueue {...queue} />
    </div>
  );
}
