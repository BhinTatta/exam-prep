import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Clock, Mail, MailCheck, MailX, SkipForward } from "lucide-react";
import type { NotificationEvent, NotificationStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { NotificationTools } from "@/components/admin/notification-tools";
import { emailTransportStatus } from "@/lib/notifications/channels/email";
import { formatIstDateTime } from "@/lib/days";
import { cn } from "@/lib/utils";

export const metadata = { title: "Email & notifications" };

const EVENT_LABEL: Record<NotificationEvent, string> = {
  BOOKING_CONFIRMED: "Booking confirmed",
  SESSION_REMINDER_24H: "Reminder — 24h",
  SESSION_REMINDER_30M: "Reminder — 30m",
  SESSION_FEEDBACK: "Feedback request",
};

const STATUS_CLASS: Record<NotificationStatus, string> = {
  PENDING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  SENT: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  SKIPPED: "bg-muted text-muted-foreground",
  FAILED: "bg-destructive/15 text-destructive",
};

const HOUR_MS = 60 * 60 * 1000;

export default async function AdminNotificationsPage() {
  const admin = await requireRole("ADMIN");
  const now = new Date();
  const config = emailTransportStatus();

  const [dueNow, scheduled, sent24h, skipped7d, failed, recent, lastSent] = await Promise.all([
    prisma.notification.count({ where: { status: "PENDING", sendAfter: { lte: now } } }),
    prisma.notification.count({ where: { status: "PENDING", sendAfter: { gt: now } } }),
    prisma.notification.count({
      where: { status: "SENT", sentAt: { gte: new Date(now.getTime() - 24 * HOUR_MS) } },
    }),
    prisma.notification.count({
      where: { status: "SKIPPED", updatedAt: { gte: new Date(now.getTime() - 7 * 24 * HOUR_MS) } },
    }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    prisma.notification.findMany({
      // Last state change, not creation: this is a page you open when something
      // looks wrong, and what changed most recently is what you want first.
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        sendAfter: true,
        sentAt: true,
        lastError: true,
        bookingId: true,
        user: { select: { name: true, email: true } },
      },
    }),
    prisma.notification.findFirst({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
  ]);

  // A tick should land every five minutes. Well past that with work waiting
  // means the pinger is the problem, not the code.
  const pingerLooksDown = dueNow > 0;

  const stats = [
    { label: "Due now", value: dueNow, icon: Clock },
    { label: "Scheduled", value: scheduled, icon: Mail },
    { label: "Sent (24h)", value: sent24h, icon: MailCheck },
    { label: "Skipped (7d)", value: skipped7d, icon: SkipForward },
    { label: "Failed", value: failed, icon: MailX },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Email & notifications"
        description="What has been sent, what is queued, and whether sending works at all."
      />

      {config.transport === "misconfigured" && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex gap-3 p-4">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-medium text-destructive">No email is being sent</p>
              <p className="text-muted-foreground">
                <code>RESEND_API_KEY</code> is not set in this environment, so every notification
                fails after five attempts instead of going out. Set it in the Vercel project&rsquo;s
                environment variables, then use <em>Retry failed</em> below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
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
          <CardTitle className="text-base">Configuration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-muted-foreground">Transport</dt>
            <dd className="font-mono text-xs">
              {config.transport}
              {config.transport === "console" && (
                <span className="ml-2 font-sans text-muted-foreground">
                  (development — mail is logged, not sent)
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">From</dt>
            <dd className="font-mono text-xs break-all">{config.from}</dd>

            <dt className="text-muted-foreground">Reply-to</dt>
            <dd className="font-mono text-xs break-all">
              {config.replyTo ?? <span className="font-sans text-muted-foreground">not set</span>}
            </dd>

            <dt className="text-muted-foreground">Cron secret</dt>
            <dd className="text-xs">
              {config.cronSecretSet ? (
                "set"
              ) : (
                <span className="text-destructive">
                  not set — the cron endpoint refuses every request, so nothing is ever sent
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">Last sent</dt>
            <dd className="text-xs">
              {lastSent?.sentAt
                ? `${formatIstDateTime(lastSent.sentAt)} (${formatDistanceToNow(lastSent.sentAt, { addSuffix: true })})`
                : "never"}
            </dd>
          </dl>

          {pingerLooksDown && (
            <p className="rounded-md bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
              {dueNow} {dueNow === 1 ? "message is" : "messages are"} due and still waiting. A tick
              should arrive every five minutes, so check the cron-job.org job is enabled and sending
              the right <code>Authorization</code> header — or just run one below.
            </p>
          )}

          <Separator />

          <NotificationTools defaultTestAddress={admin.email ?? null} failedCount={failed} />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-heading text-lg font-semibold">Recent activity</h2>
        {recent.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="Nothing yet"
            description="Notifications appear here once a booking is confirmed."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((n) => (
              <Card key={n.id}>
                <CardContent className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{EVENT_LABEL[n.event]}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {n.user.name ?? "Unnamed"}
                      {n.user.email ? ` · ${n.user.email}` : " · no email address"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {n.sentAt
                        ? `Sent ${formatDistanceToNow(n.sentAt, { addSuffix: true })}`
                        : `Due ${formatIstDateTime(n.sendAfter)}`}
                      {n.attempts > 0 && ` · ${n.attempts} ${n.attempts === 1 ? "attempt" : "attempts"}`}
                      {n.bookingId && (
                        <>
                          {" · "}
                          <Link href={`/bookings/${n.bookingId}`} className="underline">
                            booking
                          </Link>
                        </>
                      )}
                    </p>
                    {n.lastError && (
                      <p
                        className={cn(
                          "mt-1 text-xs",
                          n.status === "FAILED" ? "text-destructive" : "text-muted-foreground"
                        )}
                      >
                        {n.lastError}
                      </p>
                    )}
                  </div>
                  <Badge className={cn("border-0 font-medium", STATUS_CLASS[n.status])}>
                    {n.status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
