import Link from "next/link";
import { Bell, BellRing, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { cancelSlotAlert, requestSlotAlert, type SlotRequestInput } from "@/app/slot-requests/actions";

/**
 * The "notify me" control for a dead end: a mentor with no open slots, a list
 * where everyone is booked out, or a day nobody is free.
 *
 * No hooks and no directive, so it renders from a server page (the mentor
 * profile) and from inside the client-side MentorBrowser alike. The bound
 * server actions work in both.
 *
 * Three states, and the caller decides which: signed out (sign in first, then
 * come back here), already on the list (say so, offer to undo), or not yet.
 */
export function NotifyMeButton({
  request,
  requested,
  signedIn,
  size = "default",
}: {
  request: SlotRequestInput;
  requested: boolean;
  signedIn: boolean;
  size?: "default" | "lg";
}) {
  const returnTo = request.mentorId ? `/mentors/${request.mentorId}` : "/mentors";

  if (!signedIn) {
    return (
      <Button asChild variant="outline" size={size}>
        <Link href={`/sign-in?callbackUrl=${encodeURIComponent(returnTo)}`}>
          <Bell className="size-4" /> Sign in to get notified
        </Link>
      </Button>
    );
  }

  if (requested) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-sm font-medium text-primary">
          <Check className="size-4" /> You&apos;re on the list
        </span>
        <form action={cancelSlotAlert.bind(null, request)}>
          <SubmitButton
            variant="link"
            size="sm"
            loadingText="Removing…"
            className="h-auto p-0 text-xs text-muted-foreground"
          >
            Remove me
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <form action={requestSlotAlert.bind(null, request)}>
      <SubmitButton variant="outline" size={size} loadingText="Adding you…">
        <BellRing className="size-4" /> Notify me
      </SubmitButton>
    </form>
  );
}

/** A NotifyMeButton with the reason it is there, for use outside an EmptyState. */
export function NotifyMeCallout({
  title,
  description,
  className,
  ...button
}: React.ComponentProps<typeof NotifyMeButton> & {
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed bg-card p-5 text-center sm:flex-row sm:justify-between sm:text-left",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Bell className="mt-0.5 hidden size-4.5 shrink-0 text-primary sm:block" />
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="shrink-0">
        <NotifyMeButton {...button} />
      </div>
    </div>
  );
}
