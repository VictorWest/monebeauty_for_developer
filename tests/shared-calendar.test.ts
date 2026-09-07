import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  availabilityCovers,
  applyAvailabilityRange,
  coveredAvailabilityStarts,
  generateStaffSlots,
  openSlotRange,
  workdaySlots,
  workingRangeForDate,
} from "../lib/staff-schedule";
import { clinicTimeFromInstant } from "../lib/clinic-time";

const calendar = readFileSync("components/calendar/SharedCalendar.tsx", "utf8");
const globalStyles = readFileSync("app/globals.css", "utf8");
const calendarApi = readFileSync("app/api/calendar/route.ts", "utf8");
const paletteEditor = readFileSync(
  "components/calendar/InternalServicePaletteEditor.tsx",
  "utf8",
);
const moveApi = readFileSync(
  "app/api/calendar/appointments/[id]/route.ts",
  "utf8",
);
const createApi = readFileSync(
  "app/api/calendar/appointments/route.ts",
  "utf8",
);
const staffScheduleApi = readFileSync(
  "app/api/staff/schedule/route.ts",
  "utf8",
);
const appointmentForm = readFileSync(
  "components/calendar/AppointmentForm.tsx",
  "utf8",
);
const migration = readFileSync(
  "prisma/migrations/20260719110000_shared_employee_calendar/migration.sql",
  "utf8",
);
const contactMigration = readFileSync(
  "prisma/migrations/20260721143000_appointment_contact_snapshots/migration.sql",
  "utf8",
);
const schema = readFileSync("prisma/schema.prisma", "utf8");

test("availability must cover the complete procedure without gaps", () => {
  const slots = [
    {
      start: "2026-07-20T10:00:00.000Z",
      end: "2026-07-20T10:30:00.000Z",
      status: "open",
    },
    {
      start: "2026-07-20T10:30:00.000Z",
      end: "2026-07-20T11:00:00.000Z",
      status: "open",
    },
  ];
  assert.equal(
    availabilityCovers(
      slots,
      new Date("2026-07-20T10:00:00.000Z"),
      new Date("2026-07-20T11:00:00.000Z"),
    ),
    true,
  );
  assert.equal(
    availabilityCovers(
      [slots[0], { ...slots[1], start: "2026-07-20T10:45:00.000Z" }],
      new Date("2026-07-20T10:00:00.000Z"),
      new Date("2026-07-20T11:00:00.000Z"),
    ),
    false,
  );
  assert.equal(
    availabilityCovers(
      [{ ...slots[0], status: "closed" }, slots[1]],
      new Date("2026-07-20T10:00:00.000Z"),
      new Date("2026-07-20T11:00:00.000Z"),
    ),
    false,
  );
});

test("candidate starts reuse merged coverage for the complete procedure", () => {
  const slots = workdaySlots("2026-08-03", 600, 720);
  assert.deepEqual(
    coveredAvailabilityStarts(slots, 60).map((date) =>
      clinicTimeFromInstant(date),
    ),
    ["10:00", "10:15", "10:30", "10:45", "11:00"],
  );
  assert.deepEqual(
    coveredAvailabilityStarts(
      slots.map((slot, index) =>
        index === 2 ? { ...slot, status: "closed" as const } : slot,
      ),
      60,
    ).map((date) => clinicTimeFromInstant(date)),
    ["10:45", "11:00"],
  );
});

test("availability range updates preserve other quarters", () => {
  const base = generateStaffSlots("2026-07-21", {
    openDays: [2],
    startHour: 10,
    endHour: 12,
    stepMin: 30,
  });
  const changed = applyAvailabilityRange(
    base,
    "2026-07-21",
    630,
    675,
    "closed",
  );
  assert.equal(changed.length, 8);
  assert.deepEqual(
    changed
      .filter((slot) => slot.status === "closed")
      .map((slot) => clinicTimeFromInstant(new Date(slot.start))),
    ["10:30", "10:45", "11:00"],
  );
  assert.equal(
    applyAvailabilityRange([], "2026-07-21", 600, 630, "open").length,
    2,
  );
});

