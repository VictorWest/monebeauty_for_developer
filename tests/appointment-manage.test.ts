import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const actions = readFileSync("lib/appointment-manage-actions.ts", "utf8");
const page = readFileSync(
  "app/(public)/[locale]/ajanvaraus/hallinta/page.tsx",
  "utf8",
);
const component = readFileSync(
  "components/booking/ManageAppointment.tsx",
  "utf8",
);
const robots = readFileSync("app/robots.ts", "utf8");
const bookingRoute = readFileSync("app/api/booking/route.ts", "utf8");

test("the manage link authenticates with its signed token, never a session", () => {
  assert.match(actions, /validAppointmentManageToken\(id, token\)/);
  assert.match(page, /validAppointmentManageToken\(id, token\)/);
  // A guest who booked without an account must not be pushed through a login.
  assert.doesNotMatch(actions, /currentUser|requireApiUser/);
  assert.doesNotMatch(page, /currentUser|requireApiUser/);
});

test("cancelled, completed, and past appointments are not editable through the link", () => {
  assert.match(actions, /appointment\.start <= new Date\(\)/);
  assert.match(
    actions,
    /appointment\.status === "CANCELLED" \|\| appointment\.status === "COMPLETED"/,
  );
  assert.match(page, /const past = appointment\.start <= new Date\(\)/);
  assert.match(
    page,
    /const editable = !cancelled && !past && appointment\.status !== "COMPLETED"/,
  );
});

test("client cancellations and reschedules apply immediately and are audited", () => {
  assert.match(actions, /status: "CANCELLED"[\s\S]*?cancelledAt: new Date\(\)/);
  assert.match(actions, /kind: "CANCELLED",\s*actor: "client"/);
  assert.match(actions, /kind: "RESCHEDULED",\s*actor: "client"/);
  assert.match(actions, /action: "appointment_cancelled_by_client"/);
  assert.match(actions, /action: "appointment_rescheduled_by_client"/);
  // Both changes reach the client and the clinic through the existing notification path.
  assert.match(
    actions,
    /notifyAppointmentChange\(\s*cancelled,\s*"cancellation"/,
  );
  assert.match(
    actions,
    /notifyAppointmentChange\(\s*rescheduled,\s*"rescheduled"/,
  );
  // No pending-approval indirection: the change request queue is not involved.
  assert.doesNotMatch(actions, /appointmentChangeRequest/);
});

test("a self-service reschedule re-checks availability under a reservation lock", () => {
  assert.match(actions, /openPublicSlotCandidates\(/);
  assert.match(
    actions,
    /lockAndFindReservationConflict\(tx, \{[\s\S]*?excludeAppointmentId: appointment\.id/,
  );
  assert.match(actions, /throw new Error\("slot_taken"\)/);
  assert.match(actions, /error: "slot_taken"/);
});

test("the manage page stays out of search results and offers both actions", () => {
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(robots, /"\/ajanvaraus\/hallinta"/);
  assert.match(robots, /"\/en\/ajanvaraus\/hallinta"/);
  assert.match(robots, /"\/ru\/ajanvaraus\/hallinta"/);
  assert.match(component, /cancelAppointmentByTokenAction/);
  assert.match(component, /rescheduleAppointmentByTokenAction/);
  // The cancellation policy has to be visible before the client commits.
  assert.match(page, /cancellationPolicyText\(locale\)/);
  assert.match(page, /CANCELLATION_POLICY_ANCHOR/);
});

test("booking returns the manage link so the wizard does not wait on email", () => {
  assert.match(
    bookingRoute,
    /manageUrl: appointmentManageUrl\(appointment\.id, locale\)/,
  );
  // The standalone English-only claim email is gone; the link rides in the localized email.
  assert.doesNotMatch(bookingRoute, /add appointment to your account/);
  assert.match(bookingRoute, /createAppointmentClaimUrl\(/);
});
