import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const bookingRoute = readFileSync("app/api/booking/route.ts", "utf8");
const bookingContext = readFileSync("lib/booking-context.ts", "utf8");
const bookingWizard = readFileSync(
  "components/booking/BookingWizard.tsx",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("multiProcedureBooking is a per-service opt-in, off by default, threaded to both booking-context builders", () => {
  assert.match(
    schema,
    /multiProcedureBooking Boolean\s+@default\(false\)/,
  );
  assert.match(bookingContext, /multiProcedureBooking: boolean;/);
  // Both getBookingServiceOptions and getBookingContext return it on their
  // `service` object, not just one of the two builders.
  assert.equal(
    bookingContext.split("multiProcedureBooking: service.multiProcedureBooking,").length - 1,
    2,
  );
});

test("the wizard only shows the cart toggle for opted-in services, and a cart of one behaves like a normal single pick", () => {
  assert.match(
    bookingWizard,
    /selectedService\.multiProcedureBooking\s*\n\s*\? selectedService\.options\.map/,
  );
  assert.match(bookingWizard, /function toggleCartOption\(/);
  assert.match(
    bookingWizard,
    /if \(cart\.length === 1\) \{[\s\S]*?pickOption\(serviceKey, only\);/,
  );
  assert.match(bookingWizard, /current\.length >= MAX_GROUP_PROCEDURES/);
});

test("a multi-procedure cart branches to its own handler before touching the single-procedure path", () => {
  assert.match(
    bookingRoute,
    /const groupOptionKeys = Array\.isArray\(payload\.options\)/,
  );
  assert.match(
    bookingRoute,
    /if \(groupOptionKeys && groupOptionKeys\.length > 1\)\s*\n\s*return createGroupBooking\(payload, groupOptionKeys\);/,
  );
  // The branch check happens before any single-procedure parsing/lookup.
  assert.ok(
    bookingRoute.indexOf("return createGroupBooking(payload, groupOptionKeys)") <
      bookingRoute.indexOf('const service = String(payload.service ?? "");\n  const optionKey'),
  );
});

test("group creation requires the service opt-in flag, rejects duplicate/miscounted/over-cap option keys", () => {
  assert.match(bookingRoute, /multiProcedureBooking: true,/);
  assert.match(
    bookingRoute,
    /uniqueKeys\.length !== optionKeys\.length \|\|\s*\n\s*optionKeys\.length < 2 \|\|\s*\n\s*optionKeys\.length > MAX_GROUP_PROCEDURES/,
  );
  assert.match(
    bookingRoute,
    /if \(svc\.options\.length !== optionKeys\.length\) return bad\("invalid_option"\);/,
  );
});

test("every leg is locked and revalidated inside the same serializable transaction used for single bookings", () => {
  const group = bookingRoute.slice(
    bookingRoute.indexOf("async function createGroupBooking"),
    bookingRoute.indexOf("export async function POST"),
  );
  assert.match(group, /openPublicGroupSlotCandidates\(/);
  assert.match(
    group,
    /for \(let index = 0; index < matchingGroup\.legs\.length; index \+= 1\) \{/,
  );
  assert.match(group, /lockAndFindReservationConflict\(tx, \{/);
  assert.match(
    group,
    /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/,
  );
});

test("only the last leg carries the real buffer; every leg shares one bookingGroupId and its own sequence index", () => {
  const group = bookingRoute.slice(
    bookingRoute.indexOf("async function createGroupBooking"),
    bookingRoute.indexOf("export async function POST"),
  );
  assert.match(group, /const bookingGroupId = crypto\.randomUUID\(\);/);
  assert.match(
    group,
    /bufferMinutes: isLast \? APPOINTMENT_BUFFER_MINUTES : 0,/,
  );
  assert.match(
    group,
    /reservedUntil: isLast\s*\n\s*\? new Date\(legEnd\.getTime\(\) \+ APPOINTMENT_BUFFER_MINUTES \* 60_000\)\s*\n\s*: legEnd,/,
  );
  assert.match(group, /bookingGroupId,\s*\n\s*bookingGroupIndex: index,\s*\n\s*bookingGroupCount: resolvedOptions\.length,/);
  // Every appointment gets its own gdpr/procedure consent pair — consent
  // attaches per appointment record, same as the single-procedure path.
  assert.match(
    group,
    /created\.flatMap\(\(appointment\) => \[\s*\n\s*\{\s*\n\s*clientId: client\.id,\s*\n\s*appointmentId: appointment\.id,\s*\n\s*type: "gdpr_booking",/,
  );
});

test("the group response includes every created procedure with its own manage link, and sends one combined receipt", () => {
  const group = bookingRoute.slice(
    bookingRoute.indexOf("async function createGroupBooking"),
    bookingRoute.indexOf("export async function POST"),
  );
  assert.match(group, /notifyAppointmentGroupReceipt\(/);
  assert.match(
    group,
    /procedures: appointments\.map\(\(appointment, index\) => \(\{/,
  );
  assert.match(group, /manageUrl: appointmentManageUrl\(appointment\.id, locale\),/);
  // Same error taxonomy as the single-procedure path (slot_taken,
  // consultation_*, procedure_consent_stale) so the wizard's existing
  // error handling works unmodified for both.
  assert.match(group, /error\.message === "slot_taken"/);
  assert.match(group, /error\.message === "procedure_consent_stale"/);
});
