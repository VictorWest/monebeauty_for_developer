ALTER TABLE "Service"
  ADD COLUMN "imageFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageFocalY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "ServiceOption"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "imageFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageFocalY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "ServiceOptionContent" ADD COLUMN "imageAlt" TEXT;

ALTER TABLE "Technology"
  ADD COLUMN "imageFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageFocalY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "ContentPage"
  ADD COLUMN "heroFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "heroFocalY" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageAlt" TEXT;

ALTER TABLE "Product"
  ADD COLUMN "imageFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "imageFocalY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "Article"
  ADD COLUMN "coverFocalX" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "coverFocalY" INTEGER NOT NULL DEFAULT 50;

ALTER TABLE "ArticleContent" ADD COLUMN "imageAlt" TEXT;

CREATE TABLE "SiteMediaSlot" (
  "key" TEXT NOT NULL,
  "image" TEXT,
  "focalX" INTEGER NOT NULL DEFAULT 50,
  "focalY" INTEGER NOT NULL DEFAULT 50,
  "decorative" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteMediaSlot_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SiteMediaSlotContent" (
  "slotKey" TEXT NOT NULL,
  "locale" "Locale" NOT NULL,
  "alt" TEXT NOT NULL DEFAULT '',
  CONSTRAINT "SiteMediaSlotContent_pkey" PRIMARY KEY ("slotKey", "locale")
);

CREATE INDEX "SiteMediaSlotContent_locale_idx" ON "SiteMediaSlotContent"("locale");
ALTER TABLE "SiteMediaSlotContent" ADD CONSTRAINT "SiteMediaSlotContent_slotKey_fkey"
  FOREIGN KEY ("slotKey") REFERENCES "SiteMediaSlot"("key") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Service" ADD CONSTRAINT "Service_image_focal_check"
  CHECK ("imageFocalX" BETWEEN 0 AND 100 AND "imageFocalY" BETWEEN 0 AND 100);
ALTER TABLE "ServiceOption" ADD CONSTRAINT "ServiceOption_image_focal_check"
  CHECK ("imageFocalX" BETWEEN 0 AND 100 AND "imageFocalY" BETWEEN 0 AND 100);
ALTER TABLE "Technology" ADD CONSTRAINT "Technology_image_focal_check"
  CHECK ("imageFocalX" BETWEEN 0 AND 100 AND "imageFocalY" BETWEEN 0 AND 100);
ALTER TABLE "ContentPage" ADD CONSTRAINT "ContentPage_image_focal_check"
  CHECK ("heroFocalX" BETWEEN 0 AND 100 AND "heroFocalY" BETWEEN 0 AND 100);
ALTER TABLE "Product" ADD CONSTRAINT "Product_image_focal_check"
  CHECK ("imageFocalX" BETWEEN 0 AND 100 AND "imageFocalY" BETWEEN 0 AND 100);
ALTER TABLE "Article" ADD CONSTRAINT "Article_image_focal_check"
  CHECK ("coverFocalX" BETWEEN 0 AND 100 AND "coverFocalY" BETWEEN 0 AND 100);
ALTER TABLE "SiteMediaSlot" ADD CONSTRAINT "SiteMediaSlot_focal_check"
  CHECK ("focalX" BETWEEN 0 AND 100 AND "focalY" BETWEEN 0 AND 100);

UPDATE "ContentPage" SET "imageAlt" = "title" WHERE "hero" IS NOT NULL;
UPDATE "ServiceOptionContent" SET "imageAlt" = "name";
UPDATE "ArticleContent" content
SET "imageAlt" = COALESCE(article."coverAlt", content."title")
FROM "Article" article
WHERE content."articleId" = article."id" AND article."coverImage" IS NOT NULL;

INSERT INTO "SiteMediaSlot" ("key", "image", "decorative", "updatedAt") VALUES
  ('home.hero-poster', '/media/hero-poster.jpg', false, CURRENT_TIMESTAMP),
  ('home.area.face', '/media/home/treatment-areas/face.jpeg', true, CURRENT_TIMESTAMP),
  ('home.area.body', '/media/home/treatment-areas/body.jpeg', true, CURRENT_TIMESTAMP),
  ('home.area.hair', '/media/home/treatment-areas/hair.jpeg', true, CURRENT_TIMESTAMP),
  ('home.area.men', '/media/home/treatment-areas/men.png', true, CURRENT_TIMESTAMP),
  ('booking.hero', '/media/files/land/240/d0c2d035d8a3b00a7d39938b2a2b8bea.jpg', false, CURRENT_TIMESTAMP),
  ('endospheres.editorial.1', '/media/files/land/104/8c6f2e75d8051e304bca2fd6f22fa512.jpg', false, CURRENT_TIMESTAMP),
  ('endospheres.editorial.2', '/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg', false, CURRENT_TIMESTAMP),
  ('site.default-social', NULL, false, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "SiteMediaSlotContent" ("slotKey", "locale", "alt") VALUES
  ('home.hero-poster', 'fi', 'Mone Beauty Clinicin hoitotila'),
  ('home.hero-poster', 'en', 'Treatment room at Mone Beauty Clinic'),
  ('home.hero-poster', 'ru', 'Процедурный кабинет Mone Beauty Clinic'),
  ('booking.hero', 'fi', 'Varaa aika Mone Beauty Clinicille'),
  ('booking.hero', 'en', 'Book an appointment at Mone Beauty Clinic'),
  ('booking.hero', 'ru', 'Запись на приём в Mone Beauty Clinic'),
  ('endospheres.editorial.1', 'fi', 'Endospheres-hoitokäsikappale käytössä'),
  ('endospheres.editorial.1', 'en', 'Endospheres treatment handpiece in use'),
  ('endospheres.editorial.1', 'ru', 'Манипула Endospheres во время процедуры'),
  ('endospheres.editorial.2', 'fi', 'Endospheres-käsikappaleen silikonipallot'),
  ('endospheres.editorial.2', 'en', 'Endospheres silicone sphere handpiece'),
  ('endospheres.editorial.2', 'ru', 'Силиконовые сферы манипулы Endospheres')
ON CONFLICT ("slotKey", "locale") DO NOTHING;
