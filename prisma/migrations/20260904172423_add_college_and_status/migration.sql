-- CreateEnum
CREATE TYPE "AcademicStatus" AS ENUM ('FIRST_YEAR', 'SECOND_YEAR', 'THIRD_YEAR', 'FINAL_YEAR', 'POST_GRADUATE', 'DROPPER', 'WORKING_PROFESSIONAL', 'OTHER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "academicStatus" "AcademicStatus",
ADD COLUMN     "collegeName" TEXT;
