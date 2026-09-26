import type { MeetingAttendance } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { BookingStatusBadge } from "@/components/bookings/booking-status-badge";
import { PayoutButton } from "@/components/admin/payout-button";
import { Badge } from "@/components/ui/badge";
import { DAYS, formatIstDateTime } from "@/lib/days";
import { summarizeAttendance } from "@/lib/bookings/attendance";
import { Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const metadata = { title: "Sessions & payouts" };

export default async function AdminSessionsPage() {
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["CONFIRMED", "COMPLETED", "DISPUTED"] } },
    include: {
      mentee: { select: { name: true } },
      mentor: { include: { user: { select: { name: true } } } },
      slot: true,
      payout: true,
      attendance: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Attendance only means something once a session has had the chance to
  // happen. Counting future bookings as "nobody joined" would bury the ones
  // that actually went wrong under a pile that simply has not happened yet.
  const now = new Date();
  const started = bookings.filter((b) => b.scheduledStartAt && b.scheduledStartAt <= now);
  const attended = started.filter((b) => summarizeAttendance(b.attendance).bothSidesJoined);
  const noShows = started.filter((b) => b.attendance.length === 0);

  return (
    <div>
      <PageHeader
        title="Sessions & payouts"
        description="Mentees pay the platform; you pay mentors by hand. Each row shows where to send it."
      />
      {started.length > 0 && (
        <Card className="mb-4">
          <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-1 p-4 text-sm">
            <span className="text-muted-foreground">
              Of <span className="font-medium text-foreground">{started.length}</span> sessions that
              have started:
            </span>
            <span>
              <span className="font-medium">{attended.length}</span> had both sides join
            </span>
            <span>
              <span className="font-medium">{started.length - attended.length - noShows.length}</span>{" "}
              had one side only
            </span>
            <span>
              <span className="font-medium">{noShows.length}</span> had nobody join
            </span>
          </CardContent>
        </Card>
      )}
      {bookings.length === 0 ? (
        <EmptyState icon={Calendar} title="No sessions yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {bookings.map((b) => (
            <Card key={b.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">
                    {b.mentee.name} → {b.mentor.user.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {DAYS[b.slot.dayOfWeek]} {b.slot.startTime} · ₹{b.amount} ·{" "}
                    {formatDistanceToNow(b.createdAt, { addSuffix: true })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pay <span className="font-mono">{b.mentor.upiId}</span>
                  </p>
                  {b.scheduledStartAt && b.scheduledStartAt <= now && (
                    <p className="text-xs text-muted-foreground">
                      Video call: {describeAttendance(b.attendance)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <BookingStatusBadge status={b.status} />
                  {b.status === "COMPLETED" &&
                    (b.payout?.paidAt ? (
                      <Badge variant="outline">Paid out</Badge>
                    ) : (
                      <PayoutButton bookingId={b.id} amount={b.amount} />
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * "both joined, mentor first" — the one line worth reading per session.
 *
 * A join is a click on the join button, so this is exact about who came to the
 * door and says nothing about how long they stayed. Who arrived first is in
 * here because on public Jitsi that is who moderated the call.
 */
function describeAttendance(rows: MeetingAttendance[]): string {
  const { mentee, mentor } = summarizeAttendance(rows);

  if (mentor && mentee) {
    const mentorFirst = mentor.firstJoinedAt <= mentee.firstJoinedAt;
    const firstIn = mentorFirst ? mentor : mentee;
    return `both joined, ${mentorFirst ? "mentor" : "mentee"} first (${formatIstDateTime(
      firstIn.firstJoinedAt
    )})`;
  }
  if (mentor) return `mentor only — the mentee never joined (${formatIstDateTime(mentor.firstJoinedAt)})`;
  if (mentee) return `mentee only — the mentor never joined (${formatIstDateTime(mentee.firstJoinedAt)})`;
  return "nobody joined";
}
