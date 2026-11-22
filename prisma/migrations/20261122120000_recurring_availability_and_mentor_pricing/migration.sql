-- Recurring availability rules and mentor-set prices.
--
-- An Availability row used to be one weekly slot that a booking used up for
-- good (isBooked). It is now a rule that repeats on several weekdays,
-- optionally across a time range, and is never used up: an occurrence is busy
-- when a live booking covers it. Existing rows become single-day rules with
-- the same time, so every current slot keeps working.

-- AlterTable
ALTER TABLE "Availability" ADD COLUMN "days" INTEGER[],
ADD COLUMN "endTime" TEXT,
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Availability" SET "days" = ARRAY["dayOfWeek"];

ALTER TABLE "Availability" ALTER COLUMN "days" SET NOT NULL;

ALTER TABLE "Availability" DROP COLUMN "dayOfWeek",
DROP COLUMN "isBooked";

-- DropIndex
DROP INDEX "Availability_mentorId_idx";

-- CreateIndex
CREATE INDEX "Availability_mentorId_active_idx" ON "Availability"("mentorId", "active");

-- AlterTable: the mentor's share of each booking, snapshotted at booking time.
ALTER TABLE "Booking" ADD COLUMN "mentorPayout" INTEGER;

-- Existing bookings were all booked under the old fixed split, which the new
-- rule reproduces (price minus up to 100, nothing taken below 200).
UPDATE "Booking" SET "mentorPayout" = CASE
  WHEN "amount" < 200 THEN "amount"
  ELSE "amount" - LEAST(100, "amount" - 199)
END;
