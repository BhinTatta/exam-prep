-- Payment-gateway booking states.
--
-- Split out from the table changes on purpose: Postgres will not let you
-- ALTER TYPE ... ADD VALUE and then *use* that value inside the same
-- transaction, and Prisma wraps each migration in one. The next migration
-- (add_razorpay_payments) is what references EXPIRED / REFUNDED.
--
-- PAYMENT_SUBMITTED is renamed rather than dropped and recreated, so existing
-- bookings sitting in that state carry over instead of failing the cast.
-- It used to mean "mentee uploaded a UTR + screenshot"; it now means
-- "authorised at Razorpay, not yet captured".

-- AlterEnum
ALTER TYPE "BookingStatus" RENAME VALUE 'PAYMENT_SUBMITTED' TO 'PAYMENT_PROCESSING';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'EXPIRED';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'REFUNDED';
