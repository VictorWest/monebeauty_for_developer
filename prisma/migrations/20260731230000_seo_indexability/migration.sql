ALTER TABLE "TreatmentContent" ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TechnologyContent" ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ContentPage" ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ProductContent" ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ArticleContent" ADD COLUMN "seoIndexable" BOOLEAN NOT NULL DEFAULT true;

-- Bootstrap useful SEO fields from already-approved localized copy. Runtime metadata still
-- normalizes Markdown and applies strict length bounds.
UPDATE "ContentPage"
SET "seoTitle" = COALESCE("seoTitle", "title"),
    "seoDescription" = COALESCE("seoDescription", LEFT(REGEXP_REPLACE("body", '[#*_>`~|\[\]()]', ' ', 'g'), 160));

UPDATE "ProductContent"
SET "seoTitle" = COALESCE("seoTitle", "name"),
    "seoDescription" = COALESCE("seoDescription", LEFT(REGEXP_REPLACE("description", '[#*_>`~|\[\]()]', ' ', 'g'), 160)),
    "imageAlt" = COALESCE("imageAlt", "name");

UPDATE "TechnologyContent"
SET "seoTitle" = COALESCE("seoTitle", "name"),
    "seoDescription" = COALESCE("seoDescription", LEFT(REGEXP_REPLACE(COALESCE(NULLIF("summary", ''), "body"), '[#*_>`~|\[\]()]', ' ', 'g'), 160));

UPDATE "ContentPage"
SET "seoIndexable" = false
WHERE "body" LIKE '%[CLINIC TO PROVIDE]%';

UPDATE "TreatmentContent"
SET "seoIndexable" = false
WHERE "whatItIs" LIKE '%[CLINIC TO PROVIDE]%';

UPDATE "ProductContent" AS content
SET "seoIndexable" = false
FROM "Product" AS product
WHERE content."productId" = product."id"
  AND product."slug" = 'stripe-checkout-test-item';

UPDATE "Product"
SET "published" = false
WHERE "slug" = 'stripe-checkout-test-item';
