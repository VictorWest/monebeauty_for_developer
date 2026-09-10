import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const wizard = readFileSync("components/booking/BookingWizard.tsx", "utf8");
const bookingRoute = readFileSync("app/api/booking/route.ts", "utf8");
const slotsRoute = readFileSync("app/api/booking/slots/route.ts", "utf8");
const availabilityRoute = readFileSync(
  "app/api/booking/availability/route.ts",
  "utf8",
);
const bookingLib = readFileSync("lib/booking.ts", "utf8");
const rescheduleRoute = readFileSync(
  "app/api/booking/reschedule/route.ts",
  "utf8",
);
const changeRequests = readFileSync("lib/change-request-actions.ts", "utf8");
const specialistsRoute = readFileSync(
  "app/api/booking/specialists/route.ts",
  "utf8",
);
const specialistLib = readFileSync("lib/booking-specialists.ts", "utf8");

test("the public wizard is Procedure -> Date -> Specialist -> Time -> You", () => {
  assert.match(wizard, /type Step = 1 \| 2 \| 3 \| 4 \| 5;/);
  assert.match(
    wizard,
    /t\("steps\.service"\),\s*t\("steps\.date"\),\s*t\("steps\.specialist"\),\s*t\("steps\.time"\),\s*t\("steps\.you"\)/,
  );
  assert.match(wizard, /api\/booking\/specialists/);
  assert.match(wizard, /useState<Step>\(initialOption \? 2 : 1\)/);
  assert.match(wizard, /function pickService[\s\S]*?setStep\(1\)/);
  assert.match(wizard, /function pickOption[\s\S]*?setStep\(2\)/);
  assert.match(wizard, /function pickDate[\s\S]*?setStep\(3\)/);
  assert.match(wizard, /function pickSpecialist[\s\S]*?setStep\(4\)/);
  assert.match(wizard, /function pickSlot[\s\S]*?setStep\(5\)/);
});

test("the specialist step is filtered to who is actually working on the selected date", () => {
  assert.match(
    wizard,
    /function pickOption[\s\S]*?loadAvailableDates\(serviceKey, option\.key, "any"\)/,
  );
  assert.match(
    wizard,
    /function pickDate[\s\S]*?loadSpecialistsForDate\(\s*service,\s*procedure\.key,\s*value,\s*specialistId \?\? initialSpecialistId,?\s*\)/,
  );
  assert.match(
    specialistsRoute,
    /qualifiedSpecialistsForDate/,
  );
  assert.match(specialistsRoute, /searchParams\.get\("date"\)/);
  assert.match(bookingLib, /export async function qualifiedSpecialistsForDate/);
  assert.match(
    bookingLib,
    /qualifiedSpecialistsForDate[\s\S]*?collectSlotCandidates/,
  );
});

test("deep links resolve union-of-specialists date availability up front", () => {
  assert.match(
    wizard,
    /if \(!initialService \|\| !initialOptionKey\) return;[\s\S]*?loadAvailableDates\(initialService, initialOptionKey, "any"\)/,
  );
  assert.match(wizard, /slotsDegraded[\s\S]*?<FallbackBlock/);
});

test("deep-linked specialist initialization is stable across refreshed props", () => {
  assert.match(wizard, /const initialOptionKey = initialOption\?\.key/);
  assert.match(wizard, /const procedureKey = procedure\?\.key/);
  assert.match(wizard, /const specialistId = specialist\?\.id/);
  assert.match(wizard, /if \(selected\.id !== preferredId\)/);
  assert.match(
    wizard,
    /if \(datesSelectionKey\.current === selectionKey\) return/,
  );
  assert.match(
    wizard,
    /datesSelectionKey\.current = `\$\{svc\}:\$\{option\}`/,
  );
  assert.match(
    wizard,
    /\[\s*initialOptionKey,\s*initialService,\s*loadAvailableDates\s*\]/,
  );
  assert.doesNotMatch(
    wizard,
    /\[loadAvailableDates, procedure, service, specialist\]/,
  );
});

test("selected specialist is public while resource details stay internal", () => {
  const completedConfirmation = wizard.slice(
    wizard.indexOf("if (confirmation)"),
    wizard.indexOf("const stepLabels"),
  );
  const publicSteps = wizard.slice(
    wizard.indexOf("const stepLabels"),
    wizard.indexOf("const inputCls"),
  );
  assert.match(completedConfirmation, /summary\.specialist/);
  assert.match(publicSteps, /summary\.specialist/);
  assert.doesNotMatch(publicSteps, /roomId|deviceId/);
});

