import { Badge } from "@/components/ui/badge";
import type { PaymentStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const LABEL: Record<PaymentStatus, string> = {
  CREATED: "Not paid",
  AUTHORIZED: "Authorised",
  CAPTURED: "Captured",
  FAILED: "Failed",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Part refunded",
};

const CLASS: Record<PaymentStatus, string> = {
  CREATED: "bg-muted text-muted-foreground",
  AUTHORIZED: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CAPTURED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-destructive/15 text-destructive",
  REFUNDED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  PARTIALLY_REFUNDED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={cn("border-0 font-medium", CLASS[status])}>{LABEL[status]}</Badge>;
}
