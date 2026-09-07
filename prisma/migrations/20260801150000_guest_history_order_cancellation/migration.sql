CREATE TYPE "OrderCancellationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TYPE "OutboundMessageKind" ADD VALUE 'ORDER_CANCELLATION_REQUESTED';
ALTER TYPE "OutboundMessageKind" ADD VALUE 'ORDER_CANCELLATION_REQUEST_DECIDED';

ALTER TABLE "Order"
  ADD COLUMN "normalizedEmail" TEXT,
  ADD COLUMN "normalizedPhone" TEXT;

ALTER TABLE "Appointment"
  ADD COLUMN "normalizedContactEmail" TEXT,
  ADD COLUMN "normalizedContactPhone" TEXT;

UPDATE "Order"
SET "normalizedEmail" = CASE
  WHEN lower(btrim("email")) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN lower(btrim("email"))
  ELSE NULL
END;

UPDATE "Appointment"
SET "normalizedContactEmail" = CASE
  WHEN lower(btrim("contactEmail")) ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN lower(btrim("contactEmail"))
  ELSE NULL
END;

UPDATE "Order"
SET "normalizedPhone" = CASE
  WHEN regexp_replace(btrim(COALESCE("phone", '')), '[[:space:]().-]+', '', 'g') ~ '^00[1-9][0-9]{7,14}$'
    THEN '+' || substring(regexp_replace(btrim("phone"), '[[:space:]().-]+', '', 'g') from 3)
  WHEN regexp_replace(btrim(COALESCE("phone", '')), '[[:space:]().-]+', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
    THEN regexp_replace(btrim("phone"), '[[:space:]().-]+', '', 'g')
  WHEN regexp_replace(btrim(COALESCE("phone", '')), '[[:space:]().-]+', '', 'g') ~ '^0[0-9]{5,12}$'
    THEN '+358' || substring(regexp_replace(btrim("phone"), '[[:space:]().-]+', '', 'g') from 2)
  WHEN regexp_replace(btrim(COALESCE("phone", '')), '[[:space:]().-]+', '', 'g') ~ '^[1-9][0-9]{7,14}$'
    THEN '+' || regexp_replace(btrim("phone"), '[[:space:]().-]+', '', 'g')
  ELSE NULL
END;

UPDATE "Appointment"
SET "normalizedContactPhone" = CASE
  WHEN regexp_replace(btrim(COALESCE("contactPhone", '')), '[[:space:]().-]+', '', 'g') ~ '^00[1-9][0-9]{7,14}$'
    THEN '+' || substring(regexp_replace(btrim("contactPhone"), '[[:space:]().-]+', '', 'g') from 3)
  WHEN regexp_replace(btrim(COALESCE("contactPhone", '')), '[[:space:]().-]+', '', 'g') ~ '^\+[1-9][0-9]{7,14}$'
    THEN regexp_replace(btrim("contactPhone"), '[[:space:]().-]+', '', 'g')
  WHEN regexp_replace(btrim(COALESCE("contactPhone", '')), '[[:space:]().-]+', '', 'g') ~ '^0[0-9]{5,12}$'
    THEN '+358' || substring(regexp_replace(btrim("contactPhone"), '[[:space:]().-]+', '', 'g') from 2)
  WHEN regexp_replace(btrim(COALESCE("contactPhone", '')), '[[:space:]().-]+', '', 'g') ~ '^[1-9][0-9]{7,14}$'
    THEN '+' || regexp_replace(btrim("contactPhone"), '[[:space:]().-]+', '', 'g')
  ELSE NULL
END;

CREATE INDEX "Order_normalizedEmail_idx" ON "Order"("normalizedEmail");
CREATE INDEX "Order_normalizedPhone_idx" ON "Order"("normalizedPhone");
CREATE INDEX "Appointment_normalizedContactEmail_idx" ON "Appointment"("normalizedContactEmail");
CREATE INDEX "Appointment_normalizedContactPhone_idx" ON "Appointment"("normalizedContactPhone");

CREATE TABLE "OrderCancellationRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "OrderCancellationRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "decisionReason" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderCancellationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrderCancellationRequest_orderId_status_idx" ON "OrderCancellationRequest"("orderId", "status");
CREATE INDEX "OrderCancellationRequest_clientId_createdAt_idx" ON "OrderCancellationRequest"("clientId", "createdAt");
CREATE INDEX "OrderCancellationRequest_status_createdAt_idx" ON "OrderCancellationRequest"("status", "createdAt");
CREATE UNIQUE INDEX "OrderCancellationRequest_one_pending_per_order" ON "OrderCancellationRequest"("orderId") WHERE "status" = 'PENDING';

ALTER TABLE "OrderCancellationRequest" ADD CONSTRAINT "OrderCancellationRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCancellationRequest" ADD CONSTRAINT "OrderCancellationRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderCancellationRequest" ADD CONSTRAINT "OrderCancellationRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