test("working-hour helpers expose only configured dates and open slot bounds", () => {
  const hours = { openDays: [1], startHour: 10, endHour: 18, stepMin: 30 };
  assert.equal(generateStaffSlots("2026-07-20", hours).length, 16);
  assert.equal(generateStaffSlots("2026-07-21", hours).length, 0);
  assert.deepEqual(workingRangeForDate("2026-07-20", hours), {
    startMinute: 600,
    endMinute: 1080,
  });
  assert.deepEqual(
    openSlotRange([
      {
        start: "2026-07-20T07:30:00.000Z",
        end: "2026-07-20T08:00:00.000Z",
        status: "open",
      },
      {
        start: "2026-07-20T14:00:00.000Z",
        end: "2026-07-20T14:30:00.000Z",
        status: "open",
      },
      {
        start: "2026-07-20T06:00:00.000Z",
        end: "2026-07-20T06:30:00.000Z",
        status: "closed",
      },
    ]),
    { startMinute: 630, endMinute: 1050 },
  );
});

test("calendar exposes all-employee views and confirmed drag editing", () => {
  assert.match(calendar, /"day" \| "week" \| "month"/);
  assert.match(calendar, /data\.practitioners\.map/);
  assert.match(calendar, /DndContext/);
  assert.match(calendar, /DragOverlay/);
  assert.match(calendar, /handleDragStart/);
  assert.match(calendar, /Confirm calendar change/);
  assert.match(calendar, /appointment\.clientName/);
  assert.match(calendar, /appointment\.procedure/);
  assert.match(calendar, /appointment\.room\?\.name/);
  assert.match(calendar, /calendarWorkingBounds/);
  assert.match(calendar, /outsideAppointments/);
  assert.doesNotMatch(calendar, /const HOUR_START = 6/);
  assert.match(calendar, /grid-cols-\[128px_minmax\(0,1fr\)\]/);
  assert.match(calendar, /InternalServicePaletteEditor/);
  assert.match(calendar, /cell:\$\{day\}:\$\{practitioner\.id\}:\$\{minute\}/);
  assert.match(
    calendar,
    /calendarDropStart\(targetDate, Number\(targetMinuteRaw\)\)/,
  );
  assert.match(calendar, /startMinute: 10 \* 60/);
  assert.match(calendar, /endMinute: 19 \* 60/);
  assert.match(calendar, /transparent \$\{hourHeight - 1\}px/);
  assert.match(calendar, /border-0 bg-transparent/);
  assert.match(calendar, /isOver && "bg-accent\/20/);
  assert.match(calendar, /length: view === "day" \? 1 : 7/);
  assert.match(calendar, /lg:min-h-\[34px\]/);
  assert.match(calendar, /const employeeButtonCls =\s*"[^"]*min-h-\[34px\]/);
  assert.match(calendarApi, /dragLabel:/);
  assert.match(calendarApi, /dragLabels,/);
  assert.match(calendarApi, /defaultEnabled:/);
});

test("internal-service palette follows the active locale", () => {
  assert.match(paletteEditor, /template\?\.labels\[locale\]/);
  assert.match(paletteEditor, /item\.aliases\[locale\]/);
  assert.match(paletteEditor, /moveUp: "Siirrä ylös"/);
  assert.match(paletteEditor, /moveUp: "Переместить вверх"/);
  assert.doesNotMatch(paletteEditor, /template\?\.labels\.fi/);
  assert.match(calendar, /preference\.aliases\[locale\]/);
  assert.match(calendar, /mone-calendar-palette-v3/);
  assert.match(calendar, /mone-calendar-palette-v2/);
  assert.match(calendar, /shouldMigrate/);
});

test("calendar view persists independently for admin and staff", () => {
  assert.match(calendar, /mone-calendar-view:admin/);
  assert.match(calendar, /mone-calendar-view:staff/);
  assert.match(calendar, /localStorage\.getItem\(viewStorageKey\)/);
  assert.match(calendar, /localStorage\.setItem\(viewStorageKey, next\)/);
  assert.match(
    calendar,
    /value === "day" \|\| value === "week" \|\| value === "month"/,
  );
  assert.match(calendar, /if \(!viewReady\) return/);
  assert.match(calendar, /changeView\("day"\)/);
});

test("calendar primary actions keep a contrasting accent treatment", () => {
  const primaryButton = calendar.match(
    /const primaryButtonCls = cn\(([\s\S]*?)\);/,
  )?.[1];

  assert.ok(primaryButton);
  assert.match(primaryButton, /bg-accent/);
  assert.match(primaryButton, /text-page/);
  assert.doesNotMatch(primaryButton, /bg-card|text-body/);
  assert.ok(
    (calendar.match(/className=\{primaryButtonCls\}/g)?.length ?? 0) >= 3,
  );
});

