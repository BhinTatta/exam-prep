import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { IndianRupee } from "lucide-react";
import { DAYS } from "@/lib/days";
import { bookSlot } from "@/app/mentors/actions";

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  const mentor = await prisma.mentorProfile.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, image: true } },
      availability: { where: { isBooked: false }, orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
    },
  });

  if (!mentor || !mentor.verified) notFound();

  const isOwnProfile = session?.user?.id === mentor.userId;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader className="flex-row items-center gap-4 space-y-0">
          <Avatar className="size-14">
            <AvatarImage src={mentor.user.image ?? undefined} />
            <AvatarFallback className="text-lg">{(mentor.user.name ?? "M").slice(0, 1)}</AvatarFallback>
          </Avatar>
          <div>
            <CardTitle className="text-xl">{mentor.user.name}</CardTitle>
            <CardDescription>{mentor.institute}{mentor.rank ? ` · ${mentor.rank}` : ""}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {mentor.subjects.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
          {mentor.bio && <p className="text-sm text-muted-foreground">{mentor.bio}</p>}
          <p className="flex items-center gap-1 text-lg font-semibold">
            <IndianRupee className="size-4" /> {mentor.rate}
            <span className="text-sm font-normal text-muted-foreground"> / session</span>
          </p>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 font-medium">Available slots</h2>
      {mentor.availability.length === 0 ? (
        <p className="text-sm text-muted-foreground">No open slots right now — check back later.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {mentor.availability.map((slot) => (
            <form key={slot.id} action={bookSlot.bind(null, mentor.id, slot.id)}>
              <Card>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{DAYS[slot.dayOfWeek]}</p>
                    <p className="text-sm text-muted-foreground">
                      {slot.startTime} · {slot.duration} min
                    </p>
                  </div>
                  {!isOwnProfile && session?.user ? (
                    <Button size="sm" type="submit">
                      Book
                    </Button>
                  ) : !session?.user ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href="/sign-in">Sign in to book</a>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
