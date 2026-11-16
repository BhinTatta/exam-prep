-- DropIndex
DROP INDEX "MockAttempt_testId_status_idx";

-- DropIndex
DROP INDEX "MockAttempt_userId_testId_idx";

-- CreateIndex
CREATE INDEX "MockAttempt_testId_status_score_idx" ON "MockAttempt"("testId", "status", "score");

-- CreateIndex
CREATE INDEX "MockAttempt_userId_status_submittedAt_idx" ON "MockAttempt"("userId", "status", "submittedAt");
