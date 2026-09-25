-- Notifications: an absolute session time, and a transactional outbox.
--
-- Two things that have to land together, because the second is useless without
-- the first. `Availability` is a recurring weekly pattern (dayOfWeek +
-- "HH:mm" in IST), so until now nothing in the database knew when any given
-- session actually happened — which makes "remind me 30 minutes before" an
-- unwritable query. See prisma/schema.prisma for the rationale on each column
-- and src/lib/days.ts for the resolution rule this backfill mirrors.

-- ---------- 1. Booking: when is this session, really ----------

ALTER TABLE "Booking"
  ADD COLUMN "scheduledStartAt" TIMESTAMP(3),
  ADD COLUMN "durationMinutes"  INTEGER;

-- Backfill from the slot each booking was made against.
--
-- The session was the next occurrence of that weekly slot at or after the
-- booking was created, resolved in IST — the same rule as
-- resolveSlotOccurrence() in src/lib/days.ts, including the "a slot earlier
-- today has already gone, so it's next week's" case.
--
-- On the timezone gymnastics: Prisma maps DateTime to `timestamp(3)` WITHOUT
-- time zone, so every timestamp in this database is a naive value that means
-- UTC. Postgres reads `naive AT TIME ZONE z` as "this wall clock is in z" and
-- returns an instant, and `instant AT TIME ZONE z` as "give me the wall clock
-- in z" and returns a naive value. So each direction needs both steps, and
-- getting one of them backwards silently shifts every session by 5.5 hours:
--
--   naive UTC -> IST wall clock :  ts AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata'
--   IST wall clock -> naive UTC :  ts AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC'
WITH resolved AS (
  SELECT
    b."id",
    a."duration"        AS duration,
    a."dayOfWeek"       AS target_dow,
    a."startTime"::time AS slot_time,
    -- The booking's creation moment, as it read on an Indian clock.
    (b."createdAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kolkata') AS created_ist
  FROM "Booking" b
  JOIN "Availability" a ON a."id" = b."slotId"
)
UPDATE "Booking" b
SET
  "scheduledStartAt" = (
    date_trunc('day', r.created_ist)
    + make_interval(days => CASE
        -- The slot's own weekday had already come round that day, at or before
        -- the moment of booking, so what was booked was next week's.
        WHEN (r.target_dow - EXTRACT(DOW FROM r.created_ist)::int + 7) % 7 = 0
             AND r.slot_time <= r.created_ist::time
        THEN 7
        ELSE (r.target_dow - EXTRACT(DOW FROM r.created_ist)::int + 7) % 7
      END)
    + r.slot_time
  ) AT TIME ZONE 'Asia/Kolkata' AT TIME ZONE 'UTC',
  "durationMinutes" = r.duration
FROM resolved r
WHERE b."id" = r."id"
  AND b."scheduledStartAt" IS NULL;

-- Serves the completion sweep and "which sessions start soon".
CREATE INDEX "Booking_status_scheduledStartAt_idx"
  ON "Booking" ("status", "scheduledStartAt");

-- ---------- 2. The outbox ----------

CREATE TYPE "NotificationChannel" AS ENUM ('EMAIL', 'TELEGRAM');

CREATE TYPE "NotificationEvent" AS ENUM (
  'BOOKING_CONFIRMED',
  'SESSION_REMINDER_24H',
  'SESSION_REMINDER_30M',
  'SESSION_FEEDBACK'
);

CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "Notification" (
  "id"        TEXT                  NOT NULL,
  "event"     "NotificationEvent"   NOT NULL,
  "channel"   "NotificationChannel" NOT NULL,
  "status"    "NotificationStatus"  NOT NULL DEFAULT 'PENDING',
  "userId"    TEXT                  NOT NULL,
  "bookingId" TEXT,
  "sendAfter" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "attempts"  INTEGER               NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "sentAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3)          NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3)          NOT NULL,

  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- The idempotency guard. A Razorpay webhook delivered three times tries to
-- enqueue the same confirmation three times; this makes attempts two and three
-- no-ops rather than three emails. Rows with a NULL bookingId never collide
-- under Postgres NULL semantics, leaving room for account-level notifications.
CREATE UNIQUE INDEX "Notification_bookingId_userId_event_channel_key"
  ON "Notification" ("bookingId", "userId", "event", "channel");

-- The drain query: PENDING rows whose sendAfter has passed, oldest first.
CREATE INDEX "Notification_status_sendAfter_idx"
  ON "Notification" ("status", "sendAfter");

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
