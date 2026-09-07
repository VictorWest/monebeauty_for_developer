import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { selectMenuLayout } from "../lib/select-placement";

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? tsxFiles(path)
      : entry.name.endsWith(".tsx")
        ? [path]
        : [];
  });
}

const applicationSource = [...tsxFiles("app"), ...tsxFiles("components")]
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");
const select = readFileSync("components/ui/ThemedSelect.tsx", "utf8");
const calendar = readFileSync("components/ui/CalendarPicker.tsx", "utf8");
const clinicDate = readFileSync("lib/clinic-date.ts", "utf8");
const time = readFileSync("components/ui/TimePicker.tsx", "utf8");
const staff = readFileSync("app/api/staff/schedule/route.ts", "utf8");

test("application forms contain no native select, date, or time pickers", () => {
  assert.doesNotMatch(applicationSource, /<select\b/);
  assert.doesNotMatch(applicationSource, /type=["'](?:date|time)["']/);
});

test("themed controls expose accessible custom interaction semantics", () => {
  assert.match(select, /aria-haspopup="listbox"/);
  assert.match(select, /role="option"/);
  assert.match(select, /ArrowDown/);
  assert.match(select, /data-placement=\{placement\}/);
  assert.match(calendar, /role="grid"/);
  assert.match(clinicDate, /Europe\/Helsinki/);
  assert.doesNotMatch(calendar, /useLocale/);
  assert.match(calendar, /locale: string/);
  assert.match(time, /role="listbox"/);
  assert.match(calendar, /availableDates/);
  assert.match(calendar, /disabled[\s\S]*available/);
  assert.match(calendar, /navigation === "dateOfBirth"/);
  assert.match(
    calendar,
    /new Intl\.DateTimeFormat\(locale, \{ month: "long" \}\)/,
  );
  assert.match(calendar, /inputMode="numeric"/);
  assert.match(calendar, /pattern="\[0-9\]\{4\}"/);
  assert.match(calendar, /aria-required=\{required \|\| undefined\}/);
  assert.match(calendar, /role="dialog"/);
  assert.match(calendar, /event\.key === "Escape"/);
  assert.match(time, /filter\(\(option\) => !option\.disabled\)/);
});

test("themed selects choose a viewport-safe opening direction", () => {
  assert.deepEqual(
    selectMenuLayout({
      triggerTop: 120,
      triggerBottom: 164,
      menuHeight: 180,
      viewportHeight: 800,
    }),
    { placement: "down", maxHeight: 630 },
  );
  assert.deepEqual(
    selectMenuLayout({
      triggerTop: 700,
      triggerBottom: 744,
      menuHeight: 140,
      viewportHeight: 800,
    }),
    { placement: "up", maxHeight: 694 },
  );
  assert.deepEqual(
    selectMenuLayout({
      triggerTop: 70,
      triggerBottom: 134,
      menuHeight: 300,
      viewportHeight: 220,
    }),
    { placement: "down", maxHeight: 80 },
  );
});

test("staff schedule accepts back-office employee selection", () => {
  assert.match(staff, /requireApiUser\(\["ADMIN", "STAFF"\]\)/);
  assert.match(staff, /payload\.practitionerId/);
  assert.match(staff, /searchParams\.get\("practitionerId"\)/);
  assert.match(staff, /return id \|\| getFirstActivePractitionerId\(\)/);
  assert.doesNotMatch(staff, /where: \{ userId: user\.id \}/);
});
