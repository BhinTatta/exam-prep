import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MentorApprovalCard } from "@/components/admin/mentor-approval-card";
import { UserCheck } from "lucide-react";

export const metadata = { title: "Mentor approvals" };

export default async function AdminMentorsPage() {
  const pending = await prisma.mentorProfile.findMany({
    where: { verified: false },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader title="Mentor approvals" description="Review proof documents before going live." />
      {pending.length === 0 ? (
        <EmptyState icon={UserCheck} title="Nothing pending" description="All mentor applications are handled." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pending.map((p) => (
            <MentorApprovalCard key={p.id} profile={p} />
          ))}
        </div>
      )}
    </div>
  );
}
