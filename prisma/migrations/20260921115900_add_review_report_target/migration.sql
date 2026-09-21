-- Reviews are public, user-written content, so they need the same report →
-- moderate path as questions and comments.
--
-- In its own migration by the same rule as the booking-status change: Prisma
-- wraps a migration in one transaction, and Postgres will not let a freshly
-- added enum value be *used* in the transaction that added it. The reviews
-- migration that follows this one is free to reference it.

-- AlterEnum
ALTER TYPE "ReportTargetType" ADD VALUE 'REVIEW';
