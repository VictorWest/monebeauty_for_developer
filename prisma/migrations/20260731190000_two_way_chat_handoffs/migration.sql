ALTER TABLE "ChatSession" ADD COLUMN "publicTokenHash" TEXT;
ALTER TABLE "OutboundMessage" ADD COLUMN "chatSessionId" TEXT;

CREATE INDEX "OutboundMessage_chatSessionId_createdAt_idx"
  ON "OutboundMessage"("chatSessionId", "createdAt");

ALTER TABLE "OutboundMessage"
  ADD CONSTRAINT "OutboundMessage_chatSessionId_fkey"
  FOREIGN KEY ("chatSessionId") REFERENCES "ChatSession"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
