import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260722150000_employee_configuration_capabilities/migration.sql",
);
const service = read("lib/staff-configuration.ts");
const staffApi = read("app/api/staff/configuration/route.ts");
const adminApi = read("app/api/admin/staff/[userId]/configuration/route.ts");
const editor = read("components/staff/EmployeeConfiguration.tsx");
const setup = read("components/calendar/CalendarSetup.tsx");
const booking = read("lib/booking.ts");
const appointmentForm = read("components/calendar/AppointmentForm.tsx");
const cleanup = read("scripts/cleanup-default-availability.ts");
const packageJson = read("package.json");

test("capabilities replace implicit employee qualification with exact resource tuples", () => {
  assert.match(schema, /model PractitionerServiceCapability \{/);
  assert.match(schema, /@@unique\(\[practitionerId, serviceId, roomId\]\)/);
  assert.match(schema, /model PractitionerServiceCapabilityDevice \{/);
  assert.doesNotMatch(schema, /PractitionerToService/);
  assert.match(booking, /completeCapabilities/);
  assert.match(booking, /const room = capability\.room/);
  assert.match(appointmentForm, /selectedService\?\.capabilities\.some/);
});

test("migration preflights future appointments, backfills, and retires the old relation", () => {
  assert.match(migration, /RAISE EXCEPTION 'Capability migration aborted/);
  assert.match(migration, /a\."roomId" IS NULL/);
  assert.match(migration, /s\."requiresDevice" AND a\."deviceId" IS NULL/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapability"/);
  assert.match(migration, /INSERT INTO "PractitionerServiceCapabilityDevice"/);
  assert.match(migration, /DROP TABLE "_PractitionerToService"/);
});

test("self-service stays own-only while the shared back office targets any staff employee", () => {
  assert.match(staffApi, /requireApiUser\(\["STAFF"\]\)/);
  assert.match(staffApi, /targetUserId: user\.id/);
  assert.match(
    staffApi,
    /patch\.userId \|\| patch\.practitionerId \|\| patch\.employeeId/,
  );
  assert.match(adminApi, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.match(adminApi, /\(await context\.params\)\.userId/);
  assert.match(adminApi, /administrative: true/);
  assert.match(service, /Boolean\(args\.administrative\)/);
  assert.match(service, /actor\.id !== targetUserId/);
  assert.match(service, /forbidden_target/);
});

test("employee configuration labels follow the validated interface locale", () => {
  for (const api of [staffApi, adminApi]) {
    assert.match(api, /searchParams\.get\("locale"\)/);
    assert.match(
      api,
      /locale === "fi" \|\| locale === "en" \|\| locale === "ru"/,
    );
    assert.match(api, /invalid_locale/);
    assert.match(api, /getStaffConfiguration/);
    assert.match(api, /, locale\)/);
    assert.match(api, /displayLocale: locale/);
  }
  assert.match(service, /where: \{ locale: contentLocale \}/);
  assert.match(
    service,
    /name: service\.contents\[0\]\?\.h1 \?\? service\.slug/,
  );
  assert.match(editor, /locale=\$\{locale\}/);
});

test("default availability cleanup is explicit, future-only, and dry-run by default", () => {
  assert.match(service, /availabilityMatchesWeeklySchedule/);
  assert.match(cleanup, /process\.argv\.includes\("--apply"\)/);
  assert.match(cleanup, /date: \{ gte: today \}/);
  assert.match(cleanup, /mode: apply \? "apply" : "dry-run"/);
  assert.match(cleanup, /availability\.deleteMany/);
  assert.match(packageJson, /"availability:cleanup-defaults"/);
});

test("configuration mutations enforce credentials, optimistic versions, guards, and audits", () => {
  assert.match(service, /normalizeEmail\(patch\.account\.email\)/);
  assert.match(service, /current_password_required/);
  assert.match(service, /session\.deleteMany/);
  assert.match(service, /configVersion: patch\.version/);
  assert.match(service, /configVersion: \{ increment: 1 \}/);
  assert.match(service, /version_conflict/);
  assert.match(service, /future_appointments/);
  assert.match(service, /TransactionIsolationLevel\.Serializable/);
  assert.match(service, /staff_configuration_updated/);
  assert.match(staffApi, /staff_configuration_denied/);
  assert.match(adminApi, /staff_configuration_denied/);
});

test("employee editor is localized, mobile-first, and Calendar Setup is global-only", () => {
  assert.match(editor, /Employee configuration/);
  assert.match(editor, /Access & security/);
  assert.match(editor, /Työntekijän asetukset/);
  assert.match(editor, /Настройки сотрудника/);
  assert.match(editor, /WeeklyScheduleEditor/);
  assert.match(editor, /sm:grid-cols/);
  assert.doesNotMatch(editor, /type="date"|type="time"|<select/);
  assert.doesNotMatch(setup, /data\.practitioners\.map/);
  assert.match(
    setup,
    /Manage employee profiles and booking capabilities in Staff/,
  );
});
