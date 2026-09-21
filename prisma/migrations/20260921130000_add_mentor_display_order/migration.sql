-- AlterTable
-- Admin-controlled listing position. Nullable on purpose: NULL means "not
-- pinned", which is every existing mentor, so this adds no rewrite and no
-- backfill. Pinned mentors sort ascending (1 first) ahead of everyone else.
ALTER TABLE "MentorProfile" ADD COLUMN     "displayOrder" INTEGER;

-- CreateIndex
CREATE INDEX "MentorProfile_verified_displayOrder_idx" ON "MentorProfile"("verified", "displayOrder");
