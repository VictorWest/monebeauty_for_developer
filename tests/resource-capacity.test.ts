import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260731140000_resource_capacity_units/migration.sql",
);
const capacity = read("lib/resource-capacity.ts");
const setupApi = read("app/api/admin/calendar/setup/route.ts");
const setupUi = read("components/calendar/CalendarSetup.tsx");
const seed = read("prisma/seed.ts");
const calendarApi = read("app/api/calendar/route.ts");
const calendar = read("components/calendar/SharedCalendar.tsx");

test("rooms and devices are exclusive, individually addressable pool units", () => {
  assert.match(schema, /model Room[\s\S]*?poolKey\s+String\?/);
  assert.match(schema, /model Device[\s\S]*?unitNumber\s+Int\?/);
  assert.equal(
    (schema.match(/@@unique\(\[poolKey, unitNumber\]\)/g) ?? []).length,
    2,
  );
  assert.match(capacity, /kind: "room" as const,[\s\S]*?key: "treatment-room"/);
  assert.match(capacity, /key: "endospheres"/);
  assert.match(capacity, /key: "laser"/);
  assert.match(capacity, /key: "rf"/);
});

test("migration and seed provision four rooms and four of every device", () => {
  assert.match(migration, /generate_series\(2, 4\)/);
  assert.match(migration, /'treatment-room'/);
  assert.match(migration, /'endospheres', 'laser', 'rf'/);
  assert.match(migration, /INSERT INTO "_RoomToService"/);
  assert.match(migration, /INSERT INTO "_DeviceToService"/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapability"/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapabilityDevice"/);
  assert.match(seed, /unitNumber <= 4/);
  assert.match(seed, /const treatmentRooms = \[\]/);
  assert.match(seed, /deviceIds\.push\(device\.id\)/);
});

test("admin count changes preserve bookings and report resources needing rescheduling", () => {
  assert.match(setupApi, /action === "setResourceCount"/);
  assert.match(setupApi, /setResourcePoolCount/);
  assert.match(capacity, /const deactivatedIds/);
  assert.match(capacity, /start: \{ gte: new Date\(\) \}/);
  assert.match(capacity, /return affectedAppointments/);
  assert.match(setupApi, /affectedAppointmentIds/);
  assert.match(setupApi, /warning: appointmentIds\.length/);
  assert.match(setupUi, /Active physical units/);
  assert.match(setupUi, /Future appointments still use inactive resources/);
  assert.match(setupUi, /reviewCalendar/);
});

test("calendar keeps legacy appointments visible and marks inactive resources", () => {
  assert.match(calendarApi, /resourceWarning:/);
  assert.match(calendarApi, /appointment\.channel === "web"/);
  assert.match(calendar, /appointment\.resourceWarning\.length > 0/);
  assert.match(calendar, /ranges\.push\(\.\.\.eventRanges\)/);
  const appointmentFilter = calendar.slice(
    calendar.indexOf("{appointments\n          .filter"),
    calendar.indexOf(
      ".map((appointment) =>",
      calendar.indexOf("{appointments"),
    ),
  );
  assert.doesNotMatch(appointmentFilter, /availabilityCovers/);
});
