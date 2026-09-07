ALTER TABLE "ServiceOptionContent"
  ADD COLUMN "summary" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "description" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceScrapedAt" TIMESTAMP(3);
