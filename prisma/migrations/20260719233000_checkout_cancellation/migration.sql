ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED' AFTER 'FAILED';

ALTER TABLE "PaymentAttempt"
  ADD COLUMN "checkoutCancelTokenHash" TEXT,
  ADD COLUMN "cancelRequestedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "PaymentAttempt_checkoutCancelTokenHash_key"
  ON "PaymentAttempt"("checkoutCancelTokenHash");
