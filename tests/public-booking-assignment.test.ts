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
    /function pickOption[\s\S]*?loadAvailableDates\(serviceKey, \[option\.key\], "any"\)/,
  );
  assert.match(
    wizard,
    /function pickDate[\s\S]*?loadSpecialistsForDate\(\s*service,\s*activeOptionKeys,\s*value,\s*specialistId \?\? initialSpecialistId,?\s*\)/,
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

test("the URL is the single source of truth for how far into the wizard the client is", () => {
  assert.match(wizard, /import { useSearchParams } from "next\/navigation"/);
  assert.match(wizard, /const searchParams = useSearchParams\(\);/);
  assert.match(wizard, /const didSyncOnce = useRef\(false\);/);
  assert.match(wizard, /const isFirstRun = !didSyncOnce\.current;/);
  // A deep link (or a fresh mount) resolves union-of-specialists date
  // availability even though seeded state already matches the URL. A
  // multi-procedure cart's `options` param resolves to the same optionKeys
  // array as a single `option` — see the multi-procedure booking test file.
  assert.match(
    wizard,
    /void loadAvailableDates\(urlService, optionKeys, "any"\);/,
  );
  // Landing on a URL that already names a date resolves the specialist step
  // (or skips straight past it) the same way a manual date pick does.
  assert.match(
    wizard,
    /void loadSpecialistsForDate\(\s*urlService,\s*optionKeys,\s*urlDate,\s*urlSpecialist \?\? undefined,\s*\)/,
  );
  assert.match(wizard, /slotsDegraded[\s\S]*?<FallbackBlock/);
});

test("browser Back/Forward gets real history entries instead of jumping to the homepage", () => {
  assert.match(wizard, /function pickService[\s\S]*?router\.push\(/);
  assert.match(wizard, /function pickOption[\s\S]*?router\.push\(/);
  assert.match(wizard, /function pickDate[\s\S]*?router\.push\(/);
  assert.match(wizard, /function pickSpecialist[\s\S]*?router\.push\(/);
  // pickDate's own push already carries the date; picking one specialist for
  // a date that only had one is a resolution of that same pick, not a new
  // user-visible step, so it fills in the same history entry instead.
  assert.match(
    wizard,
    /if \(selected\.id !== preferredId\)[\s\S]*?router\.replace\(/,
  );
  // Every pick* call sets state directly, so the resync effect below must
  // not re-run its own fetches as an echo of those same navigations. A
  // multi-procedure cart's joined key stands in for the single `option` in
  // this comparison — see the multi-procedure booking test file.
  assert.match(
    wizard,
    /urlService === service &&\s*urlOptionKey === \(activeOptionKey \|\| null\) &&\s*urlDate === date &&\s*urlSpecialist === \(specialistId \?\? null\)/,
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

test("a multi-procedure cart's options param is additive, not a replacement, on every booking GET/POST route", () => {
  // Availability, slots, and specialists all keep working for the existing
  // single-`option` callers untouched, and only branch to the group
  // functions when `options` names more than one procedure.
  assert.match(availabilityRoute, /openPublicGroupDates/);
  assert.match(availabilityRoute, /optionKeys && optionKeys\.length > 1/);
  assert.match(availabilityRoute, /await openPublicDates\(\{/);

  assert.match(slotsRoute, /openGroupSlots/);
  assert.match(slotsRoute, /optionKeys && optionKeys\.length > 1/);
  assert.match(slotsRoute, /await openPublicSlots\(\{/);

  assert.match(specialistsRoute, /qualifiedSpecialistsForGroupDate/);
  assert.match(specialistsRoute, /optionKeys && optionKeys\.length > 1/);

  const resolveSpecialistRoute = readFileSync(
    "app/api/booking/resolve-specialist/route.ts",
    "utf8",
  );
  assert.match(resolveSpecialistRoute, /resolveAnySpecialistForGroup/);
  assert.match(
    resolveSpecialistRoute,
    /Array\.isArray\(payload\.options\)/,
  );
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
