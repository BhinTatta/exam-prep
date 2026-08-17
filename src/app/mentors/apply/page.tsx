import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { MentorApplyForm } from "@/components/mentors/mentor-apply-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Become a mentor" };

export default async function MentorApplyPage() {
  const user = await requireUser();
  const existing = await prisma.mentorProfile.findUnique({ where: { userId: user.id } });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader
        title="Become a mentor"
        description="Manual verification by an admin — usually within a couple of days."
      />

      {existing ? (
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="font-medium">You&apos;ve already applied</p>
              <p className="text-sm text-muted-foreground">{existing.institute}</p>
            </div>
            <Badge variant={existing.verified ? "default" : "secondary"}>
              {existing.verified ? "Verified" : "Pending review"}
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <MentorApplyForm />
      )}
    </div>
  );
}
