"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Mail, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  sendTestEmail,
  runDrainNow,
  requeueFailedNotifications,
  type AdminActionResult,
} from "@/app/admin/notifications/actions";

/**
 * The three things an admin wants when email looks wrong: prove sending works,
 * run a tick without waiting for the pinger, and give up-for-dead rows another
 * go.
 */
export function NotificationTools({
  defaultTestAddress,
  failedCount,
}: {
  defaultTestAddress: string | null;
  failedCount: number;
}) {
  const [isSending, startSending] = useTransition();
  const [isDraining, startDraining] = useTransition();
  const [isRequeueing, startRequeueing] = useTransition();

  function report(result: AdminActionResult) {
    if (result.ok) toast.success(result.message);
    // Long, because a provider's complaint is the whole value of a failed test.
    else toast.error(result.message, { duration: 10_000 });
  }

  return (
    <div className="flex flex-col gap-5">
      <form
        action={(formData) => startSending(async () => report(await sendTestEmail(formData)))}
        className="flex flex-col gap-2"
      >
        <label htmlFor="test-email" className="text-sm font-medium">
          Send a test email
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id="test-email"
            name="to"
            type="email"
            required
            defaultValue={defaultTestAddress ?? ""}
            placeholder="you@example.com"
            className="sm:max-w-xs"
          />
          <Button type="submit" loading={isSending} loadingText="Sending…" className="gap-1.5">
            <Mail className="size-4" /> Send test
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Goes straight through the provider, skipping the queue — so it answers
          &ldquo;can we send at all?&rdquo;. Each one counts against the free tier&rsquo;s 100 a day.
        </p>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          loading={isDraining}
          loadingText="Running…"
          className="gap-1.5"
          onClick={() => startDraining(async () => report(await runDrainNow()))}
        >
          <Play className="size-4" /> Run a tick now
        </Button>

        <Button
          variant="outline"
          disabled={failedCount === 0}
          loading={isRequeueing}
          loadingText="Queueing…"
          className="gap-1.5"
          onClick={() => startRequeueing(async () => report(await requeueFailedNotifications()))}
        >
          <RotateCcw className="size-4" />
          {failedCount === 0 ? "Nothing failed" : `Retry ${failedCount} failed`}
        </Button>
      </div>
    </div>
  );
}
