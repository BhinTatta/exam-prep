import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/profile/profile-form";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "My profile" };

export default async function ProfilePage() {
  const sessionUser = await requireUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: sessionUser.id },
    select: { name: true, bio: true, image: true, collegeName: true, academicStatus: true },
  });

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <PageHeader title="My profile" description="Your name, bio, and profile picture." />
      <Card>
        <CardContent className="pt-6">
          <ProfileForm
            name={user.name}
            bio={user.bio}
            image={user.image}
            collegeName={user.collegeName}
            academicStatus={user.academicStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
