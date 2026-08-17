import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Users, IndianRupee } from "lucide-react";

export const metadata = { title: "Mentors" };
export const dynamic = "force-dynamic";

export default async function MentorsPage() {
  const mentors = await prisma.mentorProfile.findMany({
    where: { verified: true },
    include: { user: { select: { name: true, image: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader
        title="Mentors"
        description="Verified mentors offering 1:1 sessions. Manual UPI payment, Jitsi video call."
        action={
          <Link href="/mentors/apply">
            <Button variant="outline">Become a mentor</Button>
          </Link>
        }
      />

      {mentors.length === 0 ? (
        <EmptyState icon={Users} title="No verified mentors yet" description="Check back soon." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mentors.map((m) => (
            <Link key={m.id} href={`/mentors/${m.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <Avatar className="size-10">
                    <AvatarImage src={m.user.image ?? undefined} />
                    <AvatarFallback>{(m.user.name ?? "M").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{m.user.name}</CardTitle>
                    <CardDescription>{m.institute}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    {m.subjects.map((s) => (
                      <Badge key={s} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                  <p className="flex items-center gap-1 text-sm font-medium">
                    <IndianRupee className="size-3.5" /> {m.rate} / session
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
