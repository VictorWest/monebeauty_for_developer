import assert from "node:assert/strict";
import test from "node:test";
import {
  currentConsultationConsentState,
  type ConsultationConsentRecord,
} from "../lib/consultation-consent-state";

const currentVersions = {
  health_profile: 3,
  consultation_accuracy: 2,
};

function state(records: ConsultationConsentRecord[]) {
  return currentConsultationConsentState(records, currentVersions);
}

test("current granted sign-up consents initialize both profile checkboxes as checked", () => {
  assert.deepEqual(
    state([
      { type: "health_profile", granted: true, textVersion: 3 },
      { type: "consultation_accuracy", granted: true, textVersion: 2 },
    ]),
    { healthDataConsent: true, accuracyAcknowledged: true },
  );
});

test("missing, denied, and outdated consent records remain unchecked", () => {
  assert.deepEqual(state([]), {
    healthDataConsent: false,
    accuracyAcknowledged: false,
  });
  assert.deepEqual(
    state([
      { type: "health_profile", granted: false, textVersion: 3 },
      { type: "consultation_accuracy", granted: true, textVersion: 1 },
    ]),
    { healthDataConsent: false, accuracyAcknowledged: false },
  );
});

test("only the latest record for each consent type determines checkbox state", () => {
  assert.deepEqual(
    state([
      { type: "health_profile", granted: false, textVersion: 3 },
      { type: "consultation_accuracy", granted: true, textVersion: 2 },
      { type: "health_profile", granted: true, textVersion: 3 },
    ]),
    { healthDataConsent: false, accuracyAcknowledged: true },
  );
});
