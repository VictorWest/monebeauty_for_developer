-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bookingGroupCount" INTEGER,
ADD COLUMN     "bookingGroupId" TEXT,
ADD COLUMN     "bookingGroupIndex" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "multiProcedureBooking" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Appointment_bookingGroupId_idx" ON "Appointment"("bookingGroupId");
