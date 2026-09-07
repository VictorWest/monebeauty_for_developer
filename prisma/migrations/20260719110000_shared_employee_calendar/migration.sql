CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TYPE "AppointmentEventKind" ADD VALUE IF NOT EXISTS 'CALENDAR_UPDATED';

ALTER TABLE "Service"
  ADD COLUMN "primaryPractitionerId" TEXT,
  ADD COLUMN "requiresDevice" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Practitioner"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "calendarColor" TEXT NOT NULL DEFAULT '#B89B72',
  ADD COLUMN "workingHours" JSONB,
  ADD COLUMN "daysOff" TIMESTAMP(3)[] NOT NULL DEFAULT ARRAY[]::TIMESTAMP(3)[];

CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Device" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "_RoomToService" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);
CREATE TABLE "_DeviceToService" ("A" TEXT NOT NULL, "B" TEXT NOT NULL);

ALTER TABLE "Appointment"
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "deviceId" TEXT,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "AppointmentEvent" ADD COLUMN "changes" JSONB;

CREATE UNIQUE INDEX "Room_name_key" ON "Room"("name");
CREATE UNIQUE INDEX "Device_name_key" ON "Device"("name");
CREATE UNIQUE INDEX "_RoomToService_AB_unique" ON "_RoomToService"("A", "B");
CREATE INDEX "_RoomToService_B_index" ON "_RoomToService"("B");
CREATE UNIQUE INDEX "_DeviceToService_AB_unique" ON "_DeviceToService"("A", "B");
CREATE INDEX "_DeviceToService_B_index" ON "_DeviceToService"("B");
CREATE INDEX "Service_primaryPractitionerId_idx" ON "Service"("primaryPractitionerId");
CREATE INDEX "Appointment_practitionerId_start_end_idx" ON "Appointment"("practitionerId", "start", "end");
CREATE INDEX "Appointment_roomId_start_end_idx" ON "Appointment"("roomId", "start", "end");
CREATE INDEX "Appointment_deviceId_start_end_idx" ON "Appointment"("deviceId", "start", "end");

ALTER TABLE "Service" ADD CONSTRAINT "Service_primaryPractitionerId_fkey" FOREIGN KEY ("primaryPractitionerId") REFERENCES "Practitioner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "_RoomToService" ADD CONSTRAINT "_RoomToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_RoomToService" ADD CONSTRAINT "_RoomToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DeviceToService" ADD CONSTRAINT "_DeviceToService_A_fkey" FOREIGN KEY ("A") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_DeviceToService" ADD CONSTRAINT "_DeviceToService_B_fkey" FOREIGN KEY ("B") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_employee_no_overlap"
  EXCLUDE USING gist ("practitionerId" WITH =, tsrange("start", "end", '[)') WITH &&)
  WHERE ("status" <> 'CANCELLED');
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_room_no_overlap"
  EXCLUDE USING gist ("roomId" WITH =, tsrange("start", "end", '[)') WITH &&)
  WHERE ("roomId" IS NOT NULL AND "status" <> 'CANCELLED');
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_device_no_overlap"
  EXCLUDE USING gist ("deviceId" WITH =, tsrange("start", "end", '[)') WITH &&)
  WHERE ("deviceId" IS NOT NULL AND "status" <> 'CANCELLED');
