import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "../lib/contact-normalization";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const migration = readFileSync(
  "prisma/migrations/20260801150000_guest_history_order_cancellation/migration.sql",
  "utf8",
);
const reconciliation = readFileSync("lib/identity-reconciliation.ts", "utf8");
const authActions = readFileSync("lib/client-account-actions.ts", "utf8");
const cancellationActions = readFileSync(
  "lib/order-cancellation-actions.ts",
  "utf8",
);
const account = readFileSync("app/(public)/[locale]/oma-tili/page.tsx", "utf8");
const admin = readFileSync("components/admin/AdminOperations.tsx", "utf8");

test("contact keys normalize case and equivalent Finnish/international phone formats", () => {
  assert.equal(
    normalizeContactEmail(" Guest@Example.COM "),
    "guest@example.com",
  );
  assert.equal(normalizeContactEmail("invalid"), null);
  assert.equal(normalizeContactPhone("040 129 3800"), "+358401293800");
  assert.equal(normalizeContactPhone("00358 (40) 129-3800"), "+358401293800");
  assert.equal(normalizeContactPhone("+358 40 129 3800"), "+358401293800");
  assert.equal(normalizeContactPhone("not-a-phone"), null);
});

test("normalized snapshots are indexed, backfilled, and written by checkout and booking", () => {
  assert.match(schema, /normalizedEmail\s+String\?/);
  assert.match(schema, /normalizedPhone\s+String\?/);
  assert.match(schema, /normalizedContactEmail\s+String\?/);
  assert.match(schema, /normalizedContactPhone\s+String\?/);
  assert.match(migration, /UPDATE "Order"/);
  assert.match(migration, /UPDATE "Appointment"/);
  assert.match(migration, /Order_normalizedEmail_idx/);
  assert.match(migration, /Appointment_normalizedContactPhone_idx/);
  for (const file of [
    "app/api/checkout/route.ts",
    "app/api/booking/route.ts",
    "app/api/calendar/appointments/route.ts",
    "app/api/calendar/appointments/[id]/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /normalized(?:Contact)?Email/);
    assert.match(source, /normalized(?:Contact)?Phone/);
  }
});

test("verification and every successful login run idempotent guarded reconciliation", () => {
  assert.equal(
    (authActions.match(/reconcileGuestHistory\(user\.id\)/g) ?? []).length,
    3,
  );
  assert.match(reconciliation, /user\.emailVerifiedAt/);
  assert.match(reconciliation, /otherVerifiedEmails/);
  assert.match(reconciliation, /phoneIsSafe/);
  assert.match(reconciliation, /client: guestOwner/);
  assert.match(reconciliation, /appointmentChangeRequest\.updateMany/);
  assert.match(reconciliation, /matchMethod: method, recordType: "order"/);
  assert.match(
    reconciliation,
    /matchMethod: method, recordType: "appointment"/,
  );
  assert.doesNotMatch(reconciliation, /data:\s*\{[^}]*contact(?:Email|Phone)/);
});

test("legacy appointment claims are repeat-safe and cannot steal registered ownership", () => {
  assert.match(authActions, /appointment\.client\.userId !== user\.id/);
  assert.match(authActions, /appointment\.clientId === client\.id/);
  assert.match(authActions, /consumedAt: null/);
  assert.match(authActions, /appointmentChangeRequest\.updateMany/);
});

test("one pending cancellation request is database enforced and client owned", () => {
  assert.match(schema, /model OrderCancellationRequest/);
  assert.match(migration, /OrderCancellationRequest_one_pending_per_order/);
  assert.match(cancellationActions, /user\.role !== "CLIENT"/);
  assert.match(cancellationActions, /clientId: client\.id/);
  assert.match(cancellationActions, /reason\.length < 3/);
  assert.match(cancellationActions, /\.slice\(0, 500\)/);
  assert.match(cancellationActions, /terminalOrderStatuses/);
  assert.match(account, /cancellationRequests/);
  assert.match(account, /minLength=\{3\}/);
  assert.match(account, /maxLength=\{500\}/);
});

test("admin review revalidates state and covers unpaid expiry, legacy cancellation, and remaining refunds", () => {
  assert.match(cancellationActions, /isBackofficeRole\(user\.role\)/);
  assert.match(cancellationActions, /status: "PENDING"/);
  assert.match(cancellationActions, /checkout\.sessions\.expire/);
  assert.match(cancellationActions, /order-cancellation:\$\{requestId\}/);
  assert.match(cancellationActions, /PARTIALLY_REFUNDED/);
  assert.match(cancellationActions, /REFUND_PENDING/);
  assert.match(cancellationActions, /order_cancellation_review_failed/);
  assert.match(cancellationActions, /status: "FAILED"/);
  assert.match(admin, /PENDING_REQUEST/);
  assert.match(admin, /reviewOrderCancellationRequestAction/);
  assert.match(
    admin,
    /decisionReason[\s\S]*required|required[\s\S]*decisionReason/,
  );
});

test("request acknowledgement and FI/EN/RU decision copy are present", () => {
  const notifications = readFileSync("lib/notifications.ts", "utf8");
  assert.match(notifications, /notifyOrderCancellationRequest/);
  assert.match(notifications, /ORDER_CANCELLATION_REQUESTED/);
  assert.match(notifications, /ORDER_CANCELLATION_REQUEST_DECIDED/);
  for (const locale of ["fi", "en", "ru"]) {
    const messages = JSON.parse(
      readFileSync(`messages/${locale}.json`, "utf8"),
    );
    assert.ok(messages.AdminOperations.cancellationRequests);
    assert.ok(messages.AdminOperations.requestStatusLabels.APPROVED);
    assert.ok(messages.AdminOperations.statusLabels.PENDING_REQUEST);
  }
});
