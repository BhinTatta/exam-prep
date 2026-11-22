# Slot requests ("Notify me")

A student who goes looking for a session and finds nothing to book used to
leave without a trace. Now they can click **Notify me**, and that click is kept
as a `SlotRequest` row. Two halves:

1. **Capture**: built. Rows are written, admins see them on `/admin/demand`,
   and mentors see how many students are waiting on their dashboard.
2. **Notify**: not built yet. The design is below, and it reuses the existing
   notification outbox (`docs/notifications.md`), so building it means adding to
   that system. It does not need a new one.

## Where students can ask

| Dead end | Request written | `source` |
|---|---|---|
| Mentor profile with no open slots | that mentor, any day | `mentor_profile` |
| Mentor profile with slots, "None of these times work?" | that mentor, any day | `mentor_profile` |
| `/mentors` when every mentor is booked out (banner on top) | any mentor, any day | `mentor_list` |
| `/mentors` below the list ("Can't find a time that works?") | any mentor, the picked day or any | `mentor_list` |
| `/mentors` with no verified mentors at all | any mentor, any day | `mentor_list` |

Signed-out visitors get "Sign in to get notified", which brings them back to the
same page. We need an account to notify anyone, and an anonymous click tells an
admin nothing they can act on.

## The row

`SlotRequest`: `userId`, `mentorId?` (null = any mentor), `dayOfWeek?` (null =
any day), `source`, `status` (`OPEN` / `NOTIFIED` / `CANCELLED`), `notifiedAt`.

- **One open request per (student, mentor, day).** `requestSlotAlert` in
  `src/app/slot-requests/actions.ts` checks before inserting, so a second click
  doesn't count the same student twice. Two clicks racing could still both
  insert. That only inflates a count on an admin page, so there is no partial
  unique index for it: Prisma can't express one, and `migrate dev` would keep
  trying to drop a hand-written one. Add it when duplicate rows would send
  duplicate emails, which is the notify half.
- **"Remove me" sets `CANCELLED`, it doesn't delete.** Demand history stays
  intact.
- Rows cascade away with the user or the mentor profile.

## Notify: the plan

### Trigger

Matching happens when supply appears. That is `addAvailability` in
`src/app/mentors/actions.ts`, and a cancelled, expired or refunded booking that
frees its time. After the `Availability` insert, call a
`planSlotAlerts(mentorId, days)`, where `days` are the rule's weekdays, that
finds the requests the new rule satisfies:

```sql
status = 'OPEN'
AND (mentorId = :mentorId OR mentorId IS NULL)
AND (dayOfWeek = ANY(:days) OR dayOfWeek IS NULL)
```

Wrap it in `try`/`catch` the same way `planBookingNotifications` is wrapped. A
notification problem must never fail a mentor's save.

### Enqueue, don't send

For each matched request, insert a `Notification` row:

- `event = SLOTS_AVAILABLE`. This is a new `NotificationEvent` value.
- `slotRequestId`. This is a new nullable FK on `Notification`. The existing
  `@@unique([bookingId, userId, event, channel])` doesn't fit, because
  `bookingId` is null here, so add `@@unique([slotRequestId, channel])` as the
  idempotency guard.
- `sendAfter = now() + 10 minutes`. A mentor usually adds several slots in one
  sitting. The delay, together with the unique key, means a student gets one
  email for that sitting, not five.

The existing cron drain (`src/lib/notifications/dispatch.ts`) then sends the
email, with retries, `lastError` and the admin page, all as it does today.

### At send time

Re-check before sending, as the reminders already do:

- the request is still `OPEN`, so a student who clicked "Remove me" in the last
  ten minutes isn't emailed;
- a matching slot is still free. If someone booked it during the delay, mark the
  notification `SKIPPED` and leave the request `OPEN` for the next slot.

On send, set the request to `NOTIFIED` with `notifiedAt`. The email links to the
mentor's profile, or to `/mentors?day=…` for an any-mentor request.

### Fan-out and fairness

An "any mentor" request matches every new slot from every mentor. After one
email it is `NOTIFIED`, so a student is told once and then has to ask again. That
stops a busy week from turning into an inbox flood. If students would rather
stay subscribed, change `NOTIFIED` to "re-arm after N days" instead of making it
terminal.

If one slot matches 40 waiting students, all 40 are told and the first one to
book gets it. That is fine at this scale. If it starts to feel bad, notify in
`createdAt` order in batches, with a gap between batches.

### Expiry

Requests go stale. A student who asked in March has probably sat the exam by
June. Have the drain mark `OPEN` requests older than ~45 days as `CANCELLED` (or
add an `EXPIRED` status), so the admin demand count reflects current interest.

### Telegram

This comes free with the outbox. When the Telegram channel lands, a
`SLOTS_AVAILABLE` row on `channel = TELEGRAM` uses the same matcher.

## Until then

`/admin/demand` is the manual version of all of this. It lists each waiting
student's email and flags mentors who have been asked for and now have open
slots ("open now — tell them"). The student-facing copy says "You're on the
list" and nothing more, so nothing on the site promises an email we don't send
yet.
