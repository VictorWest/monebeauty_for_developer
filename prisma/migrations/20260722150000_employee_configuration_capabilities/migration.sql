-- Abort before changing qualification data when an active future appointment cannot be
-- represented by the current admin-approved service resource pools.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Appointment" a
    JOIN "Service" s ON s."id" = a."serviceId"
    WHERE a."start" >= CURRENT_TIMESTAMP
      AND a."status" IN ('BOOKED', 'CONFIRMED', 'RESCHEDULED')
      AND (
        a."roomId" IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM "_PractitionerToService" ps
          WHERE ps."A" = a."practitionerId" AND ps."B" = a."serviceId"
        )
        OR NOT EXISTS (
          SELECT 1 FROM "_RoomToService" rs
          WHERE rs."A" = a."roomId" AND rs."B" = a."serviceId"
        )
        OR (s."requiresDevice" AND a."deviceId" IS NULL)
        OR (a."deviceId" IS NOT NULL AND NOT EXISTS (
          SELECT 1 FROM "_DeviceToService" ds
          WHERE ds."A" = a."deviceId" AND ds."B" = a."serviceId"
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Capability migration aborted: an active future appointment has an unsafe employee/service/room/device combination';
  END IF;
END $$;

ALTER TABLE "Practitioner"
  ADD COLUMN "configVersion" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "PractitionerServiceCapability" (
  "id" TEXT NOT NULL,
  "practitionerId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PractitionerServiceCapability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PractitionerServiceCapabilityDevice" (
  "capabilityId" TEXT NOT NULL,
  "deviceId" TEXT NOT NULL,
  CONSTRAINT "PractitionerServiceCapabilityDevice_pkey" PRIMARY KEY ("capabilityId", "deviceId")
);

CREATE UNIQUE INDEX "PractitionerServiceCapability_practitionerId_serviceId_roomId_key"
  ON "PractitionerServiceCapability"("practitionerId", "serviceId", "roomId");
CREATE INDEX "PractitionerServiceCapability_serviceId_practitionerId_idx"
  ON "PractitionerServiceCapability"("serviceId", "practitionerId");
CREATE INDEX "PractitionerServiceCapability_roomId_idx"
  ON "PractitionerServiceCapability"("roomId");
CREATE INDEX "PractitionerServiceCapabilityDevice_deviceId_idx"
  ON "PractitionerServiceCapabilityDevice"("deviceId");

ALTER TABLE "PractitionerServiceCapability" ADD CONSTRAINT "PractitionerServiceCapability_practitionerId_fkey"
  FOREIGN KEY ("practitionerId") REFERENCES "Practitioner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PractitionerServiceCapability" ADD CONSTRAINT "PractitionerServiceCapability_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PractitionerServiceCapability" ADD CONSTRAINT "PractitionerServiceCapability_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PractitionerServiceCapabilityDevice" ADD CONSTRAINT "PractitionerServiceCapabilityDevice_capabilityId_fkey"
  FOREIGN KEY ("capabilityId") REFERENCES "PractitionerServiceCapability"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PractitionerServiceCapabilityDevice" ADD CONSTRAINT "PractitionerServiceCapabilityDevice_deviceId_fkey"
  FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- The old qualification relation represented a Cartesian product. Preserve that behavior
-- exactly during backfill, then make the explicit capability rows authoritative.
INSERT INTO "PractitionerServiceCapability" ("id", "practitionerId", "serviceId", "roomId")
SELECT 'cap_' || md5(ps."A" || ':' || ps."B" || ':' || rs."A"), ps."A", ps."B", rs."A"
FROM "_PractitionerToService" ps
JOIN "_RoomToService" rs ON rs."B" = ps."B";

INSERT INTO "PractitionerServiceCapabilityDevice" ("capabilityId", "deviceId")
SELECT c."id", ds."A"
FROM "PractitionerServiceCapability" c
JOIN "_DeviceToService" ds ON ds."B" = c."serviceId";

DROP TABLE "_PractitionerToService";
