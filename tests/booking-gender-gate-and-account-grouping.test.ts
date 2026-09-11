import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync("components/booking/BookingWizard.tsx", "utf8");
const accountPage = readFileSync(
  "app/(public)/[locale]/oma-tili/page.tsx",
  "utf8",
);

test("the Women/Men gender gate is asked on every entry into booking, including a 'Book now' deep link into a specific service", () => {
  // The old bypass ("&& !initialService") let a deep-linked service skip
  // straight past the gate; it must be gone.
  assert.doesNotMatch(wizard, /if \(!gender && !initialService\)/);
  assert.match(wizard, /if \(!gender\) \{/);
  // The preselected service/procedure/cart from the deep link is untouched
  // by this — it's resolved into state well before the gender check.
  assert.match(
    wizard,
    /const initialHasOptions = \(initialContext\?\.service\.options\.length \?\? 0\) > 1;/,
  );
});

test("the account's Manage My Booking list groups a multi-procedure visit's appointments back into one card", () => {
  assert.match(accountPage, /function groupAppointments</);
  assert.match(
    accountPage,
    /const key = appointment\.bookingGroupId \?\? appointment\.id;/,
  );
  // Grouped, then paginated as visits, not as individual procedure rows.
  assert.match(accountPage, /const upcomingGroups = groupAppointments\(upcoming\);/);
  assert.match(accountPage, /const previousGroups = groupAppointments\(previous\);/);
  assert.match(accountPage, /const allGroups = \[\.\.\.upcomingGroups, \.\.\.previousGroups\];/);
  assert.match(accountPage, /count=\{allGroups\.length\}/);
  // The summary card lists every procedure in the group, not just the first.
  assert.match(
    accountPage,
    /group: AppointmentSummaryData\[\];/,
  );
  assert.match(
    accountPage,
    /const title = grouped\s*\n\s*\? group\.map\(procedureTitle\)\.join\(" \+ "\)/,
  );
  // Each leg still gets its own independent reschedule/cancel action —
  // multi-procedure manage stays per-procedure, matching the booking plan.
  assert.match(
    accountPage,
    /group\.map\(\(appointment, index\) => \{[\s\S]*?<ChangeRequestForm[\s\S]*?appointmentId=\{appointment\.id\}/,
  );
});
