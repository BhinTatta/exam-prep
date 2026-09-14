import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, CreditCard, ShieldAlert, Calendar, Users } from "lucide-react";

export const metadata = { title: "Admin" };

/**
 * Reading the clock is a data-fetching concern, not render logic — keeping it
 * out of the component body keeps the render pure.
 */
function countCapturedLast24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return prisma.payment.count({ where: { status: "CAPTURED", capturedAt: { gte: since } } });
}

export default async function AdminOverviewPage() {
  const [pendingMentors, capturedToday, needsAttention, sessions, totalUsers] = await Promise.all([
    prisma.mentorProfile.count({ where: { verified: false } }),
    countCapturedLast24h(),
    // Things only a human can clear: cancellation requests, and webhooks that
    // failed to process (a stuck payment hides here, not in the payment list).
    Promise.all([
      prisma.booking.count({ where: { cancellationRequestedAt: { not: null } } }),
      prisma.webhookEvent.count({ where: { processedAt: null, error: { not: null } } }),
    ]).then(([a, b]) => a + b),
    prisma.booking.count({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.user.count(),
  ]);

  const cards = [
    { label: "Pending mentor approvals", value: pendingMentors, href: "/admin/mentors", icon: UserCheck },
    { label: "Payments needing attention", value: needsAttention, href: "/admin/payments", icon: ShieldAlert },
    { label: "Captured in last 24h", value: capturedToday, href: "/admin/payments?status=CAPTURED", icon: CreditCard },
    { label: "Active + completed sessions", value: sessions, href: "/admin/sessions", icon: Calendar },
    { label: "Total users", value: totalUsers, href: "/admin/users", icon: Users },
  ];

  return (
    <div>
      <PageHeader title="Admin dashboard" description="Everything that needs a human decision, in one place." />
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className="size-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
