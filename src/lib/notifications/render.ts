import "server-only";

import type { NotificationEvent } from "@prisma/client";
import { siteConfig } from "@/config/site";
import { formatIstDateTime } from "@/lib/days";

/** Everything a template is allowed to know, resolved at send time. */
export type RenderContext = {
  event: NotificationEvent;
  /** Which side of the booking is reading this. */
  audience: "MENTEE" | "MENTOR";
  recipientName: string | null;
  /** The other person on the call. */
  counterpartName: string;
  startsAt: Date;
  durationMinutes: number;
  meetLink: string | null;
  bookingUrl: string;
  amount: number;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Names come from user profiles and Google accounts, so they reach here as
 * arbitrary strings. Unescaped, a name containing `<` silently breaks the
 * markup around it — and an email client is just a (bad) HTML renderer.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name: string | null): string {
  return name?.trim().split(/\s+/)[0] ?? "there";
}

/** "1 hour", "30 minutes" — reads better than "60 minutes". */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const hours = minutes / 60;
  const label = Number.isInteger(hours) ? `${hours}` : hours.toFixed(1);
  return `${label} ${hours === 1 ? "hour" : "hours"}`;
}

type Block = { heading: string; paragraphs: string[]; cta?: { label: string; href: string } };

/**
 * One layout for every message.
 *
 * Inline styles and a single centred block, because email clients are not
 * browsers: Gmail strips <style> blocks, Outlook renders through Word, and
 * anything resembling a modern layout falls apart. Plain and legible survives
 * everywhere, and the text/plain alternative below carries the same content for
 * clients that show none of it.
 */
