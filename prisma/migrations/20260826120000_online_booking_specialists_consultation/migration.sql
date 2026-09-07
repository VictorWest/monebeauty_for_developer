-- Owner-approved online booking specialist selection and consultation profiles.
-- Existing appointments remain legacy-visible-time records until explicitly migrated.

ALTER TABLE "Practitioner" ADD COLUMN "publicName" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "bufferMinutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "Appointment" ADD COLUMN "reservedUntil" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "bufferEnforced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Client" ADD COLUMN "firstName" TEXT;
ALTER TABLE "Client" ADD COLUMN "lastName" TEXT;

CREATE TABLE "PractitionerServiceOptionQualification" (
  "id" TEXT NOT NULL,
  "practitionerId" TEXT NOT NULL,
  "serviceOptionId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PractitionerServiceOptionQualification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PractitionerServiceOptionQualification_practitionerId_serviceOptionId_key"
  ON "PractitionerServiceOptionQualification"("practitionerId", "serviceOptionId");
CREATE INDEX "PractitionerServiceOptionQualification_serviceOptionId_practitionerId_idx"
  ON "PractitionerServiceOptionQualification"("serviceOptionId", "practitionerId");
ALTER TABLE "PractitionerServiceOptionQualification"
  ADD CONSTRAINT "PractitionerServiceOptionQualification_practitionerId_fkey"
  FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PractitionerServiceOptionQualification"
  ADD CONSTRAINT "PractitionerServiceOptionQualification_serviceOptionId_fkey"
  FOREIGN KEY ("serviceOptionId") REFERENCES "ServiceOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "ConsultationQuestionType" AS ENUM
  ('SHORT_TEXT', 'LONG_TEXT', 'YES_NO', 'SINGLE_CHOICE', 'MULTI_CHOICE', 'ACKNOWLEDGMENT');

CREATE TABLE "ConsultationForm" (
  "id" TEXT NOT NULL DEFAULT 'current',
  "requiredVersion" INTEGER NOT NULL DEFAULT 1,
  "contentVersion" INTEGER NOT NULL DEFAULT 1,
  "healthConsentVersion" INTEGER NOT NULL DEFAULT 1,
  "healthConsentWording" JSONB NOT NULL DEFAULT '{}',
  "accuracyVersion" INTEGER NOT NULL DEFAULT 1,
  "accuracyWording" JSONB NOT NULL DEFAULT '{}',
  "requiredInformationVersion" INTEGER NOT NULL DEFAULT 1,
  "requiredInformationWording" JSONB NOT NULL DEFAULT '{}',
  "procedureConsentVersion" INTEGER NOT NULL DEFAULT 1,
  "procedureConsentWording" JSONB NOT NULL DEFAULT '{}',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultationForm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConsultationQuestion" (
  "id" TEXT NOT NULL,
  "formId" TEXT NOT NULL DEFAULT 'current',
  "key" TEXT NOT NULL,
  "type" "ConsultationQuestionType" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "requiredSinceVersion" INTEGER,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultationQuestion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationQuestion_key_key" ON "ConsultationQuestion"("key");
CREATE INDEX "ConsultationQuestion_formId_active_archivedAt_displayOrder_idx"
  ON "ConsultationQuestion"("formId", "active", "archivedAt", "displayOrder");

CREATE TABLE "ConsultationQuestionContent" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "prompt" TEXT NOT NULL,
  "helpText" TEXT,
  CONSTRAINT "ConsultationQuestionContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationQuestionContent_questionId_locale_key"
  ON "ConsultationQuestionContent"("questionId", "locale");

CREATE TABLE "ConsultationChoice" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ConsultationChoice_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationChoice_questionId_key_key"
  ON "ConsultationChoice"("questionId", "key");
CREATE INDEX "ConsultationChoice_questionId_active_displayOrder_idx"
  ON "ConsultationChoice"("questionId", "active", "displayOrder");

CREATE TABLE "ConsultationChoiceContent" (
  "id" TEXT NOT NULL,
  "choiceId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "label" TEXT NOT NULL,
  CONSTRAINT "ConsultationChoiceContent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationChoiceContent_choiceId_locale_key"
  ON "ConsultationChoiceContent"("choiceId", "locale");

CREATE TABLE "ConsultationProfile" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "formId" TEXT NOT NULL DEFAULT 'current',
  "completedVersion" INTEGER NOT NULL,
  "dateOfBirthEncrypted" TEXT NOT NULL,
  "answersEncrypted" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ConsultationProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ConsultationProfile_clientId_key" ON "ConsultationProfile"("clientId");
CREATE INDEX "ConsultationProfile_formId_completedVersion_idx"
  ON "ConsultationProfile"("formId", "completedVersion");

ALTER TABLE "ConsultationQuestion" ADD CONSTRAINT "ConsultationQuestion_formId_fkey"
  FOREIGN KEY ("formId") REFERENCES "ConsultationForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ConsultationQuestionContent" ADD CONSTRAINT "ConsultationQuestionContent_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ConsultationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationChoice" ADD CONSTRAINT "ConsultationChoice_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "ConsultationQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationChoiceContent" ADD CONSTRAINT "ConsultationChoiceContent_choiceId_fkey"
  FOREIGN KEY ("choiceId") REFERENCES "ConsultationChoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationProfile" ADD CONSTRAINT "ConsultationProfile_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsultationProfile" ADD CONSTRAINT "ConsultationProfile_formId_fkey"
  FOREIGN KEY ("formId") REFERENCES "ConsultationForm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "ConsultationForm" (
  "id", "healthConsentWording", "accuracyWording", "requiredInformationWording",
  "procedureConsentWording", "updatedAt"
) VALUES (
  'current',
  '{"fi":"Annan nimenomaisen suostumukseni siihen, että klinikka käsittelee esitietolomakkeen terveystietoja ajanvarausten arviointia ja hoitamista varten.","en":"I explicitly consent to the clinic processing the health information in this consultation form to assess and manage my appointments.","ru":"Я даю явное согласие на обработку клиникой медицинской информации из этой анкеты для оценки и организации моих записей."}',
  '{"fi":"Vahvistan, että antamani tiedot ovat parhaan tietoni mukaan oikeat ja ajantasaiset.","en":"I confirm that the information I provided is accurate and current to the best of my knowledge.","ru":"Я подтверждаю, что предоставленная информация является точной и актуальной, насколько мне известно."}',
  '{"fi":"Täytä kaikki pakolliset esitiedot ennen ajanvarausta.","en":"Complete all required consultation information before booking.","ru":"Заполните все обязательные данные анкеты перед записью."}',
  '{"fi":"Vahvistan antaneeni oikeat tiedot tätä ajanvarausta varten.","en":"I confirm that the information I provided for this booking is accurate.","ru":"Я подтверждаю точность информации, предоставленной для этой записи."}',
  CURRENT_TIMESTAMP
);

ALTER TABLE "Consent" ADD COLUMN "appointmentId" TEXT;
ALTER TABLE "Consent" ADD COLUMN "locale" "Locale";
ALTER TABLE "Consent" ADD COLUMN "textVersion" INTEGER;
ALTER TABLE "Consent" ADD COLUMN "wordingSnapshot" TEXT;
ALTER TABLE "Consent" ADD COLUMN "linkageRedacted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Consent" ADD CONSTRAINT "Consent_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Consent_clientId_at_idx" ON "Consent"("clientId", "at");
CREATE INDEX "Consent_appointmentId_type_idx" ON "Consent"("appointmentId", "type");

CREATE INDEX "Appointment_practitionerId_start_reservedUntil_idx"
  ON "Appointment"("practitionerId", "start", "reservedUntil");
CREATE INDEX "Appointment_roomId_start_reservedUntil_idx"
  ON "Appointment"("roomId", "start", "reservedUntil");
CREATE INDEX "Appointment_deviceId_start_reservedUntil_idx"
  ON "Appointment"("deviceId", "start", "reservedUntil");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_buffered_practitioner_no_overlap"
  EXCLUDE USING gist ("practitionerId" WITH =, tsrange("start", "reservedUntil", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "bufferEnforced" AND "reservedUntil" IS NOT NULL);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_buffered_room_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tsrange("start", "reservedUntil", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "bufferEnforced" AND "reservedUntil" IS NOT NULL);
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_buffered_device_no_overlap"
  EXCLUDE USING gist ("deviceId" WITH =, tsrange("start", "reservedUntil", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED' AND "bufferEnforced" AND "reservedUntil" IS NOT NULL);

-- New Prisma writes use the buffered default; old rows remain explicitly legacy.
ALTER TABLE "Appointment" ALTER COLUMN "bufferEnforced" SET DEFAULT true;
