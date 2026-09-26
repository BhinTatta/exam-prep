/**
 * Write every email template to HTML files you can open in a browser.
 *
 * Template work otherwise costs a real send per look, and the free tier allows
 * a hundred a day. This renders all of them with representative data instead:
 *
 *   npx tsx scripts/preview-emails.ts
 *   # then open .preview-emails/index.html
 *
 * The logo is referenced absolutely (NEXT_PUBLIC_APP_URL), so it only loads in
 * the preview once the site is deployed — pass a local path to see it:
 *
 *   NEXT_PUBLIC_APP_URL=file://$PWD/public npx tsx scripts/preview-emails.ts
 *
 * A browser is not an email client. It tells you the copy, hierarchy and
 * wrapping are right; it tells you nothing about Outlook. For that, send one to
 * yourself from /admin/notifications.
 */

import { mkdirSync, writeFileSync } from "fs";
import { renderEmail, renderTestEmail, type RenderContext } from "../src/lib/notifications/render";

const OUT = ".preview-emails";

const base = {
  startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
  durationMinutes: 60,
  meetLink: "https://meet.jit.si/example-booking",
  bookingUrl: "https://www.iitjambuddy.com/bookings/example",
  amount: 500,
};

/** A fully filled mentor and mentee — rows with no value are dropped, so this is the widest case. */
const mentor = {
  name: "Ananya Verma",
  currentRole: "MSc Physics, IIT Bombay",
  institute: "IIT Bombay",
  examCleared: "JAM Physics",
  examYear: 2023,
};
const mentee = {
  name: "Rahul Kulkarni",
  academicStatus: "Final year",
  collegeName: "Fergusson College, Pune",
};

const cases: [string, RenderContext][] = [
  ["booking-confirmed-mentee", { ...base, event: "BOOKING_CONFIRMED", audience: "MENTEE", recipientName: "Rahul Kulkarni", counterpart: mentor }],
  ["booking-confirmed-mentor", { ...base, event: "BOOKING_CONFIRMED", audience: "MENTOR", recipientName: "Ananya Verma", counterpart: mentee }],
  ["reminder-24h-mentee", { ...base, event: "SESSION_REMINDER_24H", audience: "MENTEE", recipientName: "Rahul Kulkarni", counterpart: mentor }],
  ["reminder-24h-mentor", { ...base, event: "SESSION_REMINDER_24H", audience: "MENTOR", recipientName: "Ananya Verma", counterpart: mentee }],
  ["reminder-30m-mentee", { ...base, event: "SESSION_REMINDER_30M", audience: "MENTEE", recipientName: "Rahul Kulkarni", counterpart: mentor }],
  ["reminder-30m-mentor", { ...base, event: "SESSION_REMINDER_30M", audience: "MENTOR", recipientName: "Ananya Verma", counterpart: mentee }],
  ["session-feedback-mentee", { ...base, event: "SESSION_FEEDBACK", audience: "MENTEE", recipientName: "Rahul Kulkarni", counterpart: mentor }],
];

mkdirSync(OUT, { recursive: true });

const index: string[] = [];
for (const [name, ctx] of cases) {
  const message = renderEmail(ctx);
  writeFileSync(`${OUT}/${name}.html`, message.html);
  writeFileSync(`${OUT}/${name}.txt`, message.text);
  index.push(`<li><a href="${name}.html">${name}</a> — <em>${message.subject}</em> · <a href="${name}.txt">text</a></li>`);
  console.log(`${name.padEnd(28)} ${message.subject}`);
}

const test = renderTestEmail({
  transport: "resend",
  from: "IITJAM Buddy <noreply@mail.iitjambuddy.com>",
  sentAt: new Date(),
});
writeFileSync(`${OUT}/admin-test.html`, test.html);
writeFileSync(`${OUT}/admin-test.txt`, test.text);
index.push(`<li><a href="admin-test.html">admin-test</a> — <em>${test.subject}</em> · <a href="admin-test.txt">text</a></li>`);
console.log(`${"admin-test".padEnd(28)} ${test.subject}`);

writeFileSync(
  `${OUT}/index.html`,
  `<!doctype html><meta charset="utf-8"><title>Email previews</title>
<body style="font:16px/1.6 system-ui;max-width:42rem;margin:3rem auto;padding:0 1rem">
<h1>Email previews</h1>
<p>Rendered from <code>src/lib/notifications/render.ts</code>. Narrow the window to check phone widths.</p>
<ul>${index.join("\n")}</ul>`
);

console.log(`\nOpen ${OUT}/index.html`);
