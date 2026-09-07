ALTER TABLE "Room"
  ADD COLUMN "poolKey" TEXT,
  ADD COLUMN "unitNumber" INTEGER;

ALTER TABLE "Device"
  ADD COLUMN "poolKey" TEXT,
  ADD COLUMN "unitNumber" INTEGER;

CREATE UNIQUE INDEX "Room_poolKey_unitNumber_key" ON "Room"("poolKey", "unitNumber");
CREATE INDEX "Room_poolKey_active_idx" ON "Room"("poolKey", "active");
CREATE UNIQUE INDEX "Device_poolKey_unitNumber_key" ON "Device"("poolKey", "unitNumber");
CREATE INDEX "Device_poolKey_active_idx" ON "Device"("poolKey", "active");

UPDATE "Room"
SET "poolKey" = 'treatment-room', "unitNumber" = 1, "displayOrder" = 1
WHERE "name" = 'Treatment room 1';

UPDATE "Device"
SET "poolKey" = CASE "name"
    WHEN 'Endospheres' THEN 'endospheres'
    WHEN 'Laser' THEN 'laser'
    WHEN 'MicroRF' THEN 'rf'
  END,
  "unitNumber" = 1,
  "displayOrder" = 1,
  "name" = "name" || ' 1'
WHERE "name" IN ('Endospheres', 'Laser', 'MicroRF');

INSERT INTO "Room" ("id", "name", "active", "displayOrder", "poolKey", "unitNumber")
SELECT
  'room_' || md5(source."poolKey" || ':' || unit.number::text),
  regexp_replace(source."name", ' [0-9]+$', '') || ' ' || unit.number,
  TRUE,
  unit.number,
  source."poolKey",
  unit.number
FROM "Room" source
CROSS JOIN generate_series(2, 4) AS unit(number)
WHERE source."poolKey" = 'treatment-room' AND source."unitNumber" = 1
ON CONFLICT ("poolKey", "unitNumber") DO NOTHING;

INSERT INTO "Device" ("id", "name", "active", "displayOrder", "poolKey", "unitNumber")
SELECT
  'device_' || md5(source."poolKey" || ':' || unit.number::text),
  regexp_replace(source."name", ' [0-9]+$', '') || ' ' || unit.number,
  TRUE,
  unit.number,
  source."poolKey",
  unit.number
FROM "Device" source
CROSS JOIN generate_series(2, 4) AS unit(number)
WHERE source."poolKey" IN ('endospheres', 'laser', 'rf') AND source."unitNumber" = 1
ON CONFLICT ("poolKey", "unitNumber") DO NOTHING;

-- Every physical unit inherits the service pool of unit one.
INSERT INTO "_RoomToService" ("A", "B")
SELECT target."id", mapping."B"
FROM "Room" source
JOIN "_RoomToService" mapping ON mapping."A" = source."id"
JOIN "Room" target ON target."poolKey" = source."poolKey" AND target."unitNumber" > 1
WHERE source."unitNumber" = 1
ON CONFLICT DO NOTHING;

INSERT INTO "_DeviceToService" ("A", "B")
SELECT target."id", mapping."B"
FROM "Device" source
JOIN "_DeviceToService" mapping ON mapping."A" = source."id"
JOIN "Device" target ON target."poolKey" = source."poolKey" AND target."unitNumber" > 1
WHERE source."unitNumber" = 1
ON CONFLICT DO NOTHING;

-- A new room is a distinct permitted allocation, never a shared capacity counter.
INSERT INTO "PractitionerServiceCapability"
  ("id", "practitionerId", "serviceId", "roomId", "createdAt", "updatedAt")
SELECT
  'cap_' || md5(source_cap."practitionerId" || ':' || source_cap."serviceId" || ':' || target_room."id"),
  source_cap."practitionerId",
  source_cap."serviceId",
  target_room."id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "PractitionerServiceCapability" source_cap
JOIN "Room" source_room ON source_room."id" = source_cap."roomId" AND source_room."unitNumber" = 1
JOIN "Room" target_room ON target_room."poolKey" = source_room."poolKey" AND target_room."unitNumber" > 1
ON CONFLICT ("practitionerId", "serviceId", "roomId") DO NOTHING;

-- Copy unit-one device permissions to the cloned room capabilities.
INSERT INTO "PractitionerServiceCapabilityDevice" ("capabilityId", "deviceId")
SELECT target_cap."id", source_link."deviceId"
FROM "PractitionerServiceCapability" source_cap
JOIN "Room" source_room ON source_room."id" = source_cap."roomId" AND source_room."unitNumber" = 1
JOIN "Room" target_room ON target_room."poolKey" = source_room."poolKey" AND target_room."unitNumber" > 1
JOIN "PractitionerServiceCapability" target_cap
  ON target_cap."practitionerId" = source_cap."practitionerId"
 AND target_cap."serviceId" = source_cap."serviceId"
 AND target_cap."roomId" = target_room."id"
JOIN "PractitionerServiceCapabilityDevice" source_link ON source_link."capabilityId" = source_cap."id"
ON CONFLICT DO NOTHING;

-- Each allowed device type expands to all four exclusive physical units.
INSERT INTO "PractitionerServiceCapabilityDevice" ("capabilityId", "deviceId")
SELECT link."capabilityId", target_device."id"
FROM "PractitionerServiceCapabilityDevice" link
JOIN "Device" source_device ON source_device."id" = link."deviceId" AND source_device."unitNumber" = 1
JOIN "Device" target_device
  ON target_device."poolKey" = source_device."poolKey" AND target_device."unitNumber" > 1
ON CONFLICT DO NOTHING;
