import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export const metadata = { title: "Moderation" };

export default async function AdminModerationPage() {
  const [questions, comments] = await Promise.all([
    prisma.question.findMany({
      where: { deleted: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    prisma.comment.findMany({
      where: { deleted: false },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } }, question: { select: { title: true } } },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Moderation" description="Latest questions and comments across the platform." />
      <ModerationQueue questions={questions} comments={comments} />
    </div>
  );
}
