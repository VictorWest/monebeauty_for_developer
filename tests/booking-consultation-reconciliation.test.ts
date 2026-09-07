import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");
const types = read("lib/consultation-types.ts");
const consultation = read("lib/consultation.ts");
const route = read("app/api/booking/route.ts");
const wizard = read("components/booking/BookingWizard.tsx");
const bookingPage = read("app/(public)/[locale]/ajanvaraus/page.tsx");
const reconciliation = read("lib/identity-reconciliation.ts");
const actions = read("lib/client-account-actions.ts");
const registration = read(
  "app/(public)/[locale]/oma-tili/rekisteroidy/page.tsx",
);

test("booking receives a serializable versioned consultation form and saved client answers", () => {
  assert.match(types, /type BookingConsultationConfig/);
  assert.match(types, /contentVersion: number/);
  assert.match(types, /dateOfBirth: string/);
  assert.match(types, /answers: Record<string, ConsultationAnswer>/);
  assert.match(types, /healthConsent: true/);
  assert.match(types, /accuracyAcknowledged: true/);
  assert.match(bookingPage, /serializeConsultationForm/);
  assert.match(bookingPage, /decryptSavedConsultation/);
  assert.match(bookingPage, /savedConsultation=\{savedConsultation\}/);
});

test("the fourth booking step renders and submits consultation data only when required", () => {
  assert.match(wizard, /type Step = 1 \| 2 \| 3 \| 4/);
  assert.match(
    wizard,
    /consultationRequired = !clientSignedIn \|\| !consultationCurrent/,
  );
  assert.match(wizard, /<ConsultationFields/);
  assert.match(wizard, /contentVersion: consultationConfig\.contentVersion/);
  assert.match(wizard, /healthConsent: consultation\.healthConsent/);
  assert.match(
    wizard,
    /accuracyAcknowledged: consultation\.accuracyAcknowledged/,
  );
  assert.match(wizard, /navigation="dateOfBirth"/);
});

test("booking validates the live editable form twice and atomically encrypts profile and consent snapshots", () => {
  assert.match(
    route,
    /validateConsultationSubmission\(payload\.consultation, formConfig/,
  );
  assert.match(route, /loadConsultationForm\(tx\)/);
  assert.match(
    route,
    /validateConsultationSubmission\([\s\S]*payload\.consultation,[\s\S]*liveForm/,
  );
  assert.match(route, /consultationProfile\.upsert/);
  assert.match(route, /type: "health_profile"/);
  assert.match(route, /type: "consultation_accuracy"/);
  assert.match(route, /type: "procedure_booking"/);
  assert.ok(
    route.indexOf("consultationProfile.upsert") <
      route.indexOf("appointment.create"),
  );
  assert.match(consultation, /encryptSensitiveText\(dateOfBirth\)/);
  assert.match(consultation, /encryptSensitiveJson\(snapshots\)/);
  assert.match(consultation, /consultation_stale/);
  assert.match(consultation, /consultation_unavailable/);
});

test("verified reconciliation selects the newest readable profile and relinks value-free consent history", () => {
  assert.match(reconciliation, /orderBy: \[\{ updatedAt: "desc" \}/);
  assert.match(reconciliation, /decryptSensitiveText/);
  assert.match(reconciliation, /decryptSensitiveJson/);
  assert.match(reconciliation, /consent\.updateMany/);
  assert.match(reconciliation, /"health_profile", "consultation_accuracy"/);
  assert.match(reconciliation, /appointmentId: \{ in: linkedAppointmentIds \}/);
  assert.match(reconciliation, /consultationProfile\.upsert/);
  assert.match(reconciliation, /consultationProfile\.deleteMany/);
  assert.match(reconciliation, /matchMethod:/);
  assert.doesNotMatch(
    reconciliation,
    /metadata:\s*\{[^}]*(?:answer|dateOfBirth|phone|email):/,
  );
});

test("claim-bound registration reuses only a current decryptable guest profile after verification", () => {
  assert.match(
    consultation,
    /validAccountToken\(rawToken, "CLAIM_APPOINTMENT"\)/,
  );
  assert.match(
    consultation,
    /profile\.completedVersion < form\.requiredVersion/,
  );
  assert.match(
    consultation,
    /normalizeContactEmail\(appointment\.contactEmail\)/,
  );
  assert.match(
    consultation,
    /decryptSensitiveText\(profile\.dateOfBirthEncrypted\)/,
  );
  assert.match(registration, /value=\{reusableClaim\.email\}/);
  assert.match(registration, /readOnly/);
  assert.match(registration, /t\.consultationReuse/);
  assert.match(actions, /const reusableClaim = claim/);
  assert.match(actions, /if \(encryptedProfile\)/);
  assert.ok(
    actions.indexOf("await reconcileGuestHistory(user.id)") >
      actions.indexOf("export async function verifyClientEmailAction"),
  );
});

test("consultation plaintext stays outside appointment responses and notification code", () => {
  const response = route.slice(route.lastIndexOf("return NextResponse.json({"));
  assert.doesNotMatch(response, /dateOfBirth|answersEncrypted|consultation:/);
  for (const path of [
    "lib/notifications.ts",
    "lib/email/messages.ts",
    "lib/email/lifecycle.ts",
    "lib/ai.ts",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /dateOfBirthEncrypted|answersEncrypted/);
  }
});
