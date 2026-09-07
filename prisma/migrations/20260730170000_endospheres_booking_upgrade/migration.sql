CREATE TYPE "ServicePriceMode" AS ENUM ('FROM', 'FIXED');

ALTER TABLE "Service"
  ADD COLUMN "priceMode" "ServicePriceMode" NOT NULL DEFAULT 'FROM',
  ADD COLUMN "bookingFamily" TEXT,
  ADD COLUMN "bookingPickerVisible" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "offerRequiresAccount" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Service_bookingFamily_bookable_archivedAt_idx"
  ON "Service"("bookingFamily", "bookable", "archivedAt");

UPDATE "Service"
SET "bookingFamily" = 'endospheres',
    "bookingPickerVisible" = false
WHERE "slug" = 'endospheres';

WITH variants(slug, duration, price, sort_order, requires_account) AS (
  VALUES
    ('endospheres-intro-75', 75, 99::numeric, 300, true),
    ('endospheres-30', 30, 65::numeric, 301, false),
    ('endospheres-45', 45, 85::numeric, 302, false),
    ('endospheres-60', 60, 105::numeric, 303, false),
    ('endospheres-75', 75, 125::numeric, 304, false)
)
INSERT INTO "Service" (
  "id", "slug", "publicPath", "category", "durationMin", "bookable",
  "priceFrom", "priceMode", "bookingFamily", "bookingPickerVisible",
  "offerRequiresAccount", "images", "order", "published", "heroImageAlt",
  "createdAt", "updatedAt", "requiresDevice"
)
SELECT
  'service-' || variants.slug,
  variants.slug,
  NULL,
  'DEVICE'::"ServiceCategory",
  variants.duration,
  true,
  variants.price,
  'FIXED'::"ServicePriceMode",
  'endospheres',
  true,
  variants.requires_account,
  parent."images",
  variants.sort_order,
  true,
  parent."heroImageAlt",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  parent."requiresDevice"
FROM variants
JOIN "Service" parent ON parent."slug" = 'endospheres'
ON CONFLICT ("slug") DO UPDATE SET
  "durationMin" = EXCLUDED."durationMin",
  "priceFrom" = EXCLUDED."priceFrom",
  "priceMode" = 'FIXED',
  "bookingFamily" = 'endospheres',
  "bookingPickerVisible" = true,
  "offerRequiresAccount" = EXCLUDED."offerRequiresAccount",
  "bookable" = true,
  "archivedAt" = NULL;

WITH labels(slug, locale, label) AS (
  VALUES
    ('endospheres-intro-75', 'en'::"Locale", 'Introductory Endospheres Therapy® — 75 min Full Body Protocol'),
    ('endospheres-intro-75', 'fi'::"Locale", 'Endospheres Therapy® -tutustumishoito — 75 min koko vartalon protokolla'),
    ('endospheres-intro-75', 'ru'::"Locale", 'Знакомство с Endospheres Therapy® — протокол для всего тела, 75 мин'),
    ('endospheres-30', 'en'::"Locale", 'Endospheres Therapy® — 30 min'),
    ('endospheres-30', 'fi'::"Locale", 'Endospheres-terapia 30 min'),
    ('endospheres-30', 'ru'::"Locale", 'Терапия Endospheres 30 мин'),
    ('endospheres-45', 'en'::"Locale", 'Endospheres Therapy® — 45 min'),
    ('endospheres-45', 'fi'::"Locale", 'Endospheres-terapia 45 min'),
    ('endospheres-45', 'ru'::"Locale", 'Терапия Endospheres 45 мин'),
    ('endospheres-60', 'en'::"Locale", 'Endospheres Therapy® — 60 min'),
    ('endospheres-60', 'fi'::"Locale", 'Endospheres-terapia 60 min'),
    ('endospheres-60', 'ru'::"Locale", 'Терапия Endospheres 60 мин'),
    ('endospheres-75', 'en'::"Locale", 'Endospheres Therapy® — 75 min Full Body Protocol'),
    ('endospheres-75', 'fi'::"Locale", 'Endospheres-terapia koko vartalolle 75 min'),
    ('endospheres-75', 'ru'::"Locale", 'Endospheres для всего тела 75 мин')
)
INSERT INTO "TreatmentContent" (
  "id", "serviceId", "locale", "h1", "shortDesc", "whatItIs",
  "suitableFor", "benefits", "processSteps", "safety", "preCare", "postCare",
  "contraindications", "sessions", "results", "faq", "seoTitle",
  "seoDescription", "ogImage", "imageAlt", "status", "createdAt", "updatedAt"
)
SELECT
  'content-' || labels.slug || '-' || labels.locale::text,
  variant."id",
  labels.locale,
  labels.label,
  parent_content."shortDesc",
  parent_content."whatItIs",
  parent_content."suitableFor",
  parent_content."benefits",
  parent_content."processSteps",
  parent_content."safety",
  parent_content."preCare",
  parent_content."postCare",
  parent_content."contraindications",
  parent_content."sessions",
  parent_content."results",
  parent_content."faq",
  labels.label || ' | Mone Beauty Clinic',
  parent_content."seoDescription",
  parent_content."ogImage",
  parent_content."imageAlt",
  'PUBLISHED'::"PublicationStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM labels
