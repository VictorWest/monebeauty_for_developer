import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const booking = readFileSync("lib/booking.ts", "utf8");
const bookingConfig = readFileSync("lib/booking-config.ts", "utf8");

test("a multi-procedure cart is capped and rejects single-option calls", () => {
  // Defined in the client-safe config file (no Prisma import) so the wizard's
  // cart toggle can share the same cap without pulling in lib/booking.ts.
  assert.match(bookingConfig, /export const MAX_GROUP_PROCEDURES = 6;/);
  assert.match(booking, /export \{ BUSINESS_HOURS, MAX_GROUP_PROCEDURES \};/);
  assert.match(
    booking,
    /if \(optionKeys\.length < 2 \|\| optionKeys\.length > MAX_GROUP_PROCEDURES\)\s*\n\s*return \[\];/,
  );
});

test("group eligibility requires qualification and capability on every selected leg", () => {
  assert.match(
    booking,
    /async function resolveGroupLegs\([\s\S]*?for \(const optionKey of optionKeys\)/,
  );
  assert.match(
    booking,
    /if \(specialistId\) \{[\s\S]*?qualifiedSpecialists\(\s*\{ serviceKey, optionKey, locale \},/,
  );
  assert.match(booking, /if \(!completeCapabilities\.length\) return null;/);
  assert.match(
    booking,
    /legs\s*\n\s*\.map\(\(leg\) => new Set\(leg\.practitioners\.keys\(\)\)\)\s*\n\s*\.reduce\(\(eligible, ids\) => new Set\(\[\.\.\.eligible\]\.filter\(\(id\) => ids\.has\(id\)\)\)\),/,
  );
});

test("the combined block is sized to the summed duration plus one trailing buffer", () => {
  assert.match(
    booking,
    /const totalDuration = legs\.reduce\(\(sum, leg\) => sum \+ leg\.duration, 0\);/,
  );
  assert.match(
    booking,
    /candidateAvailability\(\s*dateStr,\s*totalDuration \+ APPOINTMENT_BUFFER_MINUTES,/,
  );
  // Only the whole block's end carries the buffer; each leg's own interval
  // inside it is exactly its own duration, not duration+buffer.
  assert.match(
    booking,
    /const legEnd = new Date\(cursor\.getTime\(\) \+ leg\.duration \* 60_000\);/,
  );
});

test("per-leg device checks are scoped to that leg's own sub-interval, including against earlier legs in the same block", () => {
  assert.match(
    booking,
    /if \(leg\.requiresDevice\) \{[\s\S]*?const freeDevice = info\.deviceIds\.find\(/,
  );
  assert.match(
    booking,
    /!overlaps\(\s*cursor,\s*legEnd,\s*appointment\.start,\s*appointment\.reservedUntil \?\? appointment\.end,\s*\)/,
  );
  // A device claimed by an earlier leg in the same block must not be handed
  // to a later leg that overlaps it in time.
  assert.match(
    booking,
    /!resolvedLegs\.some\(\s*\(done\) =>\s*done\.deviceId === id &&\s*overlaps\(/,
  );
});

test("group scheduling reuses the same conflict-fetching and overlap machinery as single-option booking", () => {
  assert.match(booking, /async function fetchBookingConflicts\(/);
  assert.match(
    booking,
    /const \{ booked, blocked, overrides \} = await fetchBookingConflicts\(db, \{/,
  );
  // Both collectSlotCandidates and collectGroupSlotCandidates call it — the
  // single-option path was refactored to use the same helper, not duplicate it.
  assert.equal(
    booking.split("await fetchBookingConflicts(db,").length - 1,
    2,
  );
});

test("public group wrappers mirror the single-option wrappers one for one", () => {
  for (const fn of [
    "openGroupSlots",
    "openPublicGroupSlotCandidates",
    "qualifiedSpecialistsForGroupDate",
    "openPublicGroupDates",
    "resolveAnySpecialistForGroup",
  ]) {
    assert.match(booking, new RegExp(`export async function ${fn}\\(`));
  }
  // qualifiedSpecialistsForGroupDate intersects every leg's qualified roster,
  // it doesn't just reuse the first leg's list.
  assert.match(
    booking,
    /qualifiedEveryLeg = \(first \?\? \[\]\)\.filter\(\(specialist\) =>\s*\n\s*rest\.every\(\(list\) => list\.some\(\(item\) => item\.id === specialist\.id\)\),\s*\n\s*\);/,
  );
});

test("resolveAnySpecialistForGroup keeps the same compact-then-workload-balance priority as resolveAnySpecialist", () => {
  const group = booking.slice(
    booking.indexOf("export async function resolveAnySpecialistForGroup"),
  );
  assert.match(group, /if \(eligible\.length === 1\) return eligible\[0\];/);
  assert.match(
    group,
    /const withAppointmentsToday = eligible\.filter\(\s*\n\s*\(item\) => \(busyToday\.get\(item\.practitionerId\) \?\? 0\) > 0,/,
  );
  assert.match(
    group,
    /const pool = withAppointmentsToday\.length \? withAppointmentsToday : eligible;/,
  );
});
