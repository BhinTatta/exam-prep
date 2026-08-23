import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ReportsQueue } from "@/components/admin/reports-queue";

export const metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  const [reports, messages] = await Promise.all([
    prisma.report.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { reporter: { select: { name: true } } },
    }),
    prisma.contactMessage.findMany({
      where: { resolved: false },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Reports" description="User-flagged content and messages from the contact form." />
      <ReportsQueue reports={reports} messages={messages} />
    </div>
  );
}
