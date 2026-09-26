import "server-only";

import type { NotificationEvent } from "@prisma/client";
import { siteConfig } from "@/config/site";
import { formatIstDateTime } from "@/lib/days";
import {
  MENTEE_JOIN_OPENS_BEFORE_MINUTES,
  MENTOR_JOIN_OPENS_BEFORE_MINUTES,
} from "@/lib/bookings/meeting";

/**
 * The Lattice palette, in hex.
 *
 * globals.css defines these in oklch, which no email client understands — a
 * single `oklch()` in a style attribute is dropped, and the element renders
 * with no colour at all. So they are converted once here and kept in step by
 * hand. If the design system's tokens move, these move with them.
 */
const C = {
  paper: "#f3f0ea", // --muted, the surface the card sits on
  card: "#ffffff", // --card
  ink: "#1e1b17", // --foreground
  inkSoft: "#6b665e", // --muted-foreground
  primary: "#4f51c6", // --primary, quantum indigo
  onPrimary: "#ffffff",
  accent: "#e9ecfb", // --accent, pale indigo panel
  highlight: "#f0a047", // --highlight, marigold
  highlightTint: "#fdf2e5", // marigold at panel strength
  highlightInk: "#3e2815", // --highlight-foreground
  border: "#e7e3dd", // --border
} as const;

/**
 * No webfont.
 *
 * The site sets headings in Schibsted Grotesk, but Gmail strips both @font-face
 * and <link>, which is most of our readers — so a webfont would buy polish for a
 * minority and an extra network request for everyone. The identity here carries
 * on the logo, the indigo and the layout instead.
 */
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

/** 652x160 intrinsic, drawn at 150 wide. */
const LOGO = { src: `${siteConfig.url}/brand/logo-light.png`, width: 150, height: 37 };

/** One fact about the session, stacked rather than columned so it survives 320px. */
export type DetailRow = { label: string; value: string };

type NoteTone = "info" | "urgent";

type EmailBlock = {
  /** The grey line after the subject in an inbox list. Wasted if left unset. */
  preheader: string;
  eyebrow: string;
  heading: string;
  lead: string;
  details?: { title: string; rows: DetailRow[] };
  cta?: { label: string; href: string };
  note?: { tone: NoteTone; text: string };
  /** Small print after the call to action. */
  footnotes?: string[];
};

export type RenderedEmail = { subject: string; html: string; text: string };

/**
 * Names and profile text come from user input and Google accounts, so they
 * reach here as arbitrary strings. Unescaped, a name containing `<` silently
 * breaks the markup around it — an email client is just a (bad) HTML renderer.
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

/** Drop rows whose value we do not have, so no email says "College: —". */
function rows(entries: [string, string | null | undefined][]): DetailRow[] {
  return entries
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([label, value]) => ({ label, value: (value as string).trim() }));
}

// ---------------------------------------------------------------------------
// The shell
// ---------------------------------------------------------------------------

/**
 * Tables, inline styles, and hex colours only.
 *
 * Outlook on Windows renders through Word, which ignores most of the box model
 * — floats, flex, grid and padding on a <div> all fail there. Nested tables with
 * cellpadding are the one layout primitive every client has agreed on for
 * twenty years, so that is what this uses, ugly as it reads.
 */
