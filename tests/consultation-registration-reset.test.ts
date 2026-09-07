import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "prisma/migrations/20260828120000_consultation_registration_defaults/migration.sql",
  "utf8",
);
const registration = readFileSync(
  "app/(public)/[locale]/oma-tili/rekisteroidy/page.tsx",
  "utf8",
);
const account = readFileSync("app/(public)/[locale]/oma-tili/page.tsx", "utf8");
const actions = readFileSync("lib/client-account-actions.ts", "utf8");
const booking = readFileSync("app/api/booking/route.ts", "utf8");
const reset = readFileSync("scripts/reset-production-clients.ts", "utf8");
const adminEditor = readFileSync(
  "components/admin/ConsultationFormAdmin.tsx",
  "utf8",
);
const adminRoute = readFileSync("app/api/admin/consultation/route.ts", "utf8");

test("the guarded migration installs the three required localized long-text questions", () => {
  assert.match(
    migration,
    /IF NOT EXISTS \(SELECT 1 FROM "ConsultationQuestion"\)/,
  );
  for (const key of [
    "allergies_reactions",
    "relevant_health_information",
    "contraindications_other",
  ]) {
    assert.match(migration, new RegExp(`'${key}', 'LONG_TEXT', true`));
  }
  for (const locale of ["'fi'", "'en'", "'ru'"])
    assert.equal(migration.split(locale).length - 1, 3);
  assert.match(
    migration,
    /"requiredVersion" = GREATEST\("requiredVersion", 2\)/,
  );
  assert.match(migration, /"contentVersion" = GREATEST\("contentVersion", 2\)/);
  assert.match(
    migration,
    /"accuracyVersion" = GREATEST\("accuracyVersion", 2\)/,
  );
  assert.match(migration, /read the required information/);
});

test("registration and account show required information before health questions", () => {
  for (const page of [registration, account]) {
    const wording = page.indexOf("requiredInformationWording");
    const questions = page.indexOf("questions.map", wording);
    assert.ok(wording >= 0 && questions > wording);
  }
  assert.match(registration, /accountDetails/);
  assert.match(registration, /consultationDetails/);
  assert.match(registration, /sm:p-5/);
});

test("consultation validation, encryption, and distinct consent snapshots remain enforced", () => {
  assert.match(actions, /item\.required/);
  assert.match(actions, /encryptedConsultationProfile/);
  assert.match(actions, /type: "health_profile"/);
  assert.match(actions, /type: "consultation_accuracy"/);
  assert.match(booking, /type: "procedure_booking"/);
  assert.match(booking, /wordingSnapshot: liveProcedureWording/);
});

test("consultation questions remain editable, reorderable, archivable, and versioned", () => {
  assert.match(adminEditor, /displayOrder/);
  assert.match(adminEditor, /active/);
  assert.match(adminRoute, /consultationQuestion\.updateMany/);
  assert.match(adminRoute, /archivedAt: new Date\(\)/);
  assert.match(adminRoute, /version: \{ increment: 1 \}/);
  assert.match(adminRoute, /requiredVersion: \{ increment: 1 \}/);
  assert.match(adminRoute, /contentVersion: \{ increment: 1 \}/);
});

test("production reset is immutable by default and guarded against unsafe orders and drift", () => {
  assert.match(reset, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(reset, /if \(!apply\) return/);
  assert.match(reset, /--confirm-database=/);
  assert.match(reset, /paymentStatus !== "UNPAID"/);
  assert.match(reset, /order\.payments\.length > 0/);
  assert.match(reset, /order\.refunds\.length > 0/);
  for (const [key, count] of Object.entries({
    appointments: 10,
    clients: 8,
    clientUsers: 4,
    clientSessions: 8,
    clientAccountTokens: 4,
    legacyOrders: 1,
  }))
    assert.match(reset, new RegExp(`${key}: ${count}`));
  assert.doesNotMatch(reset, /auditLog\.delete/);
  assert.match(reset, /timeout: 60_000/);
  assert.match(reset, /Protected operational counts changed/);
  assert.match(reset, /consultationQuestions !== 3/);
});
