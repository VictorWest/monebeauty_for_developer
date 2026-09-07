import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("app/globals.css", "utf8");
const home = readFileSync("components/home/HomeReference.tsx", "utf8");
const services = readFileSync(
  "app/(public)/[locale]/palvelut/page.tsx",
  "utf8",
);
const articles = readFileSync(
  "app/(public)/[locale]/artikkelit/page.tsx",
  "utf8",
);
const productCard = readFileSync("components/shop/ProductCard.tsx", "utf8");

const CARD_FILES: Array<[string, string]> = [
  ["HomeReference.tsx", home],
  ["palvelut/page.tsx", services],
  ["artikkelit/page.tsx", articles],
  ["ProductCard.tsx", productCard],
];

test("the stretched-link overlay is defined once and covers its card", () => {
  const rule = styles.match(/\.card-stretch::after \{([^}]*)\}/)?.[1] ?? "";

  assert.match(rule, /position: absolute/);
  assert.match(rule, /inset: 0/);
  assert.match(rule, /z-index: 1/);
  assert.match(rule, /content: ""/);
  // Focus has to be visible on the card, since the card is the click target.
  assert.match(styles, /\.card-stretch:focus-visible::after \{[^}]*outline:/);
});

test("a stretch link never gets its own position or z-index", () => {
  // Positioning the link makes it a stacking context, so its overlay would paint above the
  // card's other controls and swallow their clicks.
  for (const [name, source] of CARD_FILES) {
    for (const className of source.matchAll(/className=[{"]([^"}]*)["}]/g)) {
      const value = className[1];
      if (!value.includes("card-stretch")) continue;
      assert.doesNotMatch(
        value,
        /(^|\s)(relative|absolute|fixed|sticky|z-\[)/,
        `${name}: a card-stretch link must not be positioned — got "${value}"`,
      );
    }
  }
  assert.doesNotMatch(
    styles,
    /\.card-stretch \{[^}]*(position|z-index):/,
    "globals.css must not position .card-stretch itself",
  );
});

test("homepage cards are positioned and their read-more link stretches", () => {
  assert.match(home, /className="hr-more card-stretch"/);
  assert.match(home, /"hr-btn ghost small card-stretch"/);
  // Five grids: technologies and products contribute one each, treatments two because its
  // link picks a different style for the featured banner, and the treatment areas two —
  // one for the mapped Face/Body/Hair cards and one for the wide men's card.
  assert.equal(home.match(/card-stretch/g)?.length, 6);

  for (const selector of [
    "\\.home-reference \\.hr-areas article,\\n\\.home-reference \\.hr-area-men",
    "\\.home-reference \\.hr-services article",
    "\\.home-reference \\.hr-tech article",
    "\\.home-reference \\.hr-products article",
  ]) {
    const rule =
      styles.match(new RegExp(`${selector} \\{([^}]*)\\}`))?.[1] ?? "";
    assert.match(
      rule,
      /position: relative/,
      `${selector} must be positioned for the overlay to size against it`,
    );
  }
});

test("book and basket controls stay above the homepage overlay", () => {
  const escape =
    styles.match(
      /\.home-reference \.hr-services article \.hr-btn:not\(\.card-stretch\),[\s\S]*?\{([^}]*)\}/,
    )?.[1] ?? "";

  assert.match(escape, /position: relative/);
  assert.match(escape, /z-index: 2/);
  assert.match(styles, /\.home-reference \.hr-tech article \.hr-btn/);
  assert.match(styles, /\.home-reference \.hr-products article \.hr-add/);
});

test("the featured banner fills its card so the overlay covers the whole banner", () => {
  // The body panel is the nearest positioned ancestor of the stretch link, so it has to span
  // the banner or only the text strip would be clickable.
  const body =
    styles.match(
      /\.home-reference \.hr-services \.featured \.hr-card-body \{([^}]*)\}/,
    )?.[1] ?? "";

  assert.match(body, /align-self: stretch/);
  assert.match(body, /justify-content: flex-end/);
  // Its desktop grid variant must pin rows to the bottom now that the panel is taller.
  assert.match(
    styles,
    /@media \(min-width: 900px\)[\s\S]*?\.featured \.hr-card-body \{[^}]*align-content: end/,
  );
});

test("tailwind cards are positioned with a single stretched link", () => {
  for (const [name, source, wrapper] of [
    [
      "palvelut",
      services,
      /<article\s+key=\{service\.id\}\s+className="group relative/,
    ],
    [
      "artikkelit",
      articles,
      /className="relative overflow-hidden rounded-\(--radius\)/,
    ],
    ["ProductCard", productCard, /className="group relative flex flex-col/],
  ] as const) {
    assert.match(source, wrapper, `${name}: card wrapper must be relative`);
    assert.match(source, /card-stretch/, `${name}: needs a stretch link`);
  }

  assert.match(services, /className="relative z-\[2\]"/);
  assert.match(productCard, /className="relative z-\[2\]"/);
});

test("duplicate image links are gone so each card has one tab stop", () => {
  // The image used to be its own <Link> to the same destination; with the whole card clickable
  // it would be a redundant second tab stop.
  assert.doesNotMatch(services, /<Link/);
  assert.equal(articles.match(/<Link/g)?.length, 1);
  assert.equal(productCard.match(/<Link/g)?.length, 1);
});