function layout(block: Block): string {
  const cta = block.cta
    ? `<p style="margin:28px 0 0"><a href="${escapeHtml(block.cta.href)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;font-weight:600;text-decoration:none;padding:12px 22px;border-radius:8px">${escapeHtml(block.cta.label)}</a></p>`
    : "";

  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:24px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px">
    <p style="margin:0 0 24px;font-size:15px;font-weight:700;color:#1d4ed8">${escapeHtml(siteConfig.name)}</p>
    <h1 style="margin:0 0 16px;font-size:20px;line-height:1.35">${escapeHtml(block.heading)}</h1>
    ${block.paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#3f3f46">${p}</p>`).join("\n    ")}
    ${cta}
  </div>
  <p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center">
    ${escapeHtml(siteConfig.name)} · <a href="${escapeHtml(siteConfig.url)}" style="color:#71717a">${escapeHtml(siteConfig.url.replace(/^https?:\/\//, ""))}</a><br>
    You are getting this because you booked or hosted a session.
  </p>
</body>
</html>`;
}

/** The plain-text twin of `layout`, built from the same blocks. */
function plain(block: Block): string {
  const lines = [
    block.heading,
    "",
    // Strip the tags the HTML paragraphs carry; the copy itself is identical.
    ...block.paragraphs.map((p) =>
      p
        .replace(/<br\s*\/?>/g, "\n")
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
    ),
  ];
  if (block.cta) lines.push("", `${block.cta.label}: ${block.cta.href}`);
  lines.push("", "—", `${siteConfig.name} · ${siteConfig.url}`);
  return lines.join("\n");
}

/**
 * A diagnostic message, for the "send a test email" button in the admin area.
 *
 * Deliberately rendered through the same `layout()` as every real notification:
 * a test that looks nothing like production mail tells you the API key works and
 * nothing about whether your email actually reads well or renders correctly in
 * Gmail.
 */
export function renderTestEmail(opts: { transport: string; from: string; sentAt: Date }): RenderedEmail {
  const block: Block = {
    heading: "Your email setup works",
    paragraphs: [
      `If you are reading this, ${escapeHtml(siteConfig.name)} can send email: the API key is valid, the sending domain is verified, and DKIM and SPF passed well enough to reach an inbox.`,
      `Transport: <strong>${escapeHtml(opts.transport)}</strong><br>From: ${escapeHtml(opts.from)}<br>Sent: ${escapeHtml(formatIstDateTime(opts.sentAt))}`,
      "This is the same layout every booking confirmation and reminder uses, so whatever this looks like in your mail client is what your students and mentors will see.",
      "Worth checking while you are here: that it did not land in spam or the Promotions tab, that the sender name reads correctly, and that replying to it reaches a real inbox.",
    ],
    cta: { label: "Open the site", href: siteConfig.url },
  };

  return {
    subject: `Test email from ${siteConfig.name}`,
    html: layout(block),
    text: plain(block),
  };
}

/**
 * Turn one queued notification into a message.
 *
 * Rendering happens here, at send time, and never at enqueue time. That is what
 * keeps a broken template out of the booking flow: the worst a mistake in this
 * file can do is fail one notification row, where the same mistake inside a
 * booking transaction would have taken the booking down with it.
 */
export function renderEmail(ctx: RenderContext): RenderedEmail {
  const when = formatIstDateTime(ctx.startsAt);
  const other = escapeHtml(ctx.counterpartName);
  const hello = escapeHtml(firstName(ctx.recipientName));
  const duration = formatDuration(ctx.durationMinutes);
  const joinNote =
    "Your video call button appears on the session page 30 minutes before the start time — it stays closed until then so nobody wanders into an empty room early.";

  switch (ctx.event) {
    case "BOOKING_CONFIRMED": {
      const block: Block =
        ctx.audience === "MENTEE"
          ? {
              heading: `Your session with ${ctx.counterpartName} is confirmed`,
              paragraphs: [
                `Hi ${hello}, your payment came through and the slot is yours.`,
                `<strong>${escapeHtml(when)}</strong><br>${duration} with ${other}<br>₹${ctx.amount} paid`,
                joinNote,
                "We will remind you a day before, and again half an hour before it starts.",
              ],
              cta: { label: "View your session", href: ctx.bookingUrl },
            }
          : {
              heading: `${ctx.counterpartName} booked a session with you`,
              paragraphs: [
                `Hi ${hello}, you have a new confirmed session — the mentee has already paid.`,
                `<strong>${escapeHtml(when)}</strong><br>${duration} with ${other}`,
                joinNote,
                "We will remind you a day before, and again half an hour before it starts. If you cannot make it, please tell them as early as you can.",
              ],
              cta: { label: "View the session", href: ctx.bookingUrl },
            };
      return {
        subject:
          ctx.audience === "MENTEE"
            ? `Confirmed: your session with ${ctx.counterpartName}`
            : `New session booked by ${ctx.counterpartName}`,
        html: layout(block),
        text: plain(block),
      };
    }

    case "SESSION_REMINDER_24H": {
      const block: Block = {
        heading: `Tomorrow: your session with ${ctx.counterpartName}`,
        paragraphs: [
          `Hi ${hello}, this is a heads-up that your session is tomorrow.`,
          `<strong>${escapeHtml(when)}</strong><br>${duration} with ${other}`,
          joinNote,
        ],
        cta: { label: "View the session", href: ctx.bookingUrl },
      };
      return {
        subject: `Tomorrow: your session with ${ctx.counterpartName}`,
        html: layout(block),
        text: plain(block),
      };
    }

    case "SESSION_REMINDER_30M": {
      const block: Block = {
        heading: `Starting in 30 minutes`,
        paragraphs: [
          `Hi ${hello}, your session with ${other} starts at <strong>${escapeHtml(when)}</strong>.`,
          ctx.meetLink
            ? "The video call is open now — the button below takes you straight in."
            : "Open the session page to join.",
        ],
        cta: { label: "Join the call", href: ctx.meetLink ?? ctx.bookingUrl },
      };
      return {
        subject: `Starting in 30 minutes: your session with ${ctx.counterpartName}`,
        html: layout(block),
        text: plain(block),
      };
    }

    case "SESSION_FEEDBACK": {
      const block: Block = {
        heading: `How was your session with ${ctx.counterpartName}?`,
        paragraphs: [
          `Hi ${hello}, your session should have wrapped up. Two things, and both are quick.`,
          "Let us know it actually happened, and leave a rating. Only people who sat through a session can review it, which is exactly why those ratings are worth reading — so yours genuinely helps the next student choose.",
          "If something went wrong, say so on the same page and we will look into it.",
        ],
        cta: { label: "Rate your session", href: ctx.bookingUrl },
      };
      return {
        subject: `How was your session with ${ctx.counterpartName}?`,
        html: layout(block),
        text: plain(block),
      };
    }
  }
}
