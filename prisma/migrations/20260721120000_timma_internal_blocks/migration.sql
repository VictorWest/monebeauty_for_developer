CREATE TYPE "CalendarBlockStatus" AS ENUM ('ACTIVE', 'CANCELLED');

CREATE TABLE "CalendarBlockTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "labelFi" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelRu" TEXT NOT NULL,
  "defaultDurationMin" INTEGER NOT NULL DEFAULT 60,
  "color" TEXT NOT NULL DEFAULT '#B89B72',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarBlockTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarBlockSeries" (
  "id" TEXT NOT NULL,
  "weekdays" INTEGER[] NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CalendarBlockSeries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CalendarBlock" (
  "id" TEXT NOT NULL,
  "seriesId" TEXT,
  "roomId" TEXT,
  "deviceId" TEXT,
  "start" TIMESTAMP(3) NOT NULL,
  "end" TIMESTAMP(3) NOT NULL,
  "notes" TEXT,
  "status" "CalendarBlockStatus" NOT NULL DEFAULT 'ACTIVE',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "cancelledAt" TIMESTAMP(3),
  "cancelledBy" TEXT,
  CONSTRAINT "CalendarBlock_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarBlock_one_resource" CHECK (NOT ("roomId" IS NOT NULL AND "deviceId" IS NOT NULL))
);

CREATE TABLE "CalendarBlockItem" (
  "id" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "templateId" TEXT,
  "displayOrder" INTEGER NOT NULL,
  "durationMin" INTEGER NOT NULL,
  "labelFi" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelRu" TEXT NOT NULL,
  CONSTRAINT "CalendarBlockItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CalendarBlockItem_duration" CHECK ("durationMin" >= 15)
);

CREATE TABLE "CalendarBlockParticipant" (
  "id" TEXT NOT NULL,
  "blockId" TEXT NOT NULL,
  "practitionerId" TEXT NOT NULL,
  CONSTRAINT "CalendarBlockParticipant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CalendarBlockTemplate_key_key" ON "CalendarBlockTemplate"("key");
CREATE INDEX "CalendarBlockTemplate_active_displayOrder_idx" ON "CalendarBlockTemplate"("active", "displayOrder");
CREATE INDEX "CalendarBlock_start_end_status_idx" ON "CalendarBlock"("start", "end", "status");
CREATE INDEX "CalendarBlock_seriesId_start_idx" ON "CalendarBlock"("seriesId", "start");
CREATE INDEX "CalendarBlock_roomId_start_end_idx" ON "CalendarBlock"("roomId", "start", "end");
CREATE INDEX "CalendarBlock_deviceId_start_end_idx" ON "CalendarBlock"("deviceId", "start", "end");
CREATE UNIQUE INDEX "CalendarBlockItem_blockId_displayOrder_key" ON "CalendarBlockItem"("blockId", "displayOrder");
CREATE INDEX "CalendarBlockItem_templateId_idx" ON "CalendarBlockItem"("templateId");
CREATE UNIQUE INDEX "CalendarBlockParticipant_blockId_practitionerId_key" ON "CalendarBlockParticipant"("blockId", "practitionerId");
CREATE INDEX "CalendarBlockParticipant_practitionerId_idx" ON "CalendarBlockParticipant"("practitionerId");

ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "CalendarBlockSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarBlock" ADD CONSTRAINT "CalendarBlock_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarBlockItem" ADD CONSTRAINT "CalendarBlockItem_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "CalendarBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarBlockItem" ADD CONSTRAINT "CalendarBlockItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CalendarBlockTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CalendarBlockParticipant" ADD CONSTRAINT "CalendarBlockParticipant_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "CalendarBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CalendarBlockParticipant" ADD CONSTRAINT "CalendarBlockParticipant_practitionerId_fkey" FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CalendarBlockTemplate" ("id", "key", "labelFi", "labelEn", "labelRu", "defaultDurationMin", "color", "active", "displayOrder", "createdAt", "updatedAt") VALUES
  ('calendar-block-template-lunch', 'lunch', 'Lounastauko', 'Lunch break', 'Обеденный перерыв', 60, '#D8C5A8', true, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-block-template-personal', 'personal', 'Oma aika', 'Personal time', 'Личное время', 60, '#CBB8A6', true, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-block-template-errand', 'errand', 'Työasia', 'Work errand', 'Рабочее поручение', 60, '#B7C7BD', true, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-block-template-sick', 'sick', 'Sairausloma', 'Sick leave', 'Больничный', 60, '#D6AAA0', true, 3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('calendar-block-template-vacation', 'vacation', 'Loma', 'Vacation', 'Отпуск', 60, '#B8C5D1', true, 4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
