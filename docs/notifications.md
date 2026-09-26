# Notifications

Mentors and mentees should not have to open the site to find out what happened.
This is how they get told: email now, Telegram later, on one mechanism.

## Why an outbox rather than "just send the email"

The obvious implementation is `await sendEmail()` inside the server action that
confirms a booking. Don't. It puts a third party's uptime on the critical path
of a paid transaction: Resend being slow makes a mentee watch a spinner, and
Resend being down fails the confirmation of a booking they have already paid
for.

So nothing in the request path ever talks to an email provider. Instead:

1. A booking is confirmed. The code writes a **`Notification` row** — a
   `bookingId`, a `userId`, an event name and a `sendAfter`. That is a single
   local `INSERT` against our own Postgres, alongside the booking change itself.
2. A **cron tick** drains the table a moment later: pick up what is due, render
   it, send it, mark the row.

What that buys, all from one mechanism:

- **Email cannot break a booking.** If Resend is on fire, rows sit in the table
  and get retried. The booking still committed, the user still got their page.
  Notifications have no veto over payment processing — see the `try`/`catch`
  around `planBookingNotifications` in `src/lib/payments/sync.ts`.
- **Scheduling for free.** "30 minutes before" is a row with a future
  `sendAfter`. Same code path as an immediate send; no separate scheduler.
- **An audit trail.** "Did the mentor actually get told?" is a SQL query, and a
  failed send leaves its reason in `lastError`.
- **Telegram is additive.** The `channel` column already exists. Adding it means
  one adapter and a preference, not a redesign.