function shell(block: EmailBlock): string {
  const detail = block.details
    ? `
              <tr><td style="padding:28px 0 0">
                <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${C.inkSoft}">${escapeHtml(block.details.title)}</p>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:${C.accent};border-radius:10px">
                  <tr><td style="padding:4px 18px">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
                      ${block.details.rows
                        .map(
                          (row, index) => `<tr><td style="padding:12px 0;${index > 0 ? `border-top:1px solid rgba(79,81,198,.14);` : ""}">
                        <p style="margin:0 0 3px;font-family:${FONT};font-size:12px;line-height:1.3;color:${C.inkSoft}">${escapeHtml(row.label)}</p>
                        <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.45;font-weight:600;color:${C.ink}">${escapeHtml(row.value)}</p>
                      </td></tr>`
                        )
                        .join("\n                      ")}
                    </table>
                  </td></tr>
                </table>
              </td></tr>`
    : "";

  const cta = block.cta
    ? `
              <tr><td style="padding:28px 0 0">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate">
                  <tr><td bgcolor="${C.primary}" style="background:${C.primary};border-radius:10px">
                    <a href="${escapeHtml(block.cta.href)}" style="display:inline-block;padding:13px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${C.onPrimary};text-decoration:none;border-radius:10px">${escapeHtml(block.cta.label)}</a>
                  </td></tr>
                </table>
              </td></tr>`
    : "";

  const note = block.note
    ? `
              <tr><td style="padding:24px 0 0">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
                  <tr>
                    <td width="3" bgcolor="${block.note.tone === "urgent" ? C.highlight : C.primary}" style="width:3px;background:${block.note.tone === "urgent" ? C.highlight : C.primary};border-radius:2px">&nbsp;</td>
                    <td style="padding:2px 0 2px 14px;background:${block.note.tone === "urgent" ? C.highlightTint : "transparent"}">
                      <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${block.note.tone === "urgent" ? C.highlightInk : C.inkSoft}">${escapeHtml(block.note.text)}</p>
                    </td>
                  </tr>
                </table>
              </td></tr>`
    : "";

  const footnotes = (block.footnotes ?? [])
    .map(
      (line) =>
        `<p style="margin:14px 0 0;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.inkSoft}">${escapeHtml(line)}</p>`
    )
    .join("\n              ");

  const host = siteConfig.url.replace(/^https?:\/\//, "");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<!-- Asks clients not to invert the palette. Gmail on mobile ignores it, which
     is why every surface below also carries an explicit bgcolor. -->
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(siteConfig.name)}</title>
</head>
<body style="margin:0;padding:0;background:${C.paper};-webkit-font-smoothing:antialiased">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${escapeHtml(block.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.paper}" style="background:${C.paper}">
    <tr><td align="center" style="padding:32px 12px">
      <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <!-- Fluid up to 600. A width="600" ATTRIBUTE here instead would win over
           max-width and push the layout off the right edge of every phone. -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse">

        <tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:14px;padding:28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">

            <tr><td style="padding:0 0 26px">
              <a href="${escapeHtml(siteConfig.url)}" style="text-decoration:none">
                <img src="${escapeHtml(LOGO.src)}" width="${LOGO.width}" height="${LOGO.height}" alt="${escapeHtml(siteConfig.name)}" style="display:block;border:0;outline:none;text-decoration:none;height:auto">
              </a>
            </td></tr>

            <tr><td>
              <p style="margin:0 0 8px;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.primary}">${escapeHtml(block.eyebrow)}</p>
              <h1 style="margin:0 0 14px;font-family:${FONT};font-size:24px;line-height:1.3;font-weight:700;color:${C.ink}">${escapeHtml(block.heading)}</h1>
              <p style="margin:0;font-family:${FONT};font-size:15px;line-height:1.65;color:${C.inkSoft}">${escapeHtml(block.lead)}</p>
            </td></tr>
${detail}
${cta}
${note}
            ${footnotes ? `<tr><td style="padding:4px 0 0">${footnotes}</td></tr>` : ""}
          </table>
        </td></tr>

        <tr><td style="padding:22px 12px 0;text-align:center">
          <p style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.inkSoft}">
            <a href="${escapeHtml(siteConfig.url)}" style="color:${C.primary};text-decoration:none;font-weight:600">${escapeHtml(siteConfig.name)}</a>
            &nbsp;·&nbsp; ${escapeHtml(siteConfig.tagline)}
          </p>
          <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.inkSoft}">
            You are getting this because you booked or hosted a session on ${escapeHtml(host)}.<br>
            Questions? Just reply to this email.
          </p>
        </td></tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * The same message as text.
 *
 * Built from the block rather than by stripping tags out of the HTML: a regex
 * over markup is one nested tag away from emitting garbage, and this half is
 * what a screen reader and a plain-text client actually read.
 */
