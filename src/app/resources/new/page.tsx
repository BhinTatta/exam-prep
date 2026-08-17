import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { ResourceForm } from "@/components/resources/resource-form";

export const metadata = { title: "Add resource" };

export default async function NewResourcePage() {
  await requireRole("MODERATOR");

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader title="Add a resource" description="Visible to everyone immediately." />
      <ResourceForm />
    </div>
  );
}