JOIN "Service" variant ON variant."slug" = labels.slug
JOIN "Service" parent ON parent."slug" = 'endospheres'
JOIN "TreatmentContent" parent_content
  ON parent_content."serviceId" = parent."id"
 AND parent_content."locale" = labels.locale
ON CONFLICT ("serviceId", "locale") DO NOTHING;

INSERT INTO "_RoomToService" ("A", "B")
SELECT relation."A", variant."id"
FROM "_RoomToService" relation
JOIN "Service" parent ON parent."id" = relation."B" AND parent."slug" = 'endospheres'
CROSS JOIN "Service" variant
WHERE variant."bookingFamily" = 'endospheres' AND variant."slug" <> 'endospheres'
ON CONFLICT DO NOTHING;

INSERT INTO "_DeviceToService" ("A", "B")
SELECT relation."A", variant."id"
FROM "_DeviceToService" relation
JOIN "Service" parent ON parent."id" = relation."B" AND parent."slug" = 'endospheres'
CROSS JOIN "Service" variant
WHERE variant."bookingFamily" = 'endospheres' AND variant."slug" <> 'endospheres'
ON CONFLICT DO NOTHING;

INSERT INTO "PractitionerServiceCapability" (
  "id", "practitionerId", "serviceId", "roomId", "createdAt", "updatedAt"
)
SELECT
  capability."id" || '-' || variant."slug",
  capability."practitionerId",
  variant."id",
  capability."roomId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PractitionerServiceCapability" capability
JOIN "Service" parent
  ON parent."id" = capability."serviceId" AND parent."slug" = 'endospheres'
CROSS JOIN "Service" variant
WHERE variant."bookingFamily" = 'endospheres' AND variant."slug" <> 'endospheres'
ON CONFLICT ("practitionerId", "serviceId", "roomId") DO NOTHING;

INSERT INTO "PractitionerServiceCapabilityDevice" ("capabilityId", "deviceId")
SELECT variant_capability."id", link."deviceId"
FROM "PractitionerServiceCapability" parent_capability
JOIN "Service" parent
  ON parent."id" = parent_capability."serviceId" AND parent."slug" = 'endospheres'
JOIN "PractitionerServiceCapabilityDevice" link
  ON link."capabilityId" = parent_capability."id"
JOIN "PractitionerServiceCapability" variant_capability
  ON variant_capability."practitionerId" = parent_capability."practitionerId"
 AND variant_capability."roomId" = parent_capability."roomId"
JOIN "Service" variant
  ON variant."id" = variant_capability."serviceId"
 AND variant."bookingFamily" = 'endospheres'
 AND variant."slug" <> 'endospheres'
ON CONFLICT DO NOTHING;

WITH prices(key, service_slug, amount, sort_order) AS (
  VALUES
    ('intro-75', 'endospheres-intro-75', 99::numeric, 300),
    ('single-30', 'endospheres-30', 65::numeric, 301),
    ('single-45', 'endospheres-45', 85::numeric, 302),
    ('single-60', 'endospheres-60', 105::numeric, 303),
    ('single-75', 'endospheres-75', 125::numeric, 304),
    ('package-30-6', NULL, 350::numeric, 305),
    ('package-30-12', NULL, 650::numeric, 306),
    ('package-45-6', NULL, 450::numeric, 307),
    ('package-45-12', NULL, 850::numeric, 308),
    ('package-60-6', NULL, 570::numeric, 309),
    ('package-60-12', NULL, 1050::numeric, 310),
    ('package-75-6', NULL, 650::numeric, 311),
    ('package-75-12', NULL, 1250::numeric, 312)
)
INSERT INTO "PricingItem" (
  "id", "serviceId", "category", "label", "price", "unit", "order",
  "createdAt", "updatedAt"
)
SELECT
  'pricing-endospheres-' || prices.key,
  service."id",
  'DEVICE'::"ServiceCategory",
  'Endospheres ' || prices.key,
  prices.amount,
  NULL,
  prices.sort_order,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM prices
LEFT JOIN "Service" service ON service."slug" = prices.service_slug
ON CONFLICT ("id") DO NOTHING;

