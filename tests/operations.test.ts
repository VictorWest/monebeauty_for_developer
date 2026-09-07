import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { appointmentSms, orderSms, smsSegments } from "../lib/sms";
import { normalizeInternationalPhone } from "../lib/phone";
import {
  normalizeOperationsRange,
  operationsDateRange,
  operationsFilterQuery,
  validCalendarDate,
} from "../lib/operations-filter";

const schema = readFileSync("prisma/schema.prisma", "utf8");
const router = readFileSync("components/admin/AdminRouter.tsx", "utf8");
const shell = readFileSync("components/admin/AdminShell.tsx", "utf8");
const operations = readFileSync("components/admin/AdminOperations.tsx", "utf8");
const operationsFilter = readFileSync(
  "components/admin/OperationsFilter.tsx",
  "utf8",
);
const actions = readFileSync("lib/admin-actions.ts", "utf8");
const checkout = readFileSync("app/api/checkout/route.ts", "utf8");
const reschedule = readFileSync("app/api/booking/reschedule/route.ts", "utf8");
const changeRequests = readFileSync("lib/change-request-actions.ts", "utf8");

test("orders and appointments are first-class admin modules", () => {
  assert.match(shell, /module: "appointments"/);
  assert.match(shell, /module: "orders"/);
  assert.match(router, /module: "appointments"/);
  assert.match(router, /module: "orders"/);
  assert.match(router, /<AppointmentsAdmin/);
  assert.match(router, /<OrdersAdmin/);
  assert.match(router, /appointmentsNeedingAction/);
  assert.match(router, /ordersNeedingAction/);
  assert.match(operations, /<OperationsFilter/);
  assert.doesNotMatch(operations, /name="practitioner"/);
  assert.match(operationsFilter, /<ThemedSelect/);
  assert.match(operations, /<DatePicker/);
  assert.match(operations, /<TimePicker/);
  assert.match(operations, /\{ value: "", label: t\("all"\) \}/);
  assert.match(operations, /value: "ACTIVE", label: t\("active"\)/);
  assert.doesNotMatch(operationsFilter, /Apply filters|type="submit"/);
  assert.match(
    operations,
    /prisma\.appointment\.findMany\(\{[\s\S]*?orderBy: \[\{ start: "desc" \}, \{ createdAt: "desc" \}, \{ id: "desc" \}\]/,
  );
  assert.match(
    operationsFilter,
    /window\.setTimeout\(\(\) => replace\(filters\), 350\)/,
  );
  assert.match(operationsFilter, /max=\{filters\.to \|\| undefined\}/);
  assert.match(operationsFilter, /min=\{filters\.from \|\| undefined\}/);
});

test("operation date ranges are strict, normalized, and future-safe", () => {
  assert.equal(validCalendarDate("2028-02-29"), true);
  assert.equal(validCalendarDate("2027-02-29"), false);
  assert.equal(validCalendarDate("2026-02-31"), false);
  assert.equal(validCalendarDate("2026-2-01"), false);
  assert.deepEqual(normalizeOperationsRange("2030-06-20", "2030-06-20"), {
    from: "2030-06-20",
    to: "2030-06-20",
  });
  assert.deepEqual(normalizeOperationsRange("2030-06-22", "2030-06-20"), {
    from: "2030-06-20",
    to: "2030-06-22",
  });
  assert.deepEqual(normalizeOperationsRange("2026-02-31", "2030-06-20"), {
    from: "",
    to: "2030-06-20",
  });
});

test("operation ranges use inclusive Helsinki calendar days", () => {
  const winter = operationsDateRange("2026-01-15", "2026-01-15");
  assert.equal(winter?.gte?.toISOString(), "2026-01-14T22:00:00.000Z");
  assert.equal(winter?.lt?.toISOString(), "2026-01-15T22:00:00.000Z");
  const summer = operationsDateRange("2026-07-15", "2026-07-15");
  assert.equal(summer?.gte?.toISOString(), "2026-07-14T21:00:00.000Z");
  assert.equal(summer?.lt?.toISOString(), "2026-07-15T21:00:00.000Z");
});

test("automatic operation filter URLs omit blanks and reset pagination", () => {
  const filters = {
    q: "  Ada  ",
    status: "",
    from: "2030-01-01",
    to: "",
  };
  assert.equal(operationsFilterQuery(filters), "q=Ada&from=2030-01-01");
  assert.equal(
    operationsFilterQuery(filters, 3),
    "q=Ada&from=2030-01-01&page=3",
  );
  assert.doesNotMatch(
    operationsFilterQuery(filters),
    /page|practitioner|date=/,
  );
});

test("operation lists default to all statuses and keep active explicit", () => {
  assert.match(
    operations,
    /rawStatus === "ACTIVE" \? "ACTIVE" : \(status \?\? ""\)/g,
  );
  assert.match(
    operations,
    /rawStatus === "ACTIVE"[\s\S]*?\["PENDING", "CONFIRMED", "READY_FOR_PICKUP", "SHIPPED"\]/,
  );
  assert.match(
    operations,
    /rawStatus === "ACTIVE"[\s\S]*?\["BOOKED", "CONFIRMED", "RESCHEDULED"\]/,
  );
  assert.doesNotMatch(operations, /rawStatus === "ALL"/);
});

test("operation lifecycle data and delivery attempts are durable", () => {
  assert.match(schema, /enum OrderStatus \{[\s\S]*?CONFIRMED/);
  assert.match(schema, /model AppointmentEvent/);
  assert.match(schema, /model OutboundMessage/);
  assert.match(schema, /model DeliveryAttempt/);
  assert.match(schema, /dedupeKey\s+String\?\s+@unique/);
  assert.match(actions, /where: \{ id, status: "PENDING" \}/);
  assert.match(actions, /status: "CONFIRMED", confirmedAt: new Date\(\)/);
  assert.match(actions, /status: "RESCHEDULED",\s*confirmedAt: null/);
  assert.match(actions, /reason\.length < 3/);
});

test("checkout retains notes, starts Stripe, and client rescheduling requires admin approval", () => {
  assert.match(checkout, /phone,\s*notes,\s*consentGdpr/);
  assert.match(checkout, /stripeClient\(\)\.checkout\.sessions\.create/);
  assert.match(checkout, /source: "WEBSITE_STRIPE"/);
  assert.match(reschedule, /appointmentChangeRequest\.create/);
  assert.match(reschedule, /status: change\.status/);
  assert.doesNotMatch(reschedule, /appointment\.update/);
  assert.match(changeRequests, /status: "APPROVED"/);
  assert.match(changeRequests, /status: "BOOKED"/);
  assert.match(changeRequests, /confirmedAt: null/);
  assert.match(changeRequests, /notifyAppointmentChange/);
});

test("international phone numbers normalize to E.164", () => {
  assert.equal(normalizeInternationalPhone("040 123 4567"), "+358401234567");
  assert.equal(
    normalizeInternationalPhone("+234 (807) 123-4567"),
    "+2348071234567",
  );
  assert.equal(normalizeInternationalPhone("001 202 555 0123"), "+12025550123");
  assert.equal(normalizeInternationalPhone("123"), null);
  assert.equal(normalizeInternationalPhone("testphone"), null);
  assert.equal(normalizeInternationalPhone("040 call 1234567"), null);
  assert.equal(normalizeInternationalPhone("040+1234567"), null);
});

test("automatic transactional SMS stays concise in every locale", () => {
  const appointment = {
    id: "appointment-abcdefgh",
    start: new Date("2026-07-20T10:00:00.000Z"),
    client: { fullName: "Ada Client" },
    procedureTitle: "Facial care",
  };
  const order = {
    id: "order-abcdefgh",
    total: 79,
    currency: "EUR",
  };
  for (const locale of ["fi", "en", "ru"] as const) {
    for (const message of [
      appointmentSms(appointment, locale, "confirmation", "Facial care"),
      appointmentSms(appointment, locale, "reminder_24h", "Facial care"),
      orderSms(order, locale, "confirmation"),
      orderSms(order, locale, "cancellation", "Unavailable"),
    ]) {
      assert.ok(smsSegments(message).segments <= 2, `${locale}: ${message}`);
      assert.match(message, /ABCDEFGH/);
      assert.doesNotMatch(message, /ada@example|notes/i);
    }
  }
});
