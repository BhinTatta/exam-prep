import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MentorApprovalCard } from "@/components/admin/mentor-approval-card";
import { MentorOrderList } from "@/components/admin/mentor-order-list";
import { UserCheck } from "lucide-react";

export const metadata = { title: "Mentors" };

export default async function AdminMentorsPage() {
  // Two independent reads, one round trip.
  const [pending, verified] = await Promise.all([
    prisma.mentorProfile.findMany({
      where: { verified: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.mentorProfile.findMany({
      where: { verified: true },
      select: {
        id: true,
        rank: true,
        examCleared: true,
        examYear: true,
        currentRole: true,
        institute: true,
        displayOrder: true,
        reviewCount: true,
        user: { select: { name: true } },
      },
      // Pinned mentors in their pinned order, then the rest — the same
      // precedence the public listings apply.
      orderBy: [{ displayOrder: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <div className="flex flex-col gap-10">
      <section>
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
      </section>

      {/* Second section, so a plain heading rather than another PageHeader —
          one <h1> per page. */}
      <section>
        <div className="mb-6">
          <h2 className="text-xl font-bold tracking-tight">Listing order</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pin the mentors you want students to see first. Anyone unpinned keeps the automatic
            order — soonest open slot first.
          </p>
        </div>
        {verified.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="No verified mentors yet"
            description="Approve a mentor above and they'll show up here."
          />
        ) : (
          <MentorOrderList mentors={verified} />
        )}
      </section>
    </div>
  );
}
