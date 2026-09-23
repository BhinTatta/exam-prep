-- Mentor ranking, social proof and curation.
--
-- Three columns, all denormalised on purpose: every mentor listing renders a
-- rating, a session count and a sort order, and none of those may cost a
-- query (or an aggregate) per card. See prisma/schema.prisma for the rationale
-- on each, and src/lib/mentors/rank.ts for the rating formula.

ALTER TABLE "MentorProfile"
  ADD COLUMN "ratingScore"  DOUBLE PRECISION NOT NULL DEFAULT 4.5,
  ADD COLUMN "paidSessions" INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN "featuredRank" INTEGER;

-- Backfill the weighted rating from the rollups already on the row.
-- (ratingSum + PRIOR_MEAN * PRIOR_WEIGHT) / (reviewCount + PRIOR_WEIGHT),
-- with PRIOR_MEAN = 4.5 and PRIOR_WEIGHT = 5. A mentor with no reviews lands
-- on exactly 4.5, which is the column default.
UPDATE "MentorProfile"
SET "ratingScore" = ("ratingSum" + 22.5) / ("reviewCount" + 5)::double precision;

-- Backfill the session count from bookings that were actually paid for.
-- CONFIRMED / COMPLETED / DISPUTED are the states reachable only after a
-- capture; REFUNDED is excluded because the money went back.
UPDATE "MentorProfile" m
SET "paidSessions" = paid.n
FROM (
  SELECT "mentorId", COUNT(*)::int AS n
  FROM "Booking"
  WHERE "status" IN ('CONFIRMED', 'COMPLETED', 'DISPUTED')
  GROUP BY "mentorId"
) AS paid
WHERE m."id" = paid."mentorId";

CREATE INDEX "MentorProfile_verified_ratingScore_idx"
  ON "MentorProfile" ("verified", "ratingScore" DESC);

CREATE INDEX "MentorProfile_verified_featuredRank_idx"
  ON "MentorProfile" ("verified", "featuredRank");
