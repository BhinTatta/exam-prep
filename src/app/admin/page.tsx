import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserCheck, CreditCard, ShieldAlert, Calendar } from "lucide-react";

export const metadata = { title: "Admin" };

export default async function AdminOverviewPage() {
  const [pendingMentors, pendingPayments, sessionsThisMonth, totalUsers] = await Promise.all([
    prisma.mentorProfile.count({ where: { verified: false } }),
    prisma.booking.count({ where: { status: "PAYMENT_SUBMITTED" } }),
    prisma.booking.count({ where: { status: { in: ["CONFIRMED", "COMPLETED"] } } }),
    prisma.user.count(),
  ]);

  const cards = [
    { label: "Pending mentor approvals", value: pendingMentors, href: "/admin/mentors", icon: UserCheck },
    { label: "Pending payment verifications", value: pendingPayments, href: "/admin/payments", icon: CreditCard },
    { label: "Active + completed sessions", value: sessionsThisMonth, href: "/admin/sessions", icon: Calendar },
    { label: "Total users", value: totalUsers, href: "/admin/users", icon: ShieldAlert },
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
