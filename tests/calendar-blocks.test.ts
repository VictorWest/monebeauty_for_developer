import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  adjustFinalItemDuration,
  endFromSequentialItems,
  expandCalendarRecurrence,
  lockReservationKeys,
  snapToCalendarQuarter,
} from "../lib/calendar-blocks";

test("calendar blocks snap to 15 minutes and sum sequential services", () => {
  assert.equal(
    snapToCalendarQuarter(new Date("2026-07-21T10:08:31Z")).toISOString(),
    "2026-07-21T10:15:00.000Z",
  );
  assert.equal(
    endFromSequentialItems(new Date("2026-07-21T10:00:00Z"), [
      { durationMin: 30 },
      { durationMin: 45 },
    ]).toISOString(),
    "2026-07-21T11:15:00.000Z",
  );
  assert.deepEqual(
    adjustFinalItemDuration(
      new Date("2026-07-21T10:00:00Z"),
      new Date("2026-07-21T11:30:00Z"),
      [
        { templateId: "a", durationMin: 30 },
        { templateId: "b", durationMin: 30 },
      ],
    ),
    [
      { templateId: "a", durationMin: 30 },
      { templateId: "b", durationMin: 60 },
    ],
  );
});

test("recurrence is weekday-selective, inclusive, and limited", () => {
  const dates = expandCalendarRecurrence({
    start: new Date("2026-07-20T10:00:00Z"),
    weekdays: [1, 3],
    endDate: new Date("2026-07-29T23:59:59Z"),
  });
  assert.deepEqual(
    dates.map((date) => date.toISOString().slice(0, 10)),
    ["2026-07-20", "2026-07-22", "2026-07-27", "2026-07-29"],
  );
  assert.throws(
    () =>
      expandCalendarRecurrence({
        start: new Date("2026-01-01T10:00:00Z"),
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        endDate: new Date("2026-12-31T23:59:59Z"),
        limit: 10,
      }),
    /occurrence_limit/,
  );
  assert.throws(
    () =>
      expandCalendarRecurrence({
        start: new Date("2026-01-01T10:00:00Z"),
        weekdays: [1],
        endDate: new Date("2027-01-02T10:00:00Z"),
      }),
    /invalid_recurrence_range/,
  );
});

test("reservation keys use non-returning advisory lock queries", async () => {
  const lockedKeys: string[] = [];
  const tx = {
    $executeRaw: async (_strings: TemplateStringsArray, key: string) => {
      lockedKeys.push(key);
      return 1;
    },
  };

  await lockReservationKeys(tx as never, {
    start: new Date("2026-07-22T10:00:00Z"),
    end: new Date("2026-07-22T11:00:00Z"),
    practitionerIds: ["practitioner-2", "practitioner-1"],
    roomId: "room-1",
    deviceId: "device-1",
  });

  assert.deepEqual(lockedKeys, [
    "device:device-1:2026-07-22",
    "employee:practitioner-1:2026-07-22",
    "employee:practitioner-2:2026-07-22",
    "room:room-1:2026-07-22",
  ]);
});

test("schema, seeds, APIs, RBAC, and advisory locks preserve internal reservations", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const seed = readFileSync("prisma/seed.ts", "utf8");
  const catalog = readFileSync(
    "content/generated/internal-calendar-services.json",
    "utf8",
  );
  const create = readFileSync("app/api/calendar/blocks/route.ts", "utf8");
  const update = readFileSync("app/api/calendar/blocks/[id]/route.ts", "utf8");
  const scheduling = readFileSync("lib/calendar-blocks.ts", "utf8");
  const booking = readFileSync("lib/booking.ts", "utf8");
  for (const model of [
    "CalendarBlockTemplate",
    "CalendarBlockSeries",
    "CalendarBlock",
    "CalendarBlockItem",
    "CalendarBlockParticipant",
  ])
    assert.match(schema, new RegExp(`model ${model}`));
  for (const key of ["lunch", "personal", "errand", "sick", "vacation"])
    assert.match(catalog, new RegExp(`"key": "${key}"`));
  for (const label of [
    "Ruokatauko",
    "Henkilökohtainen meno",
    "Työmeno",
    "Sairasloma",
    "Loma",
  ])
    assert.match(catalog, new RegExp(label));
  assert.match(seed, /INTERNAL_CALENDAR_SERVICES/);
  assert.match(create, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.doesNotMatch(create, /user\.role === "STAFF"|ownPractitionerId/);
  assert.match(create, /TransactionIsolationLevel\.Serializable/);
  assert.match(update, /scope === "future"/);
  assert.match(update, /status: "CANCELLED"/);
  assert.match(scheduling, /\$executeRaw`SELECT pg_advisory_xact_lock/);
  assert.match(scheduling, /calendarBlock\.findFirst/);
  assert.match(booking, /calendarBlock\.findMany/);
});
