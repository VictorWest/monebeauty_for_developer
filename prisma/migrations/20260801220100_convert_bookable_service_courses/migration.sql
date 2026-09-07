ALTER TABLE "ServiceOption" DROP CONSTRAINT IF EXISTS "ServiceOption_booking_duration_check";

-- The eight approved Endospheres course prices reserve their first visit.
UPDATE "ServiceOption" option
SET
  "type" = 'COURSE',
  "bookable" = true,
  "bookingDurationMin" = (regexp_match(option."key", '^package-(30|45|60|75)-(6|12)$'))[1]::integer,
  "bookingServiceId" = target."id",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "Service" parent, "Service" target
WHERE option."serviceId" = parent."id"
  AND parent."slug" = 'endospheres'
  AND option."key" ~ '^package-(30|45|60|75)-(6|12)$'
  AND target."slug" = 'endospheres-' || (regexp_match(option."key", '^package-(30|45|60|75)-(6|12)$'))[1];

-- Canonical Packages entries already own their first-visit duration and target.
UPDATE "ServiceOption" option
SET "type" = 'COURSE', "bookable" = true, "updatedAt" = CURRENT_TIMESTAMP
FROM "Service" service
WHERE option."serviceId" = service."id"
  AND service."slug" = 'packages'
  AND option."archivedAt" IS NULL
  AND option."published" = true
  AND option."bookingDurationMin" >= 5;

ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_booking_duration_check" CHECK (
  ("type" = 'INFORMATIONAL_PACKAGE' AND "bookable" = false)
  OR ("type" IN ('APPOINTMENT', 'COURSE') AND "bookable" = true
      AND "bookingDurationMin" IS NOT NULL AND "bookingDurationMin" >= 5)
);
