import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { PaymentReviewCard } from "@/components/admin/payment-review-card";
import { CreditCard } from "lucide-react";

export const metadata = { title: "Payments" };

export default async function AdminPaymentsPage() {
  const pending = await prisma.booking.findMany({
    where: { status: "PAYMENT_SUBMITTED" },
    include: {
      mentee: { select: { name: true } },
      mentor: { include: { user: { select: { name: true } } } },
      slot: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div>
      <PageHeader title="Payment verifications" description="Confirm UTR references before locking in a session." />
      {pending.length === 0 ? (
        <EmptyState icon={CreditCard} title="Nothing pending" description="All payments are handled." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {pending.map((b) => (
            <PaymentReviewCard key={b.id} booking={b} />
          ))}
        </div>
      )}
    </div>
  );
}
