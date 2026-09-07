import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCheckoutPhone,
  normalizeInternationalPhone,
} from "../lib/phone";

test("checkout phone accepts readable international numbers and normalizes to E.164", () => {
  assert.equal(normalizeCheckoutPhone("+358 40 123 4567"), "+358401234567");
  assert.equal(normalizeCheckoutPhone("+234 (807) 123-4567"), "+2348071234567");
  assert.equal(normalizeCheckoutPhone("+1.202.555.0123"), "+12025550123");
  assert.equal(normalizeCheckoutPhone("  +44 20 7946 0958  "), "+442079460958");
});

test("checkout phone rejects local, implicit, malformed, and non-E.164 numbers", () => {
  for (const value of [
    "040 123 4567",
    "358401234567",
    "00358 40 123 4567",
    "phone +358401234567",
    "+358 40 CALL ME",
    "358+401234567",
    "++358401234567",
    "+1234567",
    "+1234567890123456",
    "+0123456789",
  ]) {
    assert.equal(normalizeCheckoutPhone(value), null, value);
  }
});

test("general phone normalization remains compatible with Finnish local numbers", () => {
  assert.equal(normalizeInternationalPhone("040 123 4567"), "+358401234567");
  assert.equal(
    normalizeInternationalPhone("00358 40 123 4567"),
    "+358401234567",
  );
});
