"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Share a mentor profile.
 *
 * One tap on a phone: the OS share sheet already knows which apps this person
 * uses, and no dialog we write will beat it. The dialog below is the desktop
 * path (and the fallback when the sheet is unavailable or refused), where the
 * channels are the ones this audience actually forwards to — a WhatsApp study
 * group, a Telegram batch channel, or a mail to a junior.
 */
export function ShareProfile({
  path,
  fallbackUrl,
  mentorName,
  isOwner = false,
  className,
  ...trigger
}: {
  /** Route path, e.g. "/mentors/abc". The origin is read from the browser. */
  path: string;
  /** Server-rendered absolute URL, used until the component mounts. */
  fallbackUrl: string;
  mentorName: string;
  isOwner?: boolean;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [url, setUrl] = useState(fallbackUrl);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (copyTimer.current && clearTimeout(copyTimer.current)), []);

  /**
   * The configured site URL is right in production and wrong everywhere else
   * (previews, a phone hitting the dev server over LAN), so the browser gets
   * the last word. Resolved on click rather than on mount: nothing reads the
   * link until someone asks to share it, and an effect that only re-renders
   * with the same value is a render the page doesn't need.
   */
  function resolveUrl() {
    const next = typeof window === "undefined" ? fallbackUrl : `${window.location.origin}${path}`;
    setUrl(next);
    return next;
  }

  const message = isOwner
    ? `I take 1:1 prep sessions here — ${mentorName}'s profile, slots and reviews:`
    : `${mentorName} cleared the exam we're preparing for and takes 1:1 sessions. Worth a look:`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(resolveUrl());
      setCopied(true);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure origin, denied permission) — the link is
      // in a real input, so selecting it is still a way out.
      document.querySelector<HTMLInputElement>("#share-profile-url")?.select();
    }
  }

  async function share() {
    const target = resolveUrl();
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${mentorName} · 1:1 prep sessions`, text: message, url: target });
        return;
      } catch (err) {
        // A dismissed share sheet is not a failure and must not be papered
        // over with a dialog the person just closed.
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    setOpen(true);
  }

  const encoded = encodeURIComponent(`${message} ${url}`);

  return (
    <>
      <Button
        variant={trigger.variant ?? "outline"}
        size={trigger.size ?? "default"}
        onClick={share}
        className={className}
      >
        <Share2 />
        {isOwner ? "Share your profile" : "Share"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isOwner ? "Share your profile" : `Share ${mentorName}'s profile`}</DialogTitle>
            <DialogDescription>
              {isOwner
                ? "Anywhere students already are — a batch group, your bio, a reply to a junior. The page shows your credential, your story and what students said afterwards."
                : "Send it to someone preparing for the same exam. They'll see the credential, the open slots and what other students said."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <Input
                id="share-profile-url"
                readOnly
                value={url}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
                aria-label="Profile link"
              />
              <Button onClick={copy} className={cn("shrink-0", copied && "bg-success")}>
                {copied ? <Check /> : <Copy />}
                <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <Channel href={`https://wa.me/?text=${encoded}`} label="WhatsApp" icon={MessageCircle} />
              <Channel
                href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`}
                label="Telegram"
                icon={Send}
              />
              <Channel
                href={`mailto:?subject=${encodeURIComponent(`${mentorName} — 1:1 prep sessions`)}&body=${encoded}`}
                label="Email"
                icon={Mail}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Channel({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: typeof Mail;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 rounded-xl border bg-card px-2 py-3.5 text-xs font-medium",
        "transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md",
        "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      )}
    >
      <Icon className="size-5 text-primary" />
      {label}
    </a>
  );
}
