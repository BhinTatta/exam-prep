import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { ModerationQueue } from "@/components/admin/moderation-queue";
import { loadModerationQueue } from "@/lib/moderation";

// Per-user data behind an auth guard: never prerender or cache this.
export const dynamic = "force-dynamic";

export const metadata = { title: "Moderate" };

export default async function ModeratorPage() {
  await requireRole("MODERATOR");

  const queue = await loadModerationQueue();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Moderation queue" description="Content only — no payments or role management here." />
      <ModerationQueue {...queue} />
    </div>
  );
}
