ALTER TABLE "Client" ADD COLUMN "stripeCustomerId" TEXT;
CREATE UNIQUE INDEX "Client_stripeCustomerId_key" ON "Client"("stripeCustomerId");

CREATE TABLE "SavedAddress" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "line1" TEXT NOT NULL,
  "line2" TEXT,
  "postalCode" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'FI',
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SavedAddress_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SavedAddress_clientId_updatedAt_idx" ON "SavedAddress"("clientId", "updatedAt");
CREATE UNIQUE INDEX "SavedAddress_one_default_per_client" ON "SavedAddress"("clientId") WHERE "isDefault" = true;
ALTER TABLE "SavedAddress" ADD CONSTRAINT "SavedAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD COLUMN "savedAddressId" TEXT;
CREATE INDEX "Order_savedAddressId_idx" ON "Order"("savedAddressId");
ALTER TABLE "Order" ADD CONSTRAINT "Order_savedAddressId_fkey" FOREIGN KEY ("savedAddressId") REFERENCES "SavedAddress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExternalApiAttempt" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "outcome" TEXT NOT NULL,
  "httpStatus" INTEGER,
  "providerRequestId" TEXT,
  "providerMessageId" TEXT,
  "correlationId" TEXT,
  "retryNumber" INTEGER NOT NULL DEFAULT 0,
  "durationMs" INTEGER,
  "requestMetadata" JSONB,
  "responseMetadata" JSONB,
  "errorClass" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "appointmentId" TEXT,
  "orderId" TEXT,
  "messageId" TEXT,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExternalApiAttempt_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ExternalApiAttempt_provider_attemptedAt_idx" ON "ExternalApiAttempt"("provider", "attemptedAt");
CREATE INDEX "ExternalApiAttempt_outcome_attemptedAt_idx" ON "ExternalApiAttempt"("outcome", "attemptedAt");
CREATE INDEX "ExternalApiAttempt_appointmentId_attemptedAt_idx" ON "ExternalApiAttempt"("appointmentId", "attemptedAt");
CREATE INDEX "ExternalApiAttempt_orderId_attemptedAt_idx" ON "ExternalApiAttempt"("orderId", "attemptedAt");
CREATE INDEX "ExternalApiAttempt_expiresAt_idx" ON "ExternalApiAttempt"("expiresAt");
ALTER TABLE "ExternalApiAttempt" ADD CONSTRAINT "ExternalApiAttempt_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalApiAttempt" ADD CONSTRAINT "ExternalApiAttempt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalApiAttempt" ADD CONSTRAINT "ExternalApiAttempt_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "OutboundMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DeliveryAttempt" ADD COLUMN "externalApiAttemptId" TEXT;
CREATE UNIQUE INDEX "DeliveryAttempt_externalApiAttemptId_key" ON "DeliveryAttempt"("externalApiAttemptId");
ALTER TABLE "DeliveryAttempt" ADD CONSTRAINT "DeliveryAttempt_externalApiAttemptId_fkey" FOREIGN KEY ("externalApiAttemptId") REFERENCES "ExternalApiAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
