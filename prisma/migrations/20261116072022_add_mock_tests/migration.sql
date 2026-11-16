-- CreateEnum
CREATE TYPE "MockQuestionType" AS ENUM ('MCQ', 'MSQ', 'NAT');

-- CreateEnum
CREATE TYPE "MockAttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "MockResponseStatus" AS ENUM ('NOT_VISITED', 'NOT_ANSWERED', 'ANSWERED', 'MARKED', 'ANSWERED_MARKED');

-- CreateTable
CREATE TABLE "MockTest" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "year" INTEGER,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 180,
    "calculator" BOOLEAN NOT NULL DEFAULT true,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockSection" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "instructions" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "MockSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockQuestion" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "MockQuestionType" NOT NULL,
    "topic" TEXT,
    "prompt" TEXT NOT NULL,
    "imageUrl" TEXT,
    "options" JSONB,
    "correctOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "natMin" DOUBLE PRECISION,
    "natMax" DOUBLE PRECISION,
    "marks" DOUBLE PRECISION NOT NULL,
    "negativeMarks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "explanation" TEXT,

    CONSTRAINT "MockQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockAttempt" (
    "id" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "MockAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "autoSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "score" DOUBLE PRECISION,
    "maxScore" DOUBLE PRECISION,
    "correctCount" INTEGER,
    "incorrectCount" INTEGER,
    "unattemptedCount" INTEGER,
    "sectionBreakdown" JSONB,

    CONSTRAINT "MockAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MockResponse" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "numericAnswer" TEXT,
    "status" "MockResponseStatus" NOT NULL DEFAULT 'NOT_VISITED',
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "isCorrect" BOOLEAN,
    "marksAwarded" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MockResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MockTest_slug_key" ON "MockTest"("slug");

-- CreateIndex
CREATE INDEX "MockTest_published_idx" ON "MockTest"("published");

-- CreateIndex
CREATE UNIQUE INDEX "MockSection_testId_order_key" ON "MockSection"("testId", "order");

-- CreateIndex
CREATE INDEX "MockQuestion_sectionId_idx" ON "MockQuestion"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "MockQuestion_testId_number_key" ON "MockQuestion"("testId", "number");

-- CreateIndex
CREATE INDEX "MockAttempt_testId_status_idx" ON "MockAttempt"("testId", "status");

-- CreateIndex
CREATE INDEX "MockAttempt_userId_testId_idx" ON "MockAttempt"("userId", "testId");

-- CreateIndex
CREATE UNIQUE INDEX "MockResponse_attemptId_questionId_key" ON "MockResponse"("attemptId", "questionId");

-- AddForeignKey
ALTER TABLE "MockSection" ADD CONSTRAINT "MockSection_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MockTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockQuestion" ADD CONSTRAINT "MockQuestion_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MockTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockQuestion" ADD CONSTRAINT "MockQuestion_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "MockSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_testId_fkey" FOREIGN KEY ("testId") REFERENCES "MockTest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockAttempt" ADD CONSTRAINT "MockAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockResponse" ADD CONSTRAINT "MockResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "MockAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockResponse" ADD CONSTRAINT "MockResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "MockQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
