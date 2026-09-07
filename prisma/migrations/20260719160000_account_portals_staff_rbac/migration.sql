CREATE TYPE "AccountStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'DISABLED');
CREATE TYPE "AccountTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'CLAIM_APPOINTMENT');
CREATE TYPE "AppointmentChangeType" AS ENUM ('CANCEL', 'RESCHEDULE');
CREATE TYPE "AppointmentChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE', 'DENIED');

ALTER TABLE "User"
  ADD COLUMN "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerifiedAt" = COALESCE("emailVerifiedAt", "createdAt")
WHERE "role" IN ('ADMIN', 'STAFF');

UPDATE "User"
SET "mustChangePassword" = true
WHERE "role" = 'STAFF';

ALTER TABLE "AuditLog"
  ADD COLUMN "actorUserId" TEXT,
  ADD COLUMN "actorRole" "Role",
  ADD COLUMN "outcome" "AuditOutcome" NOT NULL DEFAULT 'SUCCESS',
  ADD COLUMN "ipAddress" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "metadata" JSONB;

CREATE TABLE "AccountToken" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "purpose" "AccountTokenPurpose" NOT NULL,
  "appointmentId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentChangeRequest" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "type" "AppointmentChangeType" NOT NULL,
  "status" "AppointmentChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedStart" TIMESTAMP(3),
  "reason" TEXT,
  "decisionReason" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AppointmentChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");
CREATE INDEX "AccountToken_userId_purpose_expiresAt_idx" ON "AccountToken"("userId", "purpose", "expiresAt");
CREATE INDEX "AccountToken_appointmentId_idx" ON "AccountToken"("appointmentId");
CREATE INDEX "AppointmentChangeRequest_appointmentId_status_idx" ON "AppointmentChangeRequest"("appointmentId", "status");
CREATE INDEX "AppointmentChangeRequest_clientId_createdAt_idx" ON "AppointmentChangeRequest"("clientId", "createdAt");
CREATE INDEX "AppointmentChangeRequest_status_createdAt_idx" ON "AppointmentChangeRequest"("status", "createdAt");
CREATE UNIQUE INDEX "AppointmentChangeRequest_one_pending_per_appointment" ON "AppointmentChangeRequest"("appointmentId") WHERE "status" = 'PENDING';
CREATE INDEX "AuditLog_actorUserId_at_idx" ON "AuditLog"("actorUserId", "at");
CREATE INDEX "AuditLog_action_at_idx" ON "AuditLog"("action", "at");
CREATE INDEX "AuditLog_entity_entityId_at_idx" ON "AuditLog"("entity", "entityId", "at");

ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentChangeRequest" ADD CONSTRAINT "AppointmentChangeRequest_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentChangeRequest" ADD CONSTRAINT "AppointmentChangeRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentChangeRequest" ADD CONSTRAINT "AppointmentChangeRequest_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