The one thing to keep in mind: delivery is **at-least-once**, not exactly-once. A
process dying between "Resend accepted" and "row marked SENT" will retry. The
`idempotencyKey` on the Resend call (the notification's own id) is what stops
that becoming a second copy in somebody's inbox.

## The absolute session time

`Availability` is a recurring weekly pattern — `dayOfWeek` plus `"HH:mm"` in
IST. That is right for a mentor setting their hours and useless for everything
else, because a weekday and a clock time is not a point in time. Before any of
this could work, `Booking` needed `scheduledStartAt`.

The rule lives in `resolveSlotOccurrence()` (`src/lib/days.ts`) and is applied
**once**, when the booking is created. Never re-derive it: re-deriving answers
"when does that weekly slot next fall?", which silently rolls a finished session
forward to next week the moment it passes.

Two things to know if you touch the SQL:

- Prisma maps `DateTime` to `timestamp(3)` **without** time zone, so every
  timestamp in this database is a naive value meaning UTC. Converting to and from
  IST therefore needs *both* steps (`AT TIME ZONE 'UTC' AT TIME ZONE
  'Asia/Kolkata'` and back). Getting one backwards shifts every session by 5½
  hours and nothing complains.
- IST is a fixed UTC+05:30 with no DST, which is the only reason this arithmetic
  is as simple as it is.

## What gets sent

| Event | To | When |
|---|---|---|
| `BOOKING_CONFIRMED` | mentee + mentor | on payment capture |
| `SESSION_REMINDER_24H` | mentee + mentor | 24h before |
| `SESSION_REMINDER_30M` | mentee + mentor | 30m before, carries the join link |
| `SESSION_FEEDBACK` | mentee | 30m after the session ends |

Roughly 7 emails per booking, which is about 14 bookings/day inside Resend's
free tier (100/day). Telegram will take pressure off that, since it is free and
unlimited.

A reminder whose moment has already passed is never queued — confirming a
booking an hour before it starts must not fire a "tomorrow" reminder
immediately. And a reminder is skipped at send time if the booking stopped being
`CONFIRMED`, or if the session has already started. See `RELEVANT_STATUSES` in
`src/lib/notifications/dispatch.ts`.

## No email ever carries a room link

It used to. The `SESSION_REMINDER_30M` email had a "Join the video call" button
pointing straight at the Jitsi room, which meant the room URL — permanent, and
derived from the booking id — was sitting in two inboxes forever, and the door
had to be propped open for half an hour so that the button was not a lie.

Both are gone. Emails link to the session page and nothing else; the join button
lives there, appears 5 minutes before the session (10 for the mentor), and the
address behind it is minted per person per request. See `docs/video-calls.md`.

The T-30m reminder is now a nudge rather than a way in — "open the page and
leave it open" — which is why its lead time no longer has to match anything.

## Why the cron is designed for a sloppy scheduler

Vercel's Hobby plan runs cron jobs **once per day at most**, and fires them
anywhere inside the scheduled hour. A `*/5 * * * *` expression fails the
deployment outright. So a 30-minute reminder cannot run on Vercel Hobby cron, and
the frequent caller is external.

Rather than paying $20/month for per-minute crons, the job is written so
imprecision does not matter: it asks *"what is due?"*, not *"what is due exactly
now?"*, and marks each row as it goes. A tick four minutes late catches up. A
skipped tick catches up. Two overlapping ticks send nothing twice, because each
row is claimed with a conditional `attempts` bump before it is sent.

**Keep that property.** Do not add work to `/api/cron/notifications` that assumes
an exact firing time.

Two callers, deliberately:

- **cron-job.org**, every 5 minutes — the one that actually matters.
- **Vercel Cron**, daily (`vercel.json`) — a safety net for when the external
  pinger is misconfigured or disabled. Vercel adds the `Authorization` header
  itself when `CRON_SECRET` is set.

Swapping the pinger, or moving to Vercel Pro, is configuration: point any
scheduler that can send a header at the same URL.

## Setup

### 1. Cloudflare — receiving (free, optional but do it)

Dashboard → `iitjambuddy.com` → **Email** → **Email Routing** → accept the MX
records it offers, verify your Gmail as a destination, then route
`support@iitjambuddy.com` → that Gmail. This is the `EMAIL_REPLY_TO` address, so
replies reach a person instead of a black hole.

Cloudflare Email Routing is receive-only. It cannot send, which is why sending
needs Resend.

### 2. Resend — sending

1. Sign up at resend.com. No card needed for the free tier.
2. **Domains → Add Domain → `mail.iitjambuddy.com`** — the subdomain, not the
   root. Subdomains are free and already yours; you never buy one. Sender
   reputation is tracked per-domain, so keeping transactional mail on its own
   subdomain means a spam problem here cannot damage human mail at the root.
   (`em.stripe.com`, `e.github.com` — same reason.)
3. Add the three records it shows to Cloudflare DNS: a DKIM `TXT`, an SPF `TXT`,
   and an `MX` for bounce handling. **Two traps:** enter the name as `mail`, not
   `mail.iitjambuddy.com` (Cloudflare appends the domain itself), and set each
   record to **DNS only** — grey cloud, not orange.
4. Verify. Usually under a minute on Cloudflare.
5. **API Keys** → sending access, scoped to that domain. Starts `re_`. You only
   see it once.

### 3. DMARC

Resend does not add this and it materially helps deliverability. Cloudflare DNS,
`TXT` at `_dmarc`:

```
v=DMARC1; p=none; rua=mailto:<your gmail>; adkim=r; aspf=r
```

`p=none` means "report, don't act". Read the reports for a couple of weeks, then
tighten to `p=quarantine`. Starting at `reject` is how people black-hole their
own mail.

### 4. Vercel environment variables

Production (and Preview if you want to test there):

```
RESEND_API_KEY=re_...
EMAIL_FROM="IITJAM Buddy <noreply@mail.iitjambuddy.com>"
EMAIL_REPLY_TO=support@iitjambuddy.com
CRON_SECRET=<openssl rand -base64 32>
```

`NEXT_PUBLIC_APP_URL` must be `https://www.iitjambuddy.com` in production — email
links are absolute, so a wrong value here mails people links to localhost.

### 5. The pinger

cron-job.org → new cronjob:

- URL `https://www.iitjambuddy.com/api/cron/notifications`
- every 5 minutes, method `POST`
- header `Authorization: Bearer <CRON_SECRET>`

## Operating it

### The admin page

`/admin/notifications` is the first place to look. It shows which transport is
live, the from/reply-to addresses, whether `CRON_SECRET` is set, when mail last
went out, and counts for due / scheduled / sent / skipped / failed, over the
last 50 rows of activity with their error text.

Three buttons:

- **Send test** — one message straight through the provider, skipping the queue,
  so it isolates "can we send at all?" (key, domain verification, DNS) from
  "is the queue moving?". It renders through the same layout as real mail, so
  what you see is what students will see. Each one costs a send against the
  free tier's 100/day.
- **Run a tick now** — the same code path the pinger drives. If this clears the
  backlog, the problem is the pinger, not the code.
- **Retry failed** — see below.

`FAILED` rows also surface as a tile on the admin overview, because nobody
thinks to check whether email works until somebody complains they were never
told.


Without `RESEND_API_KEY`, development logs emails to the console
(`ConsoleTransport`) and production fails them loudly rather than marking them
sent having gone nowhere. That is also how you exercise the flow before DNS
propagates — every provider refuses to mail arbitrary addresses until the domain
is verified.

Useful queries:

```sql
-- anything stuck
SELECT event, status, attempts, "lastError", "sendAfter"
FROM "Notification" WHERE status IN ('PENDING','FAILED') ORDER BY "sendAfter";

-- did this booking's people get told?
SELECT event, "userId", status, "sentAt" FROM "Notification" WHERE "bookingId" = '...';
```

`SKIPPED` is usually not a bug — a cancelled booking, or a Telegram-login user
with no email address. That second one is the row that makes the case for the
Telegram channel.

Retries back off 2, 4, 8, 16 minutes and give up after 5 attempts, leaving the
row `FAILED` with a reason.

`FAILED` is not permanent — it just means nothing will retry on its own. If the
cause was environmental (a missing `RESEND_API_KEY` burns through all five
attempts in about half an hour), fix the cause and press **Retry failed** on
`/admin/notifications`, or do the same thing by hand:

```sql
UPDATE "Notification"
SET status = 'PENDING', attempts = 0, "sendAfter" = now()
WHERE status = 'FAILED' AND "lastError" LIKE '%RESEND_API_KEY%';
```

The drain also repairs the outbox on every tick: `planMissingNotifications()`
queues any confirmed booking with a future session that somehow has no rows. So
the outbox is authoritative by construction, rather than by trusting every call
site to remember — which is also why losing the enqueue in `sync.ts` delays mail
rather than dropping it.

## Checking it still works

`scripts/verify-notifications.ts` exercises scheduling, idempotency, the drain,
the skip rules and the link window against a real database. It deletes data, so
it refuses to run against anything that does not look local.

```
createdb examprep_check
DATABASE_URL=... DIRECT_URL=... npx prisma migrate deploy
DATABASE_URL=... DIRECT_URL=... npx tsx scripts/verify-notifications.ts
```

## The templates

All five messages share one shell in `src/lib/notifications/render.ts`: logo,
eyebrow label, heading, lead, a stacked detail panel, a call to action, and an
optional coloured note. Templates supply structured content (`EmailBlock`) and
never raw HTML, so the plain-text half is built from the same data rather than
by stripping tags out of the markup.

What a reader is told depends on who they are. A mentee sees the mentor's
credentials; a mentor sees the mentee's year and college — enough to walk in
prepared, and deliberately *not* their email address, which the mentor
dashboard does not show either. Rows with no value are dropped, so nobody gets
"College: —". Detail depth tapers with urgency: the confirmation carries full
credentials, the 24-hour reminder one line of context, and the 30-minute
reminder only the name and the time, because anything else is between the
reader and the join button.

Three constraints worth knowing before editing:

- **Colours are hex, not tokens.** `globals.css` defines the palette in
  `oklch()`, which no email client understands — one `oklch()` in a style
  attribute and the element renders with no colour at all. The Lattice palette
  is converted once at the top of `render.ts` and kept in step by hand.
- **Tables, not divs.** Outlook on Windows renders through Word, which ignores
  most of the box model. The 600px container is fluid (`width:100%` +
  `max-width`) with an MSO conditional wrapper for Outlook; a `width="600"`
  *attribute* would beat `max-width` and push the layout off the right edge of
  every phone.
- **No webfont.** The site sets headings in Schibsted Grotesk, but Gmail strips
  both `@font-face` and `<link>`. The identity carries on the logo, the indigo
  and the layout instead.

The logo is `/brand/logo-light.png` referenced absolutely off
`NEXT_PUBLIC_APP_URL`, so that variable has to be right in production or every
email shows a broken image.

### Previewing without sending

```
npx tsx scripts/preview-emails.ts       # writes .preview-emails/index.html
```

Renders every template with representative data, HTML and text, so template
work costs nothing against the 100/day. A browser is not an email client
though — it confirms copy, hierarchy and wrapping, and tells you nothing about
Outlook. For that, send one to yourself from `/admin/notifications`.

## Why there are no templates in the Resend dashboard

There deliberately are none. Every message is rendered in
`src/lib/notifications/render.ts`, which means the copy is reviewed in pull
requests, versioned with the code that sends it, and type-checked against the
data it interpolates — a template editor in a dashboard gets none of that, and
drifts from the code the moment somebody edits it. Resend's template and
broadcast features are aimed at marketing email, which this is not.

The one cost is that changing wording needs a deploy. That is the right trade
for transactional mail.

## Next: Telegram

Free, no approval, instant, and `TELEGRAM_BOT_TOKEN` / `User.telegramId` already
exist. One gotcha: **a bot cannot message a user who has never started a chat
with it.** The login widget gives us their id, not permission to DM them. So it
needs a one-time opt-in — a `https://t.me/<bot>?start=<token>` deep link plus a
webhook to catch the `/start`, following the pattern in
`src/app/api/webhooks/razorpay/route.ts`.

Then: a `channels/telegram.ts` adapter, a preference on `User`, and a channel
choice at enqueue time. Prefer Telegram where available and fall back to email —
Telegram is unlimited where email is capped, and a phone buzz beats a Promotions
tab for "starts in 30 minutes".

WhatsApp is deliberately not on this list: the Cloud API needs business
verification and per-template approval, and is priced per conversation.
