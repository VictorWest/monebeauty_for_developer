ALTER TABLE "Appointment"
ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactEmail" TEXT,
ADD COLUMN "contactPhone" TEXT;

UPDATE "Appointment" AS appointment
SET
  "contactName" = client."fullName",
  "contactEmail" = client."email",
  "contactPhone" = client."phone"
FROM "Client" AS client
WHERE appointment."clientId" = client."id";

ALTER TABLE "Appointment"
ALTER COLUMN "contactName" SET NOT NULL,
ALTER COLUMN "contactEmail" SET NOT NULL,
ALTER COLUMN "contactPhone" SET NOT NULL;