test("public booking APIs require and revalidate forged specialist values", () => {
  assert.match(bookingRoute, /openPublicSlotCandidates/);
  assert.match(slotsRoute, /openPublicSlots/);
  assert.match(bookingRoute, /payload\.specialistId/);
  assert.match(slotsRoute, /searchParams\.get\("specialist"\)/);
  assert.match(bookingRoute, /practitionerId: matchingSlot\.practitionerId/);
  assert.match(specialistsRoute, /qualifiedSpecialistsForDate/);
  assert.match(
    specialistLib,
    /PractitionerServiceOptionQualification|qualifications/,
  );
  assert.match(specialistsRoute, /specialists:/);
  assert.doesNotMatch(specialistsRoute, /roomId|deviceId|capacity/);
});

test("the ordered qualified roster and exclusive resources control availability", () => {
  assert.match(bookingLib, /capabilities: \{/);
  assert.match(bookingLib, /displayOrder: "asc"/);
  assert.match(bookingLib, /for \(const capability of completeCapabilities\)/);
  assert.match(bookingLib, /if \(seen\.has\(slot\.start\)\) return false/);
  assert.match(bookingLib, /!completeCapabilities\.length/);
  assert.match(bookingLib, /record\.svc\.requiresDevice/);
  assert.match(bookingLib, /const room = capability\.room/);
  assert.match(bookingLib, /for \(const device of freeDevices\)/);
  assert.match(bookingLib, /appointment\.deviceId !== device\.id/);
  assert.match(rescheduleRoute, /openSlots/);
  assert.match(rescheduleRoute, /appointmentChangeRequest\.create/);
  assert.match(changeRequests, /practitionerId: matching\.practitionerId/);
  assert.match(changeRequests, /roomId: matching\.roomId/);
  assert.match(changeRequests, /deviceId: matching\.deviceId/);
  assert.match(bookingRoute, /candidate\.practitionerId === specialistId/);
  assert.match(bookingRoute, /lockAndFindReservationConflict/);
});

test("public date pickers receive batched resource-safe working dates", () => {
  assert.match(bookingLib, /openPublicDates/);
  assert.match(
    bookingLib,
    /collectSlotCandidates\(\{\s*dates,\s*serviceKey,\s*locale,\s*optionKey,\s*specialistId,\s*\}\)/,
  );
  assert.match(bookingLib, /Promise\.all\(\[/);
  assert.match(bookingLib, /db\.availability\.findMany/);
  assert.match(bookingLib, /db\.appointment\.findMany/);
  assert.match(bookingLib, /db\.calendarBlock\.findMany/);
  assert.match(bookingLib, /startsByPractitionerDate/);
  assert.match(bookingLib, /coveredAvailabilityStarts/);
  assert.match(bookingLib, /let candidateIndex = 0/);
  assert.match(bookingLib, /candidateTimes\[candidateIndex\]/);
  assert.doesNotMatch(
    bookingLib,
    /candidates\.some\(\(slot\) => \{\s*const bounds = clinicDateBounds/,
  );
  assert.match(availabilityRoute, /62 \* 86400000/);
  assert.match(wizard, /api\/booking\/availability/);
  assert.match(wizard, /availableDates=\{/);
});

test("public availability refreshes live without exposing capacity", () => {
  assert.match(wizard, /window\.setInterval\(refresh, 30_000\)/);
  assert.match(wizard, /window\.addEventListener\("focus", onFocus\)/);
  assert.match(wizard, /document\.hidden/);
  assert.match(wizard, /cache: "no-store"/);
  assert.match(wizard, /slotsRequest\.current\?\.abort\(\)/);
  assert.match(wizard, /!nextSlots\.some/);
  assert.match(wizard, /t\("errors\.slotTaken"\)/);
  assert.match(
    wizard,
    /datesRequest\.current === controller[\s\S]*?setDatesLoading\(false\)/,
  );
  assert.match(slotsRoute, /Cache-Control.*private, no-store/);
  assert.match(availabilityRoute, /Cache-Control.*private, no-store/);
  assert.doesNotMatch(wizard, /remainingCapacity|capacityCount/);
});

test("public booking distinguishes date loading, empty, and degraded states", () => {
  assert.match(wizard, /datesLoading/);
  assert.match(wizard, /datesDegraded/);
  assert.match(wizard, /availableDates\?\.length === 0/);
  assert.match(wizard, /t\("loadingDates"\)/);
  assert.match(wizard, /t\("noDates"\)/);
  assert.match(wizard, /datesDegraded[\s\S]*?<FallbackBlock/);
  assert.match(wizard, /loading=\{datesLoading\}/);
});
