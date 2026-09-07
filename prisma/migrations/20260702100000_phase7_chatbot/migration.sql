-- Phase 7: chatbot handoff metadata.

CREATE TYPE "ChatHandoffStatus" AS ENUM ('OPEN', 'RESOLVED');

ALTER TABLE "ChatSession"
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "status" "ChatHandoffStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ChatSession_handoffRequested_status_idx" ON "ChatSession"("handoffRequested", "status");
CREATE INDEX "ChatSession_updatedAt_idx" ON "ChatSession"("updatedAt");
