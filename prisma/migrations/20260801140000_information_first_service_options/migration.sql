CREATE TYPE "ServiceOptionType" AS ENUM ('APPOINTMENT', 'INFORMATIONAL_PACKAGE');

CREATE TABLE "ServiceOption" (
  "id" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "bookingDurationMin" INTEGER,
  "type" "ServiceOptionType" NOT NULL DEFAULT 'APPOINTMENT',
  "bookable" BOOLEAN NOT NULL DEFAULT true,
  "offerRequiresAccount" BOOLEAN NOT NULL DEFAULT false,
  "published" BOOLEAN NOT NULL DEFAULT true,
  "legacyProcedureIndex" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "ServiceOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceOptionContent" (
  "id" TEXT NOT NULL,
  "optionId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "group" TEXT,
  "name" TEXT NOT NULL,
  "durationLabel" TEXT,
  "priceLabel" TEXT,
  "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceOptionContent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment" ADD COLUMN "serviceOptionId" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "bookingDurationMin" INTEGER;

CREATE UNIQUE INDEX "ServiceOption_serviceId_key_key" ON "ServiceOption"("serviceId", "key");
CREATE UNIQUE INDEX "ServiceOption_serviceId_legacyProcedureIndex_key" ON "ServiceOption"("serviceId", "legacyProcedureIndex");
CREATE INDEX "ServiceOption_serviceId_archivedAt_displayOrder_idx" ON "ServiceOption"("serviceId", "archivedAt", "displayOrder");
CREATE UNIQUE INDEX "ServiceOptionContent_optionId_locale_key" ON "ServiceOptionContent"("optionId", "locale");
CREATE INDEX "ServiceOptionContent_locale_status_idx" ON "ServiceOptionContent"("locale", "status");
CREATE INDEX "Appointment_serviceOptionId_idx" ON "Appointment"("serviceOptionId");

ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOptionContent" ADD CONSTRAINT "ServiceOptionContent_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "ServiceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceOptionId_fkey" FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_booking_duration_check" CHECK (
  ("type" = 'INFORMATIONAL_PACKAGE' AND "bookable" = false)
  OR ("type" = 'APPOINTMENT' AND "bookingDurationMin" IS NOT NULL AND "bookingDurationMin" >= 5)
);
