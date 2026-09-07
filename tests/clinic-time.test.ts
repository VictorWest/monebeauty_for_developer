import assert from "node:assert/strict";
import test from "node:test";
import {
  clinicDateBounds,
  clinicDateFromInstant,
  clinicDateMinuteToInstant,
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
} from "../lib/clinic-time";
import {
  availabilityMatchesWeeklySchedule,
  generateStaffSlots,
  parseWorkingHours,
  scheduleStorageValue,
  workdaySlots,
} from "../lib/staff-schedule";

test("Helsinki wall times use the seasonal UTC offset", () => {
  assert.equal(
    clinicDateTimeToInstant("2026-01-15", "10:00")?.toISOString(),
    "2026-01-15T08:00:00.000Z",
  );
  assert.equal(
    clinicDateTimeToInstant("2026-07-15", "10:00")?.toISOString(),
    "2026-07-15T07:00:00.000Z",
  );
});

test("DST gaps are rejected and repeated times choose the earlier instant", () => {
  assert.equal(clinicDateTimeToInstant("2026-03-29", "03:30"), null);
  assert.equal(
    clinicDateTimeToInstant("2026-10-25", "03:30")?.toISOString(),
    "2026-10-25T00:30:00.000Z",
  );
  assert.equal(
    clinicDateBounds("2026-03-29")!.end.getTime() -
      clinicDateBounds("2026-03-29")!.start.getTime(),
    23 * 60 * 60_000,
  );
  assert.equal(
    clinicDateBounds("2026-10-25")!.end.getTime() -
      clinicDateBounds("2026-10-25")!.start.getTime(),
    25 * 60 * 60_000,
  );
});

test("minute 1440 resolves to clinic midnight on the following date", () => {
  const midnight = clinicDateMinuteToInstant("2026-07-15", 1440)!;
  assert.equal(clinicDateFromInstant(midnight), "2026-07-16");
  assert.equal(clinicTimeFromInstant(midnight), "00:00");
});

test("versioned weekly schedules preserve split shifts and closed weekdays", () => {
  const schedule = parseWorkingHours({
    version: 2,
    timezone: "Europe/Helsinki",
    stepMin: 15,
    intervals: {
      "1": [
        { startMinute: 540, endMinute: 720 },
        { startMinute: 780, endMinute: 1020 },
      ],
    },
  });
  assert.equal(generateStaffSlots("2026-07-20", schedule).length, 28);
  assert.equal(generateStaffSlots("2026-07-21", schedule).length, 0);
  assert.deepEqual(scheduleStorageValue(schedule), {
    version: 2,
    timezone: "Europe/Helsinki",
    stepMin: 15,
    intervals: schedule.intervals,
  });
});

test("availability equivalence compares open coverage instead of segmentation", () => {
  const weekly = {
    version: 2,
    stepMin: 30,
    intervals: {
      "1": [{ startMinute: 540, endMinute: 1020 }],
    },
  };
  const date = "2026-07-20";
  assert.equal(
    availabilityMatchesWeeklySchedule(
      date,
      workdaySlots(date, 540, 1020),
      weekly,
    ),
    true,
  );
  assert.equal(
    availabilityMatchesWeeklySchedule(
      date,
      workdaySlots(date, 600, 1020),
      weekly,
    ),
    false,
  );
  assert.equal(
    availabilityMatchesWeeklySchedule(
      date,
      [...workdaySlots(date, 540, 720), ...workdaySlots(date, 780, 1020)],
      weekly,
    ),
    false,
  );
  assert.equal(availabilityMatchesWeeklySchedule(date, [], weekly), false);
  assert.equal(
    availabilityMatchesWeeklySchedule(
      date,
      workdaySlots(date, 480, 1020),
      weekly,
    ),
    false,
  );
});
