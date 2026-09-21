-- Session feedback: a mentee rates the call they actually paid for.
--
-- Two things make this table cheap to read:
--   * `mentorId` is denormalised off the booking, so a mentor's public reviews
--     are one indexed scan instead of a join through "Booking";
--   * the rollup columns on "MentorProfile" mean a listing of N mentors renders
--     N ratings with zero extra queries.

-- AlterTable
ALTER TABLE "MentorProfile" ADD COLUMN     "reviewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ratingSum" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SessionReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "hiddenAt" TIMESTAMP(3),
    "hiddenBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionReview_bookingId_key" ON "SessionReview"("bookingId");

-- CreateIndex
CREATE INDEX "SessionReview_mentorId_published_createdAt_idx" ON "SessionReview"("mentorId", "published", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "SessionReview_authorId_idx" ON "SessionReview"("authorId");

-- AddForeignKey
ALTER TABLE "SessionReview" ADD CONSTRAINT "SessionReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReview" ADD CONSTRAINT "SessionReview_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "MentorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReview" ADD CONSTRAINT "SessionReview_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionReview" ADD CONSTRAINT "SessionReview_hiddenBy_fkey" FOREIGN KEY ("hiddenBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
