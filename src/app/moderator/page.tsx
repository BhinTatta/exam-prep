import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/page-header";
import { ModerationQueue } from "@/components/admin/moderation-queue";

export const metadata = { title: "Moderate" };

export default async function ModeratorPage() {
  await requireRole("MODERATOR");

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
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Moderation queue" description="Content only — no payments or role management here." />
      <ModerationQueue questions={questions} comments={comments} />
    </div>
  );
}
