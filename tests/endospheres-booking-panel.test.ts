import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  normalizeEndospheresBookingOptions,
  type EndospheresPublicOption,
} from "../lib/endospheres-booking-options";

const component = readFileSync(
  "components/technology/EndospheresBookingPanel.tsx",
  "utf8",
);
const detail = readFileSync(
  "components/technology/TechnologyDetailPage.tsx",
  "utf8",
);

function option(
  key: string,
  type: EndospheresPublicOption["type"] = "APPOINTMENT",
): EndospheresPublicOption {
  return {
    key,
    type,
    bookable: true,
    group: null,
    name: key,
    durationLabel: null,
    priceLabel: "€1",
  };
}

test("Endospheres booking removes legacy single duplicates and preserves courses", () => {
  const source = [
    option("endospheres-intro-75"),
    option("intro-75"),
    option("endospheres-30"),
    option("30"),
    option("endospheres-45"),
    option("45"),
    option("endospheres-60"),
    option("60"),
    option("endospheres-75"),
    option("75"),
    ...[30, 45, 60, 75].flatMap((duration) =>
      [6, 12].map((count) => option(`package-${duration}-${count}`, "COURSE")),
    ),
  ];

  const normalized = normalizeEndospheresBookingOptions(source);
  assert.deepEqual(
    normalized.singles.map(({ key }) => key),
    ["intro-75", "30", "45", "60", "75"],
  );
  assert.equal(normalized.packages.length, 4);
  assert.deepEqual(
    normalized.packages.flatMap(({ six, twelve }) => [six?.key, twelve?.key]),
    [
      "package-30-6",
      "package-30-12",
      "package-45-6",
      "package-45-12",
      "package-60-6",
      "package-60-12",
      "package-75-6",
      "package-75-12",
    ],
  );
});

test("Endospheres conversion controls appear before the editorial body", () => {
  assert.ok(
    detail.indexOf("<EndospheresBookingPanel") <
      detail.indexOf("<TechnologyEditorial"),
  );
  // The hero CTA jumps to the picker; the anchor is now chosen per layout so
  // the treatment-card pages get the same treatment.
  assert.match(detail, /endospheres: "endospheres-booking"/u);
  assert.match(detail, /href=\{`#\$\{bookingAnchor\}`\}/u);
  assert.match(detail, /!isEndospheres &&/u);
});

test("Endospheres booking uses accessible tabs and direct option links", () => {
  assert.match(component, /role="tablist"/u);
  assert.match(component, /role="tab"/u);
  assert.match(component, /role="tabpanel"/u);
  assert.match(component, /aria-selected/u);
  assert.match(component, /onKeyDown=\{moveTab\}/u);
  assert.match(component, /option: option\.key/u);
  // Courses stay reachable on a phone, where the price table cannot fit.
  assert.match(component, /md:hidden/u);
});

test("Endospheres cards publish the clinic's duration guidance", () => {
  // `summary` carries the clinic's "which duration should I choose" wording in
  // all three locales. It reached the component but was never rendered, so the
  // duration cards showed nothing but a name and a price.
  assert.match(component, /option\.summary/u);
  assert.match(component, /featuredSingle\.summary/u);
  assert.match(component, /ENDOSPHERES_PACKAGE_NOTE\[locale\]/u);
});
