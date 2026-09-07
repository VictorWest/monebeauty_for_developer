import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assertSensitiveDataEncryptionConfigured,
  decryptSensitiveJson,
  decryptSensitiveText,
  encryptSensitiveJson,
  encryptSensitiveText,
  isSensitiveDataEncryptionConfigured,
} from "../lib/sensitive-data";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260826120000_online_booking_specialists_consultation/migration.sql",
  "utf8",
);
const booking = readFileSync("lib/booking.ts", "utf8");
const bookingRoute = readFileSync("app/api/booking/route.ts", "utf8");
const roster = readFileSync(
  "scripts/migrate-online-booking-specialists.ts",
  "utf8",
);
const accountActions = readFileSync("lib/client-account-actions.ts", "utf8");
const registrationPage = readFileSync(
  "app/(public)/[locale]/oma-tili/rekisteroidy/page.tsx",
  "utf8",
);
const accountPage = readFileSync(
  "app/(public)/[locale]/oma-tili/page.tsx",
  "utf8",
);

test("sensitive consultation values use authenticated AES-256-GCM envelopes", () => {
  const previous = process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
  process.env.SENSITIVE_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
    "base64",
  );
  try {
    const healthAnswer = "private health answer";
    const encrypted = encryptSensitiveText(healthAnswer);
    assert.match(encrypted, /^v1:/);
    assert.doesNotMatch(encrypted, /private health answer/);
    assert.equal(decryptSensitiveText(encrypted), healthAnswer);
    const json = encryptSensitiveJson({ answer: healthAnswer });
    assert.doesNotMatch(json, /private health answer/);
    assert.deepEqual(decryptSensitiveJson(json), { answer: healthAnswer });
  } finally {
    if (previous === undefined)
      delete process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
    else process.env.SENSITIVE_DATA_ENCRYPTION_KEY = previous;
  }
});

test("missing and invalid sensitive-data keys fail closed", () => {
  const previous = process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
  try {
    delete process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
    assert.throws(() => encryptSensitiveText("secret"), /is required/);
    assert.equal(isSensitiveDataEncryptionConfigured(), false);
    process.env.SENSITIVE_DATA_ENCRYPTION_KEY = "too-short";
    assert.throws(() => encryptSensitiveText("secret"), /valid base64/);
    process.env.SENSITIVE_DATA_ENCRYPTION_KEY = `${"A".repeat(43)}!`;
    assert.throws(() => encryptSensitiveText("secret"), /valid base64/);
    process.env.SENSITIVE_DATA_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
      "hex",
    );
    assert.doesNotThrow(() => assertSensitiveDataEncryptionConfigured());
    assert.equal(isSensitiveDataEncryptionConfigured(), true);
  } finally {
    if (previous === undefined)
      delete process.env.SENSITIVE_DATA_ENCRYPTION_KEY;
    else process.env.SENSITIVE_DATA_ENCRYPTION_KEY = previous;
  }
});

test("schema separates option qualification, resource capability, buffer, and consultation data", () => {
  assert.match(schema, /model PractitionerServiceOptionQualification/);
  assert.match(schema, /serviceOptionId\s+String/);
  assert.match(schema, /publicName\s+String\?/);
  assert.match(schema, /reservedUntil\s+DateTime\?/);
  assert.match(schema, /bufferMinutes\s+Int\s+@default\(15\)/);
  assert.match(schema, /model ConsultationProfile/);
  assert.match(schema, /dateOfBirthEncrypted\s+String/);
  assert.match(schema, /answersEncrypted\s+String/);
  assert.match(schema, /enum ConsultationQuestionType/);
});

test("new scheduling paths reserve the visible end plus fifteen minutes", () => {
  assert.match(booking, /APPOINTMENT_BUFFER_MINUTES = 15/);
  assert.match(booking, /duration \+ APPOINTMENT_BUFFER_MINUTES/);
  assert.match(booking, /appointment\.reservedUntil \?\? appointment\.end/);
  assert.match(bookingRoute, /reservedUntil:/);
  assert.match(bookingRoute, /bufferEnforced: true/);
  assert.match(migration, /Appointment_buffered_practitioner_no_overlap/);
  assert.match(migration, /Appointment_buffered_room_no_overlap/);
  assert.match(migration, /Appointment_buffered_device_no_overlap/);
});

test("roster migration is dry-run by default and preserves existing identities", () => {
  assert.match(roster, /process\.argv\.includes\("--apply"\)/);
  assert.match(roster, /irene\.length === 1 && irena\.length === 0/);
  assert.match(roster, /skipDuplicates: true/);
  assert.match(roster, /futureBufferConflicts/);
  assert.match(roster, /process\.exitCode = 1/);
  assert.doesNotMatch(roster, /user\.create|passwordHash/);
});

test("registration and signed-in profile updates encrypt snapshots and gate booking", () => {
  assert.match(accountActions, /firstName/);
  assert.match(accountActions, /lastName/);
  assert.match(accountActions, /encryptSensitiveText\(dateOfBirth\)/);
  assert.match(accountActions, /encryptSensitiveJson/);
  assert.match(accountActions, /health_profile/);
  assert.match(accountActions, /consultation_accuracy/);
  const registrationTransaction = accountActions.indexOf(
    "const user = await prisma.$transaction",
  );
  const registrationEncryption = accountActions.indexOf(
    "encryptedConsultationProfile(dateOfBirth",
  );
  assert.ok(registrationEncryption > 0);
  assert.ok(registrationEncryption < registrationTransaction);
  const updateAction = accountActions.slice(
    accountActions.indexOf(
      "export async function updateConsultationProfileAction",
    ),
    accountActions.indexOf("export async function saveClientAddressAction"),
  );
  assert.ok(
    updateAction.indexOf("encryptedConsultationProfile") <
      updateAction.indexOf("prisma.$transaction"),
  );
  assert.match(accountActions, /consultation_unavailable/);
  assert.match(registrationPage, /consultationUnavailable/);
  assert.match(accountPage, /consultationUnavailable/);
  assert.match(accountPage, /try \{[\s\S]*decryptSensitiveJson[\s\S]*catch \{/);
  assert.match(accountPage, /consultationUnavailable \? \(/);
  assert.match(bookingRoute, /consultation_required/);
  assert.match(bookingRoute, /procedure_consent_stale/);
  assert.match(bookingRoute, /wordingSnapshot: liveProcedureWording/);
});

test("date of birth uses the shared historical calendar throughout the client portal", () => {
  for (const page of [registrationPage, accountPage]) {
    assert.match(page, /<DatePicker[\s\S]*?name="dateOfBirth"/);
    assert.match(page, /autoComplete="bday"/);
    assert.match(page, /max=\{clinicTodayYmd\(\)\}/);
    assert.match(page, /disableClosedDays=\{false\}/);
    assert.match(page, /navigation="dateOfBirth"/);
    assert.match(page, /required/);
    assert.doesNotMatch(page, /type="(?:date|datetime-local)"/);
  }
  assert.doesNotMatch(registrationPage, /defaultValue=/);
  assert.match(accountPage, /defaultValue=\{consultationDob\}/);
});