WITH price_labels(key, locale, label, unit) AS (
  VALUES
    ('intro-75', 'en'::"Locale", 'Introductory Endospheres Therapy® — 75 min Full Body Protocol', 'New clients · account required'),
    ('intro-75', 'fi'::"Locale", 'Endospheres Therapy® -tutustumishoito — 75 min koko vartalon protokolla', 'Uudet asiakkaat · asiakastili vaaditaan'),
    ('intro-75', 'ru'::"Locale", 'Знакомство с Endospheres Therapy® — протокол для всего тела, 75 мин', 'Для новых клиентов · требуется аккаунт'),
    ('single-30', 'en'::"Locale", 'Endospheres Therapy® — 30 min', 'Single treatment'),
    ('single-30', 'fi'::"Locale", 'Endospheres-terapia 30 min', 'Yksittäinen hoito'),
    ('single-30', 'ru'::"Locale", 'Терапия Endospheres 30 мин', 'Одна процедура'),
    ('single-45', 'en'::"Locale", 'Endospheres Therapy® — 45 min', 'Single treatment'),
    ('single-45', 'fi'::"Locale", 'Endospheres-terapia 45 min', 'Yksittäinen hoito'),
    ('single-45', 'ru'::"Locale", 'Терапия Endospheres 45 мин', 'Одна процедура'),
    ('single-60', 'en'::"Locale", 'Endospheres Therapy® — 60 min', 'Single treatment'),
    ('single-60', 'fi'::"Locale", 'Endospheres-terapia 60 min', 'Yksittäinen hoito'),
    ('single-60', 'ru'::"Locale", 'Терапия Endospheres 60 мин', 'Одна процедура'),
    ('single-75', 'en'::"Locale", 'Endospheres Therapy® — 75 min Full Body Protocol', 'Single treatment'),
    ('single-75', 'fi'::"Locale", 'Endospheres-terapia koko vartalolle 75 min', 'Yksittäinen hoito'),
    ('single-75', 'ru'::"Locale", 'Endospheres для всего тела 75 мин', 'Одна процедура'),
    ('package-30-6', 'en'::"Locale", 'Endospheres Therapy® — 30 min × 6', 'Package · pay at clinic'),
    ('package-30-6', 'fi'::"Locale", 'Endospheres-terapia 30 min × 6', 'Hoitopaketti · maksu klinikalla'),
    ('package-30-6', 'ru'::"Locale", 'Терапия Endospheres 30 мин × 6', 'Пакет · оплата в клинике'),
    ('package-30-12', 'en'::"Locale", 'Endospheres Therapy® — 30 min × 12', 'Package · pay at clinic'),
    ('package-30-12', 'fi'::"Locale", 'Endospheres-terapia 30 min × 12', 'Hoitopaketti · maksu klinikalla'),
    ('package-30-12', 'ru'::"Locale", 'Терапия Endospheres 30 мин × 12', 'Пакет · оплата в клинике'),
    ('package-45-6', 'en'::"Locale", 'Endospheres Therapy® — 45 min × 6', 'Package · pay at clinic'),
    ('package-45-6', 'fi'::"Locale", 'Endospheres-terapia 45 min × 6', 'Hoitopaketti · maksu klinikalla'),
    ('package-45-6', 'ru'::"Locale", 'Терапия Endospheres 45 мин × 6', 'Пакет · оплата в клинике'),
    ('package-45-12', 'en'::"Locale", 'Endospheres Therapy® — 45 min × 12', 'Package · pay at clinic'),
    ('package-45-12', 'fi'::"Locale", 'Endospheres-terapia 45 min × 12', 'Hoitopaketti · maksu klinikalla'),
    ('package-45-12', 'ru'::"Locale", 'Терапия Endospheres 45 мин × 12', 'Пакет · оплата в клинике'),
    ('package-60-6', 'en'::"Locale", 'Endospheres Therapy® — 60 min × 6', 'Package · pay at clinic'),
    ('package-60-6', 'fi'::"Locale", 'Endospheres-terapia 60 min × 6', 'Hoitopaketti · maksu klinikalla'),
    ('package-60-6', 'ru'::"Locale", 'Терапия Endospheres 60 мин × 6', 'Пакет · оплата в клинике'),
    ('package-60-12', 'en'::"Locale", 'Endospheres Therapy® — 60 min × 12', 'Package · pay at clinic'),
    ('package-60-12', 'fi'::"Locale", 'Endospheres-terapia 60 min × 12', 'Hoitopaketti · maksu klinikalla'),
    ('package-60-12', 'ru'::"Locale", 'Терапия Endospheres 60 мин × 12', 'Пакет · оплата в клинике'),
    ('package-75-6', 'en'::"Locale", 'Endospheres Therapy® — 75 min × 6', 'Package · pay at clinic'),
    ('package-75-6', 'fi'::"Locale", 'Endospheres-terapia 75 min × 6', 'Hoitopaketti · maksu klinikalla'),
    ('package-75-6', 'ru'::"Locale", 'Терапия Endospheres 75 мин × 6', 'Пакет · оплата в клинике'),
    ('package-75-12', 'en'::"Locale", 'Endospheres Therapy® — 75 min × 12', 'Package · pay at clinic'),
    ('package-75-12', 'fi'::"Locale", 'Endospheres-terapia 75 min × 12', 'Hoitopaketti · maksu klinikalla'),
    ('package-75-12', 'ru'::"Locale", 'Терапия Endospheres 75 мин × 12', 'Пакет · оплата в клинике')
)
INSERT INTO "PricingContent" (
  "id", "pricingItemId", "locale", "label", "unit", "status",
  "createdAt", "updatedAt"
)
SELECT
  'pricing-content-endospheres-' || price_labels.key || '-' || price_labels.locale::text,
  'pricing-endospheres-' || price_labels.key,
  price_labels.locale,
  price_labels.label,
  price_labels.unit,
  'PUBLISHED'::"PublicationStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM price_labels
ON CONFLICT ("pricingItemId", "locale") DO NOTHING;
