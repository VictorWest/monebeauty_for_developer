ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED' AFTER 'PENDING';

CREATE TYPE "AppointmentEventKind" AS ENUM ('CONFIRMED', 'RESCHEDULED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "CommunicationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "OutboundMessageKind" AS ENUM (
  'ORDER_RECEIPT',
  'ORDER_CONFIRMATION',
  'ORDER_CANCELLATION',
  'APPOINTMENT_RECEIPT',
  'APPOINTMENT_CONFIRMATION',
  'APPOINTMENT_RESCHEDULED',
  'APPOINTMENT_CANCELLATION',
  'APPOINTMENT_REMINDER_24H',
  'APPOINTMENT_REMINDER_2H',
  'CUSTOM'
);
CREATE TYPE "DeliveryStatus" AS ENUM ('ACCEPTED', 'FAILED', 'SKIPPED');

ALTER TABLE "Order"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "fulfilledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "Appointment"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT;

-- RESCHEDULED represented a change event, not a durable lifecycle state. Existing
-- records remain active and return to the clinic confirmation queue.
UPDATE "Appointment" SET "status" = 'BOOKED' WHERE "status" = 'RESCHEDULED';

CREATE TABLE "AppointmentEvent" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "kind" "AppointmentEventKind" NOT NULL,
  "actor" TEXT NOT NULL,
  "previousStatus" "AppointmentStatus",
  "nextStatus" "AppointmentStatus",
  "previousStart" TIMESTAMP(3),
  "previousEnd" TIMESTAMP(3),
  "nextStart" TIMESTAMP(3),
  "nextEnd" TIMESTAMP(3),
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OutboundMessage" (
  "id" TEXT NOT NULL,
  "orderId" TEXT,
  "appointmentId" TEXT,
  "kind" "OutboundMessageKind" NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "locale" "Locale" NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "html" TEXT,
  "actor" TEXT NOT NULL,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OutboundMessage_parent_check" CHECK (
    ("orderId" IS NOT NULL AND "appointmentId" IS NULL) OR
    ("orderId" IS NULL AND "appointmentId" IS NOT NULL)
  )
);

CREATE TABLE "DeliveryAttempt" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "status" "DeliveryStatus" NOT NULL,
  "provider" TEXT,
  "providerMessageId" TEXT,
  "errorDetail" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeliveryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AppointmentEvent_appointmentId_at_idx" ON "AppointmentEvent"("appointmentId", "at");
CREATE UNIQUE INDEX "OutboundMessage_dedupeKey_key" ON "OutboundMessage"("dedupeKey");
CREATE INDEX "OutboundMessage_orderId_createdAt_idx" ON "OutboundMessage"("orderId", "createdAt");
CREATE INDEX "OutboundMessage_appointmentId_createdAt_idx" ON "OutboundMessage"("appointmentId", "createdAt");
CREATE INDEX "DeliveryAttempt_messageId_attemptedAt_idx" ON "DeliveryAttempt"("messageId", "attemptedAt");

ALTER TABLE "AppointmentEvent" ADD CONSTRAINT "AppointmentEvent_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_messageId_fkey"
  FOREIGN KEY ("messageId") REFERENCES "OutboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
