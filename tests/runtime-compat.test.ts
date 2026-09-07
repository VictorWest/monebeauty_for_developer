import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CalendarGrid, DatePicker } from "../components/ui/CalendarPicker";
import { clinicTodayYmd } from "../lib/clinic-date";
import { groupBy } from "../lib/collections";

test("content rows group in stable insertion order on Node 20", () => {
  const rows = [
    { slug: "about", locale: "fi" },
    { slug: "about", locale: "en" },
    { slug: "services", locale: "fi" },
  ];
  const groups = groupBy(rows, (row) => row.slug);

  assert.deepEqual([...groups.keys()], ["about", "services"]);
  assert.deepEqual(
    groups.get("about")?.map((row) => row.locale),
    ["fi", "en"],
  );
});

test("clinic date uses the Helsinki calendar day", () => {
  assert.equal(
    clinicTodayYmd(new Date("2026-07-18T21:30:00.000Z")),
    "2026-07-19",
  );
});

test("date picker renders without a next-intl provider", () => {
  for (const locale of ["en", "fi", "ru"]) {
    const html = renderToStaticMarkup(
      createElement(DatePicker, {
        locale,
        defaultValue: "2026-07-18",
        ariaLabel: "Choose date",
      }),
    );
    assert.match(html, /2026/);
    assert.match(html, /aria-haspopup="dialog"/);
  }
});

test("date-of-birth picker preserves its date-only form contract", () => {
  const html = renderToStaticMarkup(
    createElement(DatePicker, {
      locale: "fi",
      name: "dateOfBirth",
      defaultValue: "1984-02-29",
      autoComplete: "bday",
      required: true,
      max: "2026-08-27",
      navigation: "dateOfBirth",
      ariaLabel: "Valitse syntymäaika",
    }),
  );
  assert.match(html, /type="hidden"/);
  assert.match(html, /name="dateOfBirth"/);
  assert.match(html, /value="1984-02-29"/);
  assert.match(html, /autoComplete="bday"/);
  assert.match(html, /aria-required="true"/);
  assert.match(html, /29\.2\.1984/);
});

test("date-of-birth calendar renders localized jump controls and a future limit", () => {
  const html = renderToStaticMarkup(
    createElement(CalendarGrid, {
      locale: "en",
      value: "1984-02-20",
      max: "1984-02-20",
      disableClosedDays: false,
      navigation: "dateOfBirth",
      onSelect: () => undefined,
    }),
  );
  assert.match(html, /aria-label="Month"/);
  assert.match(html, /aria-label="Year"/);
  assert.match(html, /value="1984"/);
  assert.match(html, /aria-label="Tuesday, February 21, 1984"[^>]*disabled=""/);
});
