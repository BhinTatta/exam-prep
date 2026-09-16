-- AlterTable
-- Conversion fields for mentor profiles. Column defaults let this run against
-- existing rows without a NOT NULL violation; the backfill below fills the
-- seeded dummy mentors with plausible content so no card renders half-empty.
ALTER TABLE "MentorProfile" ADD COLUMN     "examCleared" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "examYear" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentRole" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "story" TEXT NOT NULL DEFAULT '';

-- Backfill: derive the exam from the existing free-text rank where possible,
-- so pre-existing profiles still lead with a concrete credential.
UPDATE "MentorProfile"
SET "examCleared" = CASE
      WHEN "rank" ILIKE '%JAM%'  THEN 'JAM Physics'
      WHEN "rank" ILIKE '%GATE%' THEN 'GATE Physics'
      WHEN "rank" ILIKE '%NET%'  THEN 'CSIR NET Physics'
      ELSE 'JAM Physics'
    END
WHERE "examCleared" = '';

UPDATE "MentorProfile"
SET "examYear" = COALESCE(
      NULLIF(SUBSTRING("rank" FROM '(19|20)\d{2}'), '')::INTEGER,
      EXTRACT(YEAR FROM "createdAt")::INTEGER - 1
    )
WHERE "examYear" = 0;

UPDATE "MentorProfile"
SET "currentRole" = 'MSc Physics, ' || "institute"
WHERE "currentRole" = '';

UPDATE "MentorProfile"
SET "languages" = ARRAY['English', 'Hindi']
WHERE "languages" IS NULL OR cardinality("languages") = 0;

UPDATE "MentorProfile"
SET "story" = 'I sat exactly where you are now — same syllabus, same doubts, same panic about what to revise first. Ask me anything about how I actually got through it.'
WHERE "story" = '';
