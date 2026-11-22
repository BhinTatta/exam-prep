import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { BellRing, CalendarPlus, Users, UserRound } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DAYS } from "@/lib/days";

export const metadata = { title: "Waitlist" };

const SOURCE_LABEL: Record<string, string> = {
  mentor_profile: "Mentor profile",
  mentor_list: "Mentor list",
};

const RECENT_LIMIT = 200;

/**
 * Students who went looking for a session and found nothing to book.
 *
 * Nothing is emailed to them yet (docs/slot-requests.md), so for now this page
 * is the follow-up: it shows who is waiting for whom, which waited-for mentors
 * have since opened slots (go tell those students), and each student's email
 * to reach out by hand.
 */
export default async function AdminDemandPage() {
  const [open, byMentor] = await Promise.all([
    prisma.slotRequest.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: RECENT_LIMIT,
      select: {
        id: true,
        dayOfWeek: true,
        source: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        mentor: { select: { id: true, user: { select: { name: true } } } },
      },
    }),
    prisma.slotRequest.groupBy({
      by: ["mentorId"],
      where: { status: "OPEN" },
      _count: { _all: true },
    }),
  ]);

  const totalOpen = byMentor.reduce((sum, g) => sum + g._count._all, 0);
  const [students, mentorNames] = await Promise.all([
    prisma.slotRequest
      .findMany({ where: { status: "OPEN" }, distinct: ["userId"], select: { userId: true } })
      .then((rows) => rows.length),
    prisma.mentorProfile.findMany({
      where: { id: { in: byMentor.flatMap((g) => (g.mentorId ? [g.mentorId] : [])) } },
      select: {
        id: true,
        user: { select: { name: true } },
        _count: { select: { availability: { where: { active: true } } } },
      },
    }),
  ]);

  const mentorById = new Map(mentorNames.map((m) => [m.id, m]));
  const anyMentorCount = byMentor.find((g) => g.mentorId === null)?._count._all ?? 0;
  const mentorRows = byMentor
    .filter((g) => g.mentorId !== null)
    .map((g) => ({ mentor: mentorById.get(g.mentorId!)!, waiting: g._count._all }))
    .filter((row) => row.mentor)
    .sort((a, b) => b.waiting - a.waiting);

  const stats = [
    { label: "Open requests", value: totalOpen, icon: BellRing },
    { label: "Students waiting", value: students, icon: Users },
    { label: "For any mentor", value: anyMentorCount, icon: UserRound },
    {
      label: "Asked-for mentors now open",
      value: mentorRows.filter((r) => r.mentor._count.availability > 0).length,
      icon: CalendarPlus,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Waitlist"
        description="Students who clicked “Notify me” because they couldn't find a session to book."
      />

      {totalOpen === 0 ? (
        <EmptyState
          icon={BellRing}
          title="Nobody is waiting"
          description="When a student finds no open slot and asks to be notified, they show up here."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                  <s.icon className="size-3.5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{s.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Demand by mentor</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {anyMentorCount > 0 && (
                <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="font-medium">Any mentor</span>
                  <span className="tabular-nums">{anyMentorCount} waiting</span>
                </div>
              )}
              {mentorRows.map(({ mentor, waiting }) => (
                <div key={mentor.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/mentors/${mentor.id}`} className="font-medium hover:underline">
                    {mentor.user.name ?? "Unnamed mentor"}
                  </Link>
                  <div className="flex items-center gap-3">
                    {mentor._count.availability > 0 ? (
                      <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                        Has availability now — tell them
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        No availability
                      </Badge>
                    )}
                    <span className="tabular-nums">{waiting} waiting</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Open requests
                {totalOpen > RECENT_LIMIT && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    latest {RECENT_LIMIT} of {totalOpen}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col divide-y">
              {open.map((r) => (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{r.user.name ?? "Unnamed student"}</p>
                    {r.user.email && (
                      <a href={`mailto:${r.user.email}`} className="text-xs break-all text-muted-foreground hover:underline">
                        {r.user.email}
                      </a>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-0.5 sm:items-end">
                    <p>
                      {r.mentor ? (
                        <Link href={`/mentors/${r.mentor.id}`} className="hover:underline">
                          {r.mentor.user.name ?? "Unnamed mentor"}
                        </Link>
                      ) : (
                        "Any mentor"
                      )}
                      {" · "}
                      {r.dayOfWeek === null ? "any day" : DAYS[r.dayOfWeek]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {SOURCE_LABEL[r.source] ?? r.source} ·{" "}
                      {formatDistanceToNow(r.createdAt, { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
