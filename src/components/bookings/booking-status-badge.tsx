import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  PAYMENT_PROCESSING: "Confirming payment",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  DISPUTED: "Disputed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  REFUNDED: "Refunded",
};

const STATUS_CLASS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "bg-muted text-muted-foreground",
  PAYMENT_PROCESSING: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CONFIRMED: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  COMPLETED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  DISPUTED: "bg-destructive/15 text-destructive",
  CANCELLED: "bg-muted text-muted-foreground",
  EXPIRED: "bg-muted text-muted-foreground",
  REFUNDED: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge className={cn("border-0 font-medium", STATUS_CLASS[status])}>{STATUS_LABEL[status]}</Badge>;
}
