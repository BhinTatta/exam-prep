-- Who actually turned up to the video call.
--
-- Written when somebody is handed a room URL by /bookings/[id]/join, which is
-- now the only way to get one. See prisma/schema.prisma for what this can and
-- cannot tell you (intent to join: yes; time spent in the room: no).

CREATE TYPE "MeetingParticipantRole" AS ENUM ('MENTEE', 'MENTOR', 'ADMIN');

CREATE TABLE "MeetingAttendance" (
  "id"                  TEXT                     NOT NULL,
  "bookingId"           TEXT                     NOT NULL,
  "userId"              TEXT                     NOT NULL,
  "role"                "MeetingParticipantRole" NOT NULL,
  "firstJoinedAt"       TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastJoinedAt"        TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "joins"               INTEGER                  NOT NULL DEFAULT 1,
  "moderator"           BOOLEAN                  NOT NULL DEFAULT false,
  "joinedOffsetSeconds" INTEGER,
  "createdAt"           TIMESTAMP(3)             NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3)             NOT NULL,

  CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- One row per person per call: this is what the join route's upsert targets, so
-- a rejoin after a dropped connection increments a counter instead of adding a
-- second attendee.
CREATE UNIQUE INDEX "MeetingAttendance_bookingId_userId_key"
  ON "MeetingAttendance" ("bookingId", "userId");

-- "Who joined this session?", the read every admin view does.
CREATE INDEX "MeetingAttendance_bookingId_idx"
  ON "MeetingAttendance" ("bookingId");

ALTER TABLE "MeetingAttendance"
  ADD CONSTRAINT "MeetingAttendance_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MeetingAttendance"
  ADD CONSTRAINT "MeetingAttendance_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
