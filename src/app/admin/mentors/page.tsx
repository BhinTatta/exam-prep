import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { MentorApprovalCard } from "@/components/admin/mentor-approval-card";
import { FeaturedMentors } from "@/components/admin/featured-mentors";
import { UserCheck, Users } from "lucide-react";

export const metadata = { title: "Mentors" };

export default async function AdminMentorsPage() {
  const [pending, verified] = await Promise.all([
    prisma.mentorProfile.findMany({
      where: { verified: false },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    // Same order the home page fills from, so this list reads as "who is on
    // the front page, and who is next in line if you unpin someone".
    prisma.mentorProfile.findMany({
      where: { verified: true },
      select: {
        id: true,
        featuredRank: true,
        reviewCount: true,
        ratingScore: true,
        paidSessions: true,
        examCleared: true,
        user: { select: { name: true, image: true } },
      },
      orderBy: [
        { featuredRank: { sort: "asc", nulls: "last" } },
        { ratingScore: "desc" },
        { paidSessions: "desc" },
      ],
    }),
  ]);

  return (
    <div className="flex flex-col gap-12">
      <section>
        <PageHeader
          title="Mentor approvals"
          description="Review proof documents before going live."
        />
        {pending.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nothing pending"
            description="All mentor applications are handled."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {pending.map((p) => (
              <MentorApprovalCard key={p.id} profile={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        {/* Not a PageHeader: that renders an h1, and this page already has one. */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight">Home page lineup</h2>
          <p className="mt-1 text-muted-foreground">
            The home page shows three mentors: anyone pinned here first, in the rank you give them,
            then whoever has the highest weighted rating. Pin nothing and the ranking decides on its
            own — that is the intended default, not a fallback.
          </p>
        </div>
        {verified.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No verified mentors yet"
            description="Approve an application above and they'll show up here."
          />
        ) : (
          <FeaturedMentors mentors={verified} />
        )}
      </section>
    </div>
  );
}
