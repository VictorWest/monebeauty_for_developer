import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { filterCalendarAssignments } from "../lib/calendar-assignments";

const assignmentApi = readFileSync(
  "app/api/calendar/assignments/route.ts",
  "utf8",
);
const assignmentService = readFileSync("lib/calendar-assignments.ts", "utf8");
const appointmentForm = readFileSync(
  "components/calendar/AppointmentForm.tsx",
  "utf8",
);
const updateApi = readFileSync(
  "app/api/calendar/appointments/[id]/route.ts",
  "utf8",
);

const start = new Date("2026-08-03T10:00:00.000Z");
const end = new Date("2026-08-03T11:00:00.000Z");
const openCoverage = [
  {
    start: start.toISOString(),
    end: end.toISOString(),
    status: "open" as const,
  },
];

test("assignment filtering requires complete employee and resource availability", () => {
  const assignments = filterCalendarAssignments({
    start,
    end,
    requiresDevice: true,
    capabilities: [
      {
        practitionerId: "available",
        roomId: "room-a",
        deviceIds: ["busy-device", "device-a"],
      },
      {
        practitionerId: "busy-employee",
        roomId: "room-b",
        deviceIds: ["device-b"],
      },
      {
        practitionerId: "room-constrained",
        roomId: "busy-room",
        deviceIds: ["device-c"],
      },
      {
        practitionerId: "off-schedule",
        roomId: "room-d",
        deviceIds: ["device-d"],
      },
    ],
    coverageByPractitioner: new Map([
      ["available", openCoverage],
      ["busy-employee", openCoverage],
      ["room-constrained", openCoverage],
      ["off-schedule", []],
    ]),
    reservations: [
      {
        practitionerIds: ["someone-else"],
        roomId: null,
        deviceId: "busy-device",
        start,
        end,
      },
      {
        practitionerIds: ["busy-employee"],
        roomId: null,
        deviceId: null,
        start,
        end,
      },
      {
        practitionerIds: [],
        roomId: "busy-room",
        deviceId: null,
        start,
        end,
      },
    ],
  });

  assert.deepEqual(assignments, [
    {
      practitionerId: "available",
      roomId: "room-a",
      deviceId: "device-a",
    },
  ]);
});

test("assignment filtering requires full interval coverage and supports no-device services", () => {
  const assignments = filterCalendarAssignments({
    start,
    end,
    requiresDevice: false,
    capabilities: [
      {
        practitionerId: "partial",
        roomId: "room-a",
        deviceIds: [],
      },
      {
        practitionerId: "complete",
        roomId: "room-b",
        deviceIds: [],
      },
    ],
    coverageByPractitioner: new Map([
      [
        "partial",
        [
          {
            start: start.toISOString(),
            end: "2026-08-03T10:30:00.000Z",
            status: "open",
          },
        ],
      ],
      ["complete", openCoverage],
    ]),
    reservations: [],
  });

  assert.deepEqual(assignments, [
    {
      practitionerId: "complete",
      roomId: "room-b",
      deviceId: null,
    },
  ]);
});

test("calendar assignment lookup is authenticated, ordered, and excludes the edited appointment", () => {
  assert.match(assignmentApi, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.match(assignmentApi, /excludeAppointmentId/);
  assert.doesNotMatch(assignmentApi, /ownPractitionerId|forbidden_employee/);
  assert.match(assignmentService, /id: \{ not: input\.excludeAppointmentId \}/);
  assert.match(assignmentService, /calendarBlock\.findMany/);
  assert.match(assignmentService, /practitioner: \{ displayOrder: "asc" \}/);
  assert.match(assignmentService, /practitioner: \{\s+active: true/);
  assert.match(assignmentService, /room: \{ active: true \}/);
  assert.match(assignmentService, /device: \{ active: true \}/);
});

test("edit reassignment preserves time and chooses a free compatible resource tuple", () => {
  assert.match(appointmentForm, /\/api\/calendar\/assignments\?/);
  assert.match(appointmentForm, /const preserved = candidates\?\.find/);
  assert.match(
    appointmentForm,
    /const assignment = preserved \?\? candidates\?\.\[0\]/,
  );
  assert.match(
    appointmentForm,
    /label: `\$\{detail\.practitionerName\} \(\$\{t\.unavailable\}\)`/,
  );
  assert.match(appointmentForm, /disabled: true/);
  const employeeHandler = appointmentForm.match(
    /<Field label=\{t\.employee\}>([\s\S]*?)<\/Field>/,
  )?.[1];
  assert.ok(employeeHandler);
  assert.match(
    employeeHandler,
    /if \(detail\) \{[\s\S]*?\} else \{[\s\S]*?setTime\(""\)/,
  );
});

test("save remains protected by locking and optimistic version checks", () => {
  assert.match(updateApi, /lockAndFindReservationConflict\(tx/);
  assert.match(updateApi, /excludeAppointmentId: id/);
  assert.match(updateApi, /where: \{ id, version: expectedVersion \}/);
  assert.match(updateApi, /if \(!changed\.count\) throw new Error\("stale"\)/);
});
