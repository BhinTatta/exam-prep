-- "Notify me" requests: a student wanted a session and found nothing to book.
-- Captured for the admin demand view now; the notification sender reads the
-- same rows later. See docs/slot-requests.md.

-- CreateEnum
CREATE TYPE "SlotRequestStatus" AS ENUM ('OPEN', 'NOTIFIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "SlotRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT,
    "dayOfWeek" INTEGER,
    "source" TEXT NOT NULL,
    "status" "SlotRequestStatus" NOT NULL DEFAULT 'OPEN',
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlotRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SlotRequest_status_mentorId_idx" ON "SlotRequest"("status", "mentorId");

-- CreateIndex
CREATE INDEX "SlotRequest_userId_status_idx" ON "SlotRequest"("userId", "status");

-- AddForeignKey
ALTER TABLE "SlotRequest" ADD CONSTRAINT "SlotRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlotRequest" ADD CONSTRAINT "SlotRequest_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "MentorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
