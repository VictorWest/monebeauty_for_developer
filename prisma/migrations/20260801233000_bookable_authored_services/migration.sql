-- Add the two SCOPE-authored appointments only when their parent services already exist.
-- Static ids let the localized rows attach only to options created by this migration;
-- an existing admin-owned option with the same stable key remains completely untouched.
INSERT INTO "ServiceOption" (
  "id",
  "serviceId",
  "key",
  "bookingDurationMin",
  "image",
  "imageFocalX",
  "imageFocalY",
  "type",
  "bookable",
  "published",
  "updatedAt"
)
SELECT
  'standalone-option-' || definition."key",
  service."id",
  definition."key",
  definition."duration",
  service."images"[1],
  service."imageFocalX",
  service."imageFocalY",
  'APPOINTMENT'::"ServiceOptionType",
  true,
  true,
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('consultation', 'consultation-30', 30),
    ('injectable', 'injectable-45', 45)
) AS definition("serviceSlug", "key", "duration")
JOIN "Service" service ON service."slug" = definition."serviceSlug"
ON CONFLICT DO NOTHING;

INSERT INTO "ServiceOptionContent" (
  "id",
  "optionId",
  "locale",
  "group",
  "name",
  "summary",
  "description",
  "imageAlt",
  "durationLabel",
  "priceLabel",
  "status",
  "updatedAt"
)
SELECT
  'standalone-content-' || definition."key" || '-' || content."locale"::text,
  option."id",
  content."locale",
  CASE content."locale"
    WHEN 'fi' THEN 'Vastaanotot'
    WHEN 'ru' THEN 'Приёмы'
    ELSE 'Appointments'
  END,
  content."h1",
  content."shortDesc",
  content."whatItIs",
  COALESCE(content."imageAlt", content."h1"),
  definition."duration"::text || CASE
    WHEN content."locale" = 'ru' THEN ' мин'
    ELSE ' min'
  END,
  NULL,
  content."status",
  CURRENT_TIMESTAMP
FROM (
  VALUES
    ('consultation', 'consultation-30', 30),
    ('injectable', 'injectable-45', 45)
) AS definition("serviceSlug", "key", "duration")
JOIN "Service" service ON service."slug" = definition."serviceSlug"
JOIN "ServiceOption" option
  ON option."id" = 'standalone-option-' || definition."key"
  AND option."serviceId" = service."id"
JOIN "TreatmentContent" content ON content."serviceId" = service."id"
ON CONFLICT DO NOTHING;
