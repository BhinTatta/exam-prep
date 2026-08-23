"use client";

import { useState, useTransition } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportContent } from "@/app/reports/actions";
import type { ReportTargetType } from "@prisma/client";

const REASONS = [
  { value: "copyright", label: "Copyright / pirated content" },
  { value: "spam", label: "Spam" },
  { value: "abusive", label: "Abusive / harassment" },
  { value: "other", label: "Other" },
];

export function ReportButton({
  targetType,
  targetId,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();

  function submit() {
    if (!reason) {
      toast.error("Pick a reason first");
      return;
    }
    startTransition(async () => {
      try {
        await reportContent({ targetType, targetId, reason, details: details.trim() || undefined, contextUrl: pathname });
        toast.success("Reported — a moderator will review it");
        setOpen(false);
        setReason("");
        setDetails("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className ?? "size-7 text-muted-foreground hover:text-destructive"}
        >
          <Flag className="size-3.5" />
          <span className="sr-only">Report</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report content</DialogTitle>
          <DialogDescription>Flag this for a moderator to review.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Details (optional)</Label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything that helps a moderator understand the issue"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={isPending} onClick={submit}>
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
