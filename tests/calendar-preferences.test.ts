import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calendarDropStart,
  normalizeEmployeeSelection,
  normalizeInternalPalette,
  truncateCalendarAlias,
} from "../lib/calendar-preferences";
import {
  INTERNAL_CALENDAR_SERVICES,
  INTERNAL_PALETTE_MAX_SELECTED,
} from "../lib/internal-calendar-services";

test("internal palette defaults match the approved Finnish shortcuts", () => {
  const palette = normalizeInternalPalette(null);
  assert.deepEqual(
    palette
      .slice(0, 4)
      .map(({ key, aliases, enabled }) => ({ key, aliases, enabled })),
    [
      {
        key: "lunch",
        aliases: { fi: "Ruokatauko", en: "Lunch break", ru: "Обед" },
        enabled: true,
      },
      {
        key: "personal",
        aliases: {
          fi: "Henkilökoh",
          en: "Personal time",
          ru: "Личное время",
        },
        enabled: true,
      },
      {
        key: "errand",
        aliases: { fi: "Työmeno", en: "Work errand", ru: "Поручение" },
        enabled: true,
      },
      {
        key: "sick",
        aliases: { fi: "Sairasloma", en: "Sick leave", ru: "Больничный" },
        enabled: true,
      },
    ],
  );
  assert.equal(palette.length, 119);
  assert.equal(palette.filter((item) => item.enabled).length, 4);
  assert.equal(palette.find((item) => item.key === "vacation")?.enabled, false);
});

test("palette order, visibility, and 14-character aliases normalize safely", () => {
  const palette = normalizeInternalPalette([
    { key: "vacation", alias: "  Pitkä lomajakso  ", enabled: false },
    { key: "lunch", alias: "", enabled: true },
    { key: "unknown", alias: "Ignored", enabled: true },
  ]);
  assert.equal(palette[0].key, "vacation");
  assert.equal(palette[0].aliases.fi, "Pitkä lomajaks");
  assert.equal(palette[0].aliases.en, "Vacation");
  assert.equal(palette[0].aliases.ru, "Отпуск");
  assert.equal(palette[0].enabled, false);
  assert.equal(palette[1].aliases.fi, "Ruokatauko");
  assert.equal(truncateCalendarAlias("123456789012345"), "12345678901234");
  assert.equal(palette.length, 119);
});

test("the generated catalog exactly preserves all Finnish source rows", () => {
  const lines = readFileSync("internal-services.txt", "utf8")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .slice(4)
    .filter((line, index, all) => index < all.length - 1 || line.trim());
  const rows = Array.from({ length: lines.length / 2 }, (_, index) => ({
    labelFi: lines[index * 2].trim(),
    dragLabel: lines[index * 2 + 1].trim(),
  }));
  assert.equal(INTERNAL_CALENDAR_SERVICES.length, 119);
  assert.deepEqual(
    INTERNAL_CALENDAR_SERVICES.map(({ labelFi, dragLabel }) => ({
      labelFi,
      dragLabel,
    })),
    rows,
  );
  assert.equal(
    new Set(INTERNAL_CALENDAR_SERVICES.map((service) => service.key)).size,
    119,
  );
  assert.ok(
    INTERNAL_CALENDAR_SERVICES.every((service) =>
      Object.values(service.dragLabels).every(
        (alias) => Array.from(alias).length <= 14,
      ),
    ),
  );
});

test("the generated catalog has complete English and Russian translations", () => {
  const translations = JSON.parse(
    readFileSync("content/internal-calendar-services.i18n.json", "utf8"),
  ) as Record<
    string,
    {
      labelEn: string;
      labelRu: string;
      dragLabelEn: string;
      dragLabelRu: string;
    }
  >;
  assert.deepEqual(
    Object.keys(translations).sort(),
    INTERNAL_CALENDAR_SERVICES.map((service) => service.key).sort(),
  );
  assert.ok(
    INTERNAL_CALENDAR_SERVICES.every(
      (service) =>
        service.labelEn.trim() &&
        service.labelRu.trim() &&
        service.dragLabels.en.trim() &&
        service.dragLabels.ru.trim(),
    ),
  );
});

test("palette aliases are independently editable in each locale", () => {
  const palette = normalizeInternalPalette([
    {
      key: "lunch",
      aliases: {
        fi: "Oma tauko",
        en: "My break",
        ru: "Мой перерыв",
      },
      enabled: true,
    },
  ]);
  assert.deepEqual(palette[0].aliases, {
    fi: "Oma tauko",
    en: "My break",
    ru: "Мой перерыв",
  });
});

test("palette normalization caps selected services at the Timma limit", () => {
  const palette = normalizeInternalPalette(
    INTERNAL_CALENDAR_SERVICES.slice(0, 30).map((service) => ({
      key: service.key,
      alias: service.dragLabel,
      enabled: true,
    })),
  );
  assert.equal(
    palette.filter((item) => item.enabled).length,
    INTERNAL_PALETTE_MAX_SELECTED,
  );
});

test("staff selection stays own-only while admin selection restores valid ids", () => {
  assert.deepEqual(
    normalizeEmployeeSelection(["b", "stale"], ["a", "b"], null),
    ["b"],
  );
  assert.deepEqual(normalizeEmployeeSelection(["b"], ["a", "b"], "a"), ["a"]);
  assert.deepEqual(normalizeEmployeeSelection(null, ["a", "b"], null), [
    "a",
    "b",
  ]);
});

test("calendar drop targets resolve exact quarter-hour starts", () => {
  assert.equal(
    calendarDropStart("2026-07-21", 10 * 60 + 45),
    "2026-07-21T07:45:00.000Z",
  );
  assert.equal(calendarDropStart("2026-07-21", 10 * 60 + 7), null);
  assert.equal(calendarDropStart("bad", 600), null);
});
