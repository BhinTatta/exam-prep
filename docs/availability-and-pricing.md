# Availability and pricing

## Availability is a set of rules

A mentor doesn't add slots one at a time. They add **rules**, and each rule
repeats every week until they remove it:

- **Days:** any set of weekdays. The editor has "Every day", "Weekdays" and
  "Weekends" shortcuts.
- **When:** either one session at a time ("7:00 PM"), or a range ("6:00 to
  9:00 PM") that is split into back-to-back sessions.
- **Session length:** 30, 45 or 60 minutes.

Each rule is one `Availability` row: `days Int[]`, `startTime`, `endTime?`,
`duration`, `active`.

### A booking never uses up a rule

Students book one **dated occurrence** of a rule ("Sat 29 Nov, 6:30 PM").
That occurrence counts as taken because a live `Booking` covers that time.
Nothing on the rule changes. So:

- the rule keeps offering the same time next week, with no work from the
  mentor;
- a cancelled, expired or refunded booking frees its time just by changing
  status, with no release step to forget;
- a booking blocks any session it overlaps, from any of the mentor's rules.
  A 60-minute booking at 6:15 takes 6:00, 6:30 and 7:00 off a 30-minute range.

Occurrences are computed and never stored. `src/lib/slots.ts` holds the pure
functions: `expandRule`, `openOccurrences` and `isBusy`.
`src/lib/mentors/availability.ts` loads rules together with live bookings. The
listing, the profile and `bookSlot` all use the same code.

Constants in `src/lib/slots.ts`:

| | |
|---|---|
| `BOOKING_HORIZON_DAYS` | 14. How far ahead students can book. |
| `MIN_NOTICE_MINUTES` | 60. Sessions starting sooner are not offered. |
| `SESSION_LENGTHS` | 30 / 45 / 60 |

### Booking is checked on the server

`bookSlot(mentorId, ruleId, startsAtIso)` doesn't trust the time it receives.
The time must be one the rule really produces inside the window. Then, inside a
transaction that locks the mentor's row (`SELECT … FOR UPDATE`), it must not
overlap a live booking. The lock is what stops two students from booking the
same time at once.

### Removing a rule

A rule with no bookings is deleted. A rule that bookings point to is set to
`active = false`, so it stops offering times while those bookings keep their
row. Sessions already booked are not affected either way.

## Pricing

Mentors set their own price, from ₹99 to ₹350 (`sessionPricing` in
`config/site.ts`). New mentors start at ₹350. The platform's cut follows the
price (`src/lib/pricing.ts`):

| Price | Platform cut | Mentor gets |
|---|---|---|
| under ₹200 | ₹0 | all of it |
| ₹200 to ₹299 | price − ₹199 | ₹199 |
| ₹300 to ₹350 | ₹100 | price − ₹100 |

The cut tapers in rather than jumping to ₹100 at ₹200. With a jump, a mentor
charging ₹250 would take home less than one charging ₹199, and no one would
choose a price in that range. With the taper, raising your price never lowers
what you take home.

Below ₹200 the platform also absorbs the payment gateway fee on those sessions.

Each booking stores `amount` (what the student pays) and `mentorPayout` (the
mentor's share) at the moment it is made. Changing the price or the rule later
doesn't change bookings that already exist. The admin payout button reads
`mentorPayout` from the booking and ignores whatever the client sends.
