-- Localized admin content ownership, publication workflow, technologies, and archives.

CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

ALTER TABLE "Service"
  ADD COLUMN "publicPath" TEXT,
  ADD COLUMN "durationMin" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "bookable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "TreatmentContent"
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ContentPage"
  ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE "Product"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "ProductContent"
  ADD COLUMN "shortDescription" TEXT,
  ADD COLUMN "imageAlt" TEXT,
  ADD COLUMN "seoTitle" TEXT,
  ADD COLUMN "seoDescription" TEXT,
  ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "Client"
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Article"
  ADD COLUMN "coverImage" TEXT,
  ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "ArticleContent"
  ADD COLUMN "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "ArticleContent" AS content
SET "status" = 'PUBLISHED'
FROM "Article" AS article
WHERE article."id" = content."articleId" AND article."published" = true;

ALTER TABLE "PricingItem"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "ChatSession"
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "anonymizedAt" TIMESTAMP(3);

CREATE TABLE "Technology" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "publicPath" TEXT NOT NULL,
  "images" TEXT[],
  "order" INTEGER NOT NULL DEFAULT 0,
  "relatedServiceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "archivedAt" TIMESTAMP(3),
  CONSTRAINT "Technology_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TechnologyContent" (
  "id" TEXT NOT NULL,
  "technologyId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "name" TEXT NOT NULL,
  "specification" TEXT,
  "summary" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "imageAlt" TEXT,
  "seoTitle" TEXT,
  "seoDescription" TEXT,
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TechnologyContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PricingContent" (
  "id" TEXT NOT NULL,
  "pricingItemId" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "label" TEXT NOT NULL,
  "unit" TEXT,
  "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PricingContent_pkey" PRIMARY KEY ("id")
);

-- Existing global labels are approved bootstrap content in every locale until an admin edits them.
INSERT INTO "PricingContent" ("id", "pricingItemId", "locale", "label", "unit", "status", "updatedAt")
SELECT concat(item."id", '-', locale.code), item."id", locale.code::"Locale", item."label", item."unit", 'PUBLISHED', CURRENT_TIMESTAMP
FROM "PricingItem" AS item
CROSS JOIN (VALUES ('fi'), ('en'), ('ru')) AS locale(code);

CREATE UNIQUE INDEX "Technology_slug_key" ON "Technology"("slug");
CREATE INDEX "Technology_archivedAt_order_idx" ON "Technology"("archivedAt", "order");
CREATE UNIQUE INDEX "TechnologyContent_technologyId_locale_key" ON "TechnologyContent"("technologyId", "locale");
CREATE INDEX "TechnologyContent_locale_status_idx" ON "TechnologyContent"("locale", "status");
CREATE UNIQUE INDEX "PricingContent_pricingItemId_locale_key" ON "PricingContent"("pricingItemId", "locale");
CREATE INDEX "PricingContent_locale_status_idx" ON "PricingContent"("locale", "status");
CREATE INDEX "Service_archivedAt_order_idx" ON "Service"("archivedAt", "order");
CREATE INDEX "TreatmentContent_locale_status_idx" ON "TreatmentContent"("locale", "status");
CREATE INDEX "ContentPage_locale_status_idx" ON "ContentPage"("locale", "status");
CREATE INDEX "Product_archivedAt_order_idx" ON "Product"("archivedAt", "order");
CREATE INDEX "ProductContent_locale_status_idx" ON "ProductContent"("locale", "status");
CREATE INDEX "Client_archivedAt_idx" ON "Client"("archivedAt");
CREATE INDEX "Article_archivedAt_order_idx" ON "Article"("archivedAt", "order");
CREATE INDEX "ArticleContent_locale_status_idx" ON "ArticleContent"("locale", "status");
CREATE INDEX "PricingItem_archivedAt_order_idx" ON "PricingItem"("archivedAt", "order");

ALTER TABLE "Technology" ADD CONSTRAINT "Technology_relatedServiceId_fkey"
  FOREIGN KEY ("relatedServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TechnologyContent" ADD CONSTRAINT "TechnologyContent_technologyId_fkey"
  FOREIGN KEY ("technologyId") REFERENCES "Technology"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PricingContent" ADD CONSTRAINT "PricingContent_pricingItemId_fkey"
  FOREIGN KEY ("pricingItemId") REFERENCES "PricingItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
