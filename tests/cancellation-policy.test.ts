import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  applyCancellationPolicyToAboutBody,
  cancellationPolicyText,
} from "../content/cancellation-policy";
import { getPageContent } from "../content/pages";

const bookingPage = readFileSync(
  "app/(public)/[locale]/ajanvaraus/page.tsx",
  "utf8",
);
const bookingWizard = readFileSync(
  "components/booking/BookingWizard.tsx",
  "utf8",
);
const termsPage = readFileSync(
  "app/(public)/[locale]/kayttoehdot/page.tsx",
  "utf8",
);
const contentSync = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260731220000_cancellation_policy/migration.sql",
  "utf8",
);

test("the approved tiered cancellation policy is complete in every locale", () => {
  for (const locale of ["fi", "en", "ru"] as const) {
    const policy = CANCELLATION_POLICY[locale];
    const text = cancellationPolicyText(locale);
    assert.match(policy.deadline, /24/);
    assert.match(policy.lateChange, /50\s?%/);
    assert.match(policy.sameDayOrNoShow, /100\s?%/);
    assert.ok(text.includes(policy.deadline));
    assert.ok(text.includes(policy.lateChange));
    assert.ok(text.includes(policy.sameDayOrNoShow));
  }
  assert.equal(CANCELLATION_POLICY_ANCHOR, "peruutusehdot");
});

test("the clinic-rules override changes only the known policy section", () => {
  const input = [
    "Before",
    "## **Cancellation & Rescheduling Rules**",
    "Old policy",
    "## **Product Return Rules**",
    "After",
  ].join("\n\n");
  const output = applyCancellationPolicyToAboutBody(input, "en");
  assert.match(output, /^Before/);
  assert.match(output, /Product Return Rules[\s\S]*After$/);
  assert.match(output, /same-day cancellations/);
  assert.doesNotMatch(output, /Old policy/);
});

test("fresh content imports publish the approved clinic rules", () => {
  for (const locale of ["fi", "en", "ru"] as const) {
    const page = getPageContent("about", locale);
    assert.ok(page);
    assert.ok(page.body.includes(CANCELLATION_POLICY[locale].lateChange));
    assert.ok(page.body.includes(CANCELLATION_POLICY[locale].sameDayOrNoShow));
  }
  assert.match(contentSync, /applyCancellationPolicyToAboutBody/);
});

test("booking shows the policy before confirmation and links to full terms", () => {
  assert.match(bookingPage, /cancellationPolicyText\(appLocale\)/);
  assert.match(bookingPage, /PUBLIC_PATHS\.terms/);
  assert.match(bookingPage, /CANCELLATION_POLICY_ANCHOR/);
  assert.match(bookingWizard, /cancellationPolicy\.text/);
  assert.match(bookingWizard, /cancellationPolicy\.href/);
  assert.ok(
    bookingWizard.indexOf("cancellationPolicy.text") <
      bookingWizard.indexOf('type="submit"'),
  );
});

test("terms expose the stable policy anchor and current review date", () => {
  assert.match(termsPage, /CANCELLATION_POLICY_ANCHOR/);
  assert.match(termsPage, /date="2026-07-31"/);
});

test("the production migration updates only localized about-page policy sections", () => {
  assert.equal((migration.match(/UPDATE "ContentPage"/g) ?? []).length, 3);
  assert.equal((migration.match(/WHERE "slug" = 'about'/g) ?? []).length, 3);
  assert.match(migration, /"locale" = 'fi'/);
  assert.match(migration, /"locale" = 'en'/);
  assert.match(migration, /"locale" = 'ru'/);
  assert.match(migration, /50 %/);
  assert.match(migration, /100%/);
});
