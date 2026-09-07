-- Snapshot the exact approved procedure selected at booking time.
ALTER TABLE "Appointment"
  ADD COLUMN "procedureIndex" INTEGER,
  ADD COLUMN "procedureTitle" TEXT,
  ADD COLUMN "procedurePrice" TEXT;