function plainText(block: EmailBlock): string {
  const lines: string[] = [block.heading, "", block.lead];

  if (block.details) {
    lines.push("", block.details.title.toUpperCase());
    for (const row of block.details.rows) lines.push(`  ${row.label}: ${row.value}`);
  }
  if (block.cta) lines.push("", `${block.cta.label}: ${block.cta.href}`);
  if (block.note) lines.push("", block.note.text);
  for (const line of block.footnotes ?? []) lines.push("", line);

  lines.push("", "—", `${siteConfig.name} · ${siteConfig.url}`, "Questions? Just reply to this email.");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

/**
 * The other person on the call, as far as this email is allowed to describe
 * them.
 *
 * Which fields are populated depends on who is reading: a mentee sees the
 * mentor's credentials, a mentor sees enough about the mentee to prepare. The
 * mentee's email address is deliberately not here — the mentor dashboard does
 * not show it either, and a notification is a bad place to widen what the
 * product discloses.
 */
export type CounterpartDetails = {
  name: string;
  /** Mentor-side, shown to a mentee. */
  currentRole?: string | null;
  examCleared?: string | null;
  examYear?: number | null;
  institute?: string | null;
  /** Mentee-side, shown to a mentor. */
  academicStatus?: string | null;
  collegeName?: string | null;
};

export type RenderContext = {
  event: NotificationEvent;
  audience: "MENTEE" | "MENTOR";
  recipientName: string | null;
  counterpart: CounterpartDetails;
  startsAt: Date;
  durationMinutes: number;
  /**
   * The session page, which is the only address any email carries.
   *
   * There is no meetLink here on purpose. A booking's Jitsi room is derived
   * from its id and so never changes, which makes it exactly the wrong thing to
   * put in an inbox: it would still open that room weeks later, for anyone the
   * mail was forwarded to. Rooms are minted per person, per request, inside the
   * join window — see src/app/bookings/[id]/join/route.ts.
   */
  bookingUrl: string;
  amount: number;
};

/** What a mentee is told about their mentor. */
function mentorRows(c: CounterpartDetails): DetailRow[] {
  const cleared =
    c.examCleared && c.examYear ? `${c.examCleared} · ${c.examYear}` : (c.examCleared ?? null);
  return rows([
    ["Mentor", c.name],
    ["Currently", c.currentRole ?? c.institute],
    ["Cleared", cleared],
  ]);
}

/** What a mentor is told about their mentee. */
function menteeRows(c: CounterpartDetails): DetailRow[] {
  return rows([
    ["Mentee", c.name],
    ["Year", c.academicStatus],
    ["College", c.collegeName],
  ]);
}

/**
 * The same person, described at three depths.
 *
 * The confirmation is where credentials belong — it is the email somebody
 * re-reads to remind themselves who they booked. By the reminder the day
 * before, one line of context is plenty, and thirty minutes out anything beyond
 * the name and the time is in the way of the join button.
 */
function briefCounterpartRows(ctx: RenderContext): DetailRow[] {
  const c = ctx.counterpart;
  return ctx.audience === "MENTEE"
    ? rows([
        ["Mentor", c.name],
        ["Currently", c.currentRole ?? c.institute],
      ])
    : rows([
        ["Mentee", c.name],
        ["Year", c.academicStatus],
      ]);
}

function counterpartNameRow(ctx: RenderContext): DetailRow {
  return { label: ctx.audience === "MENTEE" ? "Mentor" : "Mentee", value: ctx.counterpart.name };
}

function whenRows(ctx: RenderContext): DetailRow[] {
  return rows([
    ["When", formatIstDateTime(ctx.startsAt)],
    ["How long", formatDuration(ctx.durationMinutes)],
  ]);
}

/**
 * What we tell people about the door, ahead of the day.
 *
 * Quoting the numbers from meeting.ts rather than writing them out: this
 * sentence is a promise about what a button will do, and the page is what
 * actually decides. One of them being wrong is a support email.
 *
 * The mentor is told about their head start on purpose — it is how they end up
 * being the one who opens the room, and on public Jitsi whoever opens the room
 * runs it. A mentor who knows that turns up first.
 */
function joinNote(ctx: RenderContext): string {
  return ctx.audience === "MENTOR"
    ? `The join button on the session page appears ${MENTOR_JOIN_OPENS_BEFORE_MINUTES} minutes before the start — ${MENTOR_JOIN_OPENS_BEFORE_MINUTES - MENTEE_JOIN_OPENS_BEFORE_MINUTES} minutes ahead of your mentee, so the room is yours to open and yours to run. Until then there is nothing to click, for either of you.`
    : `The join button on the session page appears ${MENTEE_JOIN_OPENS_BEFORE_MINUTES} minutes before the start time. Until then there is nothing to click — it stays shut so nobody ends up sitting in an empty room, and so the link cannot be reused later by anyone it was passed to.`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

/**
 * Turn one queued notification into a message.
 *
 * Rendering happens here, at send time, never at enqueue time. That is what
 * keeps a broken template out of the booking flow: the worst a mistake in this
 * file can do is fail one notification row, where the same mistake inside a
 * booking transaction would have taken the booking down with it.
 */
export function renderEmail(ctx: RenderContext): RenderedEmail {
  const other = ctx.counterpart.name;
  const hello = firstName(ctx.recipientName);
  const when = formatIstDateTime(ctx.startsAt);

  switch (ctx.event) {
    case "BOOKING_CONFIRMED": {
      if (ctx.audience === "MENTEE") {
        const block: EmailBlock = {
          preheader: `Your slot with ${other} on ${when} is locked in.`,
          eyebrow: "Booking confirmed",
          heading: `You're booked with ${other}`,
          lead: `Hi ${hello}, your payment went through and the slot is yours.`,
          details: {
            title: "Your session",
            rows: [
              ...mentorRows(ctx.counterpart),
              ...whenRows(ctx),
              { label: "Paid", value: `₹${ctx.amount}` },
            ],
          },
          cta: { label: "View your session", href: ctx.bookingUrl },
          note: { tone: "info", text: joinNote(ctx) },
          footnotes: [
            "We will remind you the day before, and again half an hour before it starts.",
            "Come with specific questions if you can — a session where you know what you want to ask is worth three where you do not.",
          ],
        };
        return { subject: `Confirmed: your session with ${other}`, html: shell(block), text: plainText(block) };
      }

      const block: EmailBlock = {
        preheader: `${other} booked ${when}, and has already paid.`,
        eyebrow: "New booking",
        heading: `${other} booked a session with you`,
        lead: `Hi ${hello}, this one is confirmed — the mentee has already paid. Here is who you are meeting.`,
        details: {
          title: "The session",
          rows: [...menteeRows(ctx.counterpart), ...whenRows(ctx)],
        },
        cta: { label: "View the session", href: ctx.bookingUrl },
        note: { tone: "info", text: joinNote(ctx) },
        footnotes: [
          "We will remind you the day before, and again half an hour before it starts.",
          "If something comes up and you cannot make it, say so as early as you can — a student who finds out late has usually planned their day around this.",
        ],
      };
      return { subject: `New session booked by ${other}`, html: shell(block), text: plainText(block) };
    }

    case "SESSION_REMINDER_24H": {
      const block: EmailBlock = {
        preheader: `${when} — with ${other}.`,
        eyebrow: "Reminder",
        heading: `Tomorrow: your session with ${other}`,
        lead:
          ctx.audience === "MENTEE"
            ? `Hi ${hello}, just so it is on your radar — this is happening tomorrow.`
            : `Hi ${hello}, a heads-up that you are mentoring tomorrow.`,
        details: {
          title: ctx.audience === "MENTEE" ? "Your session" : "The session",
          rows: [...briefCounterpartRows(ctx), ...whenRows(ctx)],
        },
        cta: { label: "View the session", href: ctx.bookingUrl },
        note: { tone: "info", text: joinNote(ctx) },
        footnotes:
          ctx.audience === "MENTEE"
            ? ["Worth five minutes tonight: write down the two or three things you most want out of this."]
            : [],
      };
      return { subject: `Tomorrow: your session with ${other}`, html: shell(block), text: plainText(block) };
    }

    case "SESSION_REMINDER_30M": {
      // No room link in here, deliberately. This email goes out half an hour
      // ahead, and the call does not open for another twenty-odd minutes — a
      // "join now" button at this point either lies or hands over a permanent
      // room URL that outlives the session. It points at the session page, and
      // the button appears there, on its own, when it is time.
      const opensInMinutes =
        30 -
        (ctx.audience === "MENTOR"
          ? MENTOR_JOIN_OPENS_BEFORE_MINUTES
          : MENTEE_JOIN_OPENS_BEFORE_MINUTES);
      const block: EmailBlock = {
        preheader: `${other} is expecting you at ${when}. Keep this tab handy.`,
        eyebrow: "Starting soon",
        heading: "Your session starts in 30 minutes",
        lead: `Hi ${hello}, ${other} is expecting you at ${when}. Open the session page now and leave it open — the join button appears on it in about ${opensInMinutes} minutes.`,
        details: {
          title: "Right now",
          rows: [counterpartNameRow(ctx), { label: "Starts", value: when }],
        },
        cta: { label: "Open the session page", href: ctx.bookingUrl },
        note: {
          tone: "urgent",
          text: "If you cannot make it after all, open the session page and say so now rather than leaving them waiting.",
        },
      };
      return {
        subject: `Starting in 30 minutes: your session with ${other}`,
        html: shell(block),
        text: plainText(block),
      };
    }

    case "SESSION_FEEDBACK": {
      const block: EmailBlock = {
        preheader: `Two minutes: confirm it happened and rate ${other}.`,
        eyebrow: "How did it go?",
        heading: `How was your session with ${other}?`,
        lead: `Hi ${hello}, your session should have wrapped up. Two things, and both are quick.`,
        details: {
          title: "The session",
          rows: [counterpartNameRow(ctx), { label: "Was", value: when }],
        },
        cta: { label: "Rate your session", href: ctx.bookingUrl },
        footnotes: [
          "Confirm it actually happened, and leave a rating. Only someone who sat through a session can review it, which is exactly why these ratings are worth reading — and why yours genuinely helps the next student choose.",
          "If something went wrong, say so on the same page and we will look into it.",
        ],
      };
      return { subject: `How was your session with ${other}?`, html: shell(block), text: plainText(block) };
    }
  }
}

/**
 * A diagnostic message, for the "send a test email" button in the admin area.
 *
 * Deliberately rendered through the same shell as every real notification: a
 * test that looks nothing like production mail tells you the API key works and
 * nothing about whether your email renders correctly in Gmail.
 */
export function renderTestEmail(opts: { transport: string; from: string; sentAt: Date }): RenderedEmail {
  const block: EmailBlock = {
    preheader: "Your sending domain, API key and DNS are all working.",
    eyebrow: "Test email",
    heading: "Your email setup works",
    lead: `If you are reading this, ${siteConfig.name} can send email: the API key is valid, the sending domain is verified, and DKIM and SPF passed well enough to reach an inbox.`,
    details: {
      title: "What sent this",
      rows: [
        { label: "Transport", value: opts.transport },
        { label: "From", value: opts.from },
        { label: "Sent", value: formatIstDateTime(opts.sentAt) },
      ],
    },
    cta: { label: "Open the site", href: siteConfig.url },
    note: {
      tone: "info",
      text: "This is the exact layout every booking confirmation and reminder uses, so whatever it looks like here is what your students and mentors will see.",
    },
    footnotes: [
      "Worth checking while you are here: that it did not land in spam or the Promotions tab, that the sender name reads correctly, and that hitting reply reaches a real inbox.",
    ],
  };

  return { subject: `Test email from ${siteConfig.name}`, html: shell(block), text: plainText(block) };
}