test("calendar permissions give both back-office roles every employee", () => {
  assert.match(calendarApi, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.match(calendarApi, /const practitionerWhere = \{ active: true \}/);
  assert.match(calendarApi, /canManageAppointments: true/);
  assert.match(calendarApi, /canManageTemplates: true/);
  assert.match(calendarApi, /canEditAllAvailability: true/);
  assert.match(calendarApi, /canEditOwnAvailability/);
  assert.doesNotMatch(moveApi, /ownPractitionerId|forbidden_employee/);
  assert.doesNotMatch(createApi, /ownPractitionerId|forbidden_employee/);
  assert.match(moveApi, /service\.capabilities\.find/);
  assert.match(moveApi, /invalid_capability/);
});

test("staff can create confirmed appointments from a button or selected range", () => {
  assert.match(calendar, /t\.create/);
  assert.match(calendar, /finishRangeSelection/);
  assert.match(calendar, /setManaging\(\{/);
  assert.match(calendar, /durationMin/);
  assert.match(appointmentForm, /Search clients/);
  assert.match(appointmentForm, /Add a new client/);
  assert.match(appointmentForm, /function ClientCombobox/);
  assert.match(appointmentForm, /new AbortController\(\)/);
  assert.match(appointmentForm, /}, 300\)/);
  assert.match(appointmentForm, /initialClients/);
  assert.match(appointmentForm, /event\.key === "Backspace"/);
  assert.match(appointmentForm, /contact: client/);
  assert.doesNotMatch(appointmentForm, /\{newClient \? \(/);
  assert.doesNotMatch(appointmentForm, /searchAction/);
  assert.match(createApi, /fullName: \{ contains: q/);
  assert.match(createApi, /email: \{ contains: q/);
  assert.match(createApi, /phone: \{ contains: q \}/);
  assert.match(createApi, /status: "CONFIRMED"/);
  assert.match(createApi, /channel: "staff"/);
  assert.match(createApi, /notifyAppointmentConfirmation/);
  assert.match(createApi, /gdpr_booking_staff/);
});

test("appointments preserve editable booking contact snapshots", () => {
  assert.match(schema, /contactName\s+String/);
  assert.match(schema, /contactEmail\s+String/);
  assert.match(schema, /contactPhone\s+String/);
  assert.match(contactMigration, /UPDATE "Appointment" AS appointment/);
  assert.match(contactMigration, /ALTER COLUMN "contactName" SET NOT NULL/);
  assert.match(createApi, /contactName: fullName/);
  assert.match(createApi, /q\.length === 0 \|\| q\.length >= 2/);
  assert.match(moveApi, /contactChanged/);
});

test("day and week open appointments from one continuous vertical range", () => {
  assert.match(calendar, /overflow-x-auto overflow-y-hidden/);
  assert.match(calendar, /calendar-time-grid grid/);
  assert.match(calendar, /"--calendar-column-count": Math\.max/);
  assert.doesNotMatch(calendar, /minmax\(190px, 1fr\)/);
  assert.match(
    globalStyles,
    /@media \(min-width: 1280px\)[\s\S]*?\.calendar-time-grid[\s\S]*?minmax\(0, 1fr\)/,
  );
  assert.match(globalStyles, /minmax\(150px, 1fr\)/);
  assert.match(calendar, /TIME_GRID_EDGE_PADDING = 12/);
  assert.match(
    calendar,
    /height: timelineHeight \+ TIME_GRID_EDGE_PADDING \* 2/,
  );
  assert.match(calendar, /normalizeCalendarRange/);
  assert.match(calendar, /data-calendar-range-selection="true"/);
  assert.match(calendar, /bg-\[#ded4c7\]/);
  assert.doesNotMatch(calendar, /applyRangeAction/);
  assert.doesNotMatch(calendar, /chooseRangeAction/);
});

test("day and week columns share employee and end-of-day separators", () => {
  assert.match(
    calendar,
    /separatorClass: calendarColumnSeparator\(orderedColumns, columnIndex\)/,
  );
  assert.match(
    calendar,
    /calendarColumnSeparator\([\s\S]*?"border-r-2 border-line-btn-hover"[\s\S]*?"border-r border-line-btn"/,
  );
  assert.match(
    calendar,
    /columns\.map\(\(\{ day, practitioner, separatorClass \}\) => \([\s\S]*?className=\{cn\([\s\S]*?separatorClass/,
  );
  assert.match(
    calendar,
    /columns\.map\([\s\S]*?\(\{ day, practitioner, separatorClass \}, columnIndex\)[\s\S]*?<CalendarColumn[\s\S]*?separatorClass=\{separatorClass\}/,
  );
  assert.match(
    calendar,
    /function CalendarColumn\(\{[\s\S]*?separatorClass[\s\S]*?className=\{cn\("relative bg-card", separatorClass\)\}/,
  );
});

test("mobile week fits grouped days and compact employees into one grid", () => {
  assert.match(
    globalStyles,
    /\.calendar-time-grid \{\s*width: 100%;\s*min-width: 100%;[\s\S]*?40px repeat\(\s*var\(--calendar-column-count\),\s*minmax\(0, 1fr\)\s*\)/,
  );
  assert.match(
    globalStyles,
    /@media \(min-width: 768px\)[\s\S]*?min-width: max-content;[\s\S]*?minmax\(150px, 1fr\)/,
  );
  assert.match(calendar, /key=\{`mobile-day:\$\{ymd\(day\)\}`\}/);
  assert.match(
    calendar,
    /gridColumn: `span \$\{Math\.max\(1, practitioners\.length\)\}`/,
  );
  assert.match(calendar, /key=\{`mobile-employee:/);
  assert.match(calendar, /initials\(practitioner\.name\)\.slice\(0, 1\)/);
  assert.match(calendar, /className="hidden md:block"/);
  assert.match(calendar, /compactWeek=\{view === "week"\}/);
  assert.match(calendar, /writingMode: "vertical-rl"/);
  assert.match(calendar, /left-0 border-r-2 border-line-btn-hover/);
  assert.match(calendar, /right-0 border-l-2 border-line-btn-hover/);
});

test("month dates remain navigable without availability or events", () => {
  const monthView = calendar.slice(calendar.indexOf("function MonthView"));
  assert.doesNotMatch(monthView, /disabled=\{!working/);
  assert.match(monthView, /onClick=\{\(\) => onOpenDay\(date\)\}/);
});

test("workday controls replace quarter-slot availability editing", () => {
  assert.match(calendar, /MagnifyingGlassMinus/);
  assert.match(calendar, /MagnifyingGlassPlus/);
  assert.match(calendar, /role="tooltip"/);
  assert.match(calendar, /openWorkdayEditor\("add"\)/);
  assert.match(calendar, /openWorkdayEditor\("remove"\)/);
  assert.match(calendar, /disableClosedDays=\{false\}/);
  assert.doesNotMatch(calendar, /openAvailabilityEditor/);
  assert.doesNotMatch(calendar, /Open \/ closed times/);
  assert.match(calendarApi, /canEditOwnAvailability/);
  assert.match(staffScheduleApi, /action === "add_workday"/);
  assert.match(staffScheduleApi, /action === "remove_workday"/);
  assert.match(staffScheduleApi, /appointments_conflict/);
  assert.match(staffScheduleApi, /lockReservationKeys/);
  assert.doesNotMatch(staffScheduleApi, /workday_mutation_denied/);
  assert.match(staffScheduleApi, /workday_added/);
  assert.match(staffScheduleApi, /workday_removed/);
});

test("workday slots replace one date with exact quarter-hour availability", () => {
  const slots = workdaySlots("2026-07-23", 9 * 60, 17 * 60);
  assert.equal(slots.length, 32);
  assert.equal(slots[0]?.start, "2026-07-23T06:00:00.000Z");
  assert.equal(slots.at(-1)?.end, "2026-07-23T14:00:00.000Z");
  assert.ok(slots.every((slot) => slot.status === "open"));
  assert.deepEqual(workdaySlots("2026-07-23", 541, 17 * 60), []);
});

test("database rejects employee, room, and device overlaps", () => {
  assert.match(migration, /Appointment_employee_no_overlap/);
  assert.match(migration, /Appointment_room_no_overlap/);
  assert.match(migration, /Appointment_device_no_overlap/);
  assert.match(migration, /tsrange\("start", "end", '\[\)'\)/);
  assert.match(migration, /CREATE EXTENSION IF NOT EXISTS btree_gist/);
});

test("time and employee moves are audited and notify the client", () => {
  assert.match(moveApi, /CALENDAR_UPDATED/);
  assert.match(moveApi, /appointment_calendar_updated/);
  assert.match(moveApi, /scheduleChanged/);
  assert.match(moveApi, /notifyAppointmentChange/);
});
