import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const router = read("components/admin/AdminRouter.tsx");
const shell = read("components/admin/AdminShell.tsx");
const adminActions = read("lib/admin-actions.ts");
const staffActions = read("lib/staff-account-actions.ts");
const changeRequests = read("lib/change-request-actions.ts");
const orderRequests = read("lib/order-cancellation-actions.ts");
const staffPage = read("app/(public)/[locale]/henkilosto/page.tsx");
const staffConfiguration = read("components/staff/EmployeeConfiguration.tsx");
const auditExport = read("app/api/admin/audit/export/route.ts");
const operations = read("components/admin/AdminOperations.tsx");

test("binding docs define the shared back office and narrow log exclusions", () => {
  for (const path of [
    "SCOPE.md",
    "REQUIREMENTS.md",
    "IMPLEMENTATION_PLAN.md",
  ]) {
    const source = read(path);
    assert.match(
      source,
      /Shared (?:staff\/admin|back-office|staff\/admin back office)/i,
    );
    assert.match(source, /Audit Logs/);
    assert.match(source, /Integration Logs/);
  }
});

test("staff use the localized admin shell without raw log navigation", () => {
  assert.match(router, /isBackofficeRole\(user\.role\)/);
  assert.match(router, /adminModule === "audit"/);
  assert.match(router, /adminModule === "integrations"/);
  assert.match(router, /endpoint="\/api\/staff\/configuration"/);
  assert.match(router, /loginHref=\{adminHref\(locale, "login"\)\}/);
  assert.match(shell, /module === "settings"/);
  assert.match(shell, /module === "audit" \|\| module === "integrations"/);
  assert.match(staffPage, /redirect\(adminBase\(appLocale\)\)/);
  assert.match(staffConfiguration, /loginHref/);
  for (const path of [
    "messages/fi.json",
    "messages/en.json",
    "messages/ru.json",
  ])
    assert.match(read(path), /"settings":/);
});

test("staff receive administrative actions while audit export stays admin-only", () => {
  assert.match(adminActions, /BACKOFFICE_ROLES/);
  assert.match(adminActions, /isBackofficeRole\(user\.role\)/);
  assert.match(staffActions, /isBackofficeRole\(user\.role\)/);
  assert.match(changeRequests, /isBackofficeRole\(admin\.role\)/);
  assert.match(orderRequests, /isBackofficeRole\(user\.role\)/);
  assert.match(auditExport, /requireApiUser\(\["ADMIN"\]\)/);
});

test("administrative APIs accept staff and preserve per-record delivery history", () => {
  for (const path of [
    "app/api/admin/media/upload/route.ts",
    "app/api/admin/calendar/setup/route.ts",
    "app/api/admin/clients/[id]/export/route.ts",
    "app/api/admin/clients/[id]/erase/route.ts",
    "app/api/admin/staff/[userId]/configuration/route.ts",
  ])
    assert.match(read(path), /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.match(operations, /externalApiAttempt/);
  assert.match(operations, /providerRequestId/);
});

test("calendar and chat no longer reduce staff to their linked employee", () => {
  for (const path of [
    "app/api/calendar/appointments/route.ts",
    "app/api/calendar/appointments/[id]/route.ts",
    "app/api/calendar/assignments/route.ts",
    "app/api/calendar/blocks/route.ts",
    "app/api/calendar/blocks/[id]/route.ts",
    "app/api/calendar/working-dates/route.ts",
  ]) {
    const source = read(path);
    assert.match(source, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
    assert.doesNotMatch(source, /ownPractitionerId|forbidden_employee/);
  }
  assert.match(read("app/api/internal/chat/route.ts"), /canArchive: true/);
  assert.match(read("app/api/internal/chat/[id]/route.ts"), /canArchive: true/);
});
