import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { BOOKING_SERVICES } from "../content/booking-services";
import { SITE_MEDIA_DEFINITIONS } from "../content/site-media";

const styles = readFileSync("app/globals.css", "utf8");
const home = readFileSync("components/home/HomeReference.tsx", "utf8");
const syncScript = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");

test("the owner-archived technologies section stays off the homepage without deleting its content", () => {
  assert.match(home, /const HOMEPAGE_TECHNOLOGIES_ARCHIVED = true/);
  assert.match(home, /!HOMEPAGE_TECHNOLOGIES_ARCHIVED \? \(/);
  assert.match(home, /technologies\.map\(\(technology, i\) =>/);
  assert.match(home, /id="technologies"/);
});

test("homepage hero media stays within the mobile viewport", () => {
  const baseRule = styles.match(/\.hr-hero-image \{([^}]*)\}/)?.[1] ?? "";

  assert.match(baseRule, /width: 100%/);
  assert.match(baseRule, /aspect-ratio: 4\/3/);
  assert.doesNotMatch(baseRule, /min-(?:width|height)/);
});

test("homepage hero restores the desktop cinematic ratio", () => {
  assert.match(
    styles,
    /@media \(min-width: 768px\) \{[\s\S]*?\.hr-hero-image \{\s*aspect-ratio: 21\/9;\s*\}/,
  );
});

test("the treatment areas lead into the clinical services list", () => {
  const areas = home.indexOf('id="areas"');
  const treatments = home.indexOf('id="treatments"');

  assert.ok(areas > 0, "the treatment-areas section is missing");
  assert.ok(
    areas < treatments,
    "treatment areas must come before the services grid",
  );
  // The category cards are an entry point, not a second copy of the service list.
  assert.match(home, /const TREATMENT_AREAS = \[/);
  for (const key of ["face", "body", "hair"]) {
    assert.match(home, new RegExp(`key: "${key}"`), `${key} area is missing`);
  }
  assert.match(home, /t\("areas\.items\.men\.title"\)/);
});

test("the four primary area icons are a unified drawn set", () => {
  // Phosphor's nearest matches do not share the anatomical line-art style in the reference.
  assert.match(home, /from "@\/components\/home\/TreatmentAreaIcons"/);
  for (const icon of ["FaceProfileIcon", "BodyIcon", "HairIcon"]) {
    assert.match(home, new RegExp(`Icon: ${icon},`), `${icon} is not wired up`);
  }
  assert.match(home, /<MaleIcon size=\{40\} \/>/);
  for (const gone of [
    "UserFocus,\n  },",
    "PersonArmsSpread",
    "HairDryer",
    "GenderMale",
  ]) {
    assert.doesNotMatch(
      home,
      new RegExp(gone),
      `${gone} is still an area icon`,
    );
  }
});

test("every treatment-area image is committed", () => {
  const images = SITE_MEDIA_DEFINITIONS.filter((item) =>
    item.key.startsWith("home.area."),
  ).map((item) => item.fallback);

  assert.deepEqual(images, [
    "/media/home/treatment-areas/face.jpeg",
    "/media/home/treatment-areas/body.jpeg",
    "/media/home/treatment-areas/hair.jpeg",
    "/media/home/treatment-areas/men.png",
  ]);
  for (const path of images) {
    assert.ok(path);
    assert.equal(existsSync(`public${path}`), true, `${path} is not committed`);
  }
});

test("treatment-area photos keep their reference focal points", () => {
  assert.match(home, /className=\{`hr-area-photo hr-area-photo-\$\{key\}`\}/);
  assert.match(home, /className="hr-area-photo hr-area-photo-men"/);
  for (const area of ["face", "body", "hair", "men"]) {
    assert.match(
      styles,
      new RegExp(`\\.hr-area-photo-${area} \\{[^}]*object-position:`),
      `${area} has no object-position`,
    );
  }
});

test("the card photos are cut off square, with no fade into the body", () => {
  // The client rejected the gradient that used to soften the photo into the card body.
  assert.doesNotMatch(styles, /\.hr-area-image:after/);
  // The men's banner keeps its horizontal dissolve — that one is in the reference.
  assert.match(
    styles,
    /\.hr-area-men-image:after \{[^}]*linear-gradient\(\s*to right/,
  );
});

test("treatment-area cards settle into three columns like the services grid", () => {
  const grid =
    styles.match(/\.home-reference \.hr-areas \{([^}]*)\}/)?.[1] ?? "";

  assert.match(grid, /grid-template-columns: 1fr/);
  assert.match(grid, /gap:\s*clamp\(/);
  assert.match(
    styles,
    /@media \(min-width: 680px\) \{\s*\.home-reference \.hr-areas \{\s*grid-template-columns: repeat\(2, 1fr\)/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1040px\) \{\s*\.home-reference \.hr-areas \{\s*grid-template-columns: repeat\(3, 1fr\)/,
  );
});

test("treatment-area cards reuse the card chrome and the translate-based lift", () => {
  const card =
    styles.match(
      /\.home-reference \.hr-areas article,\n\.home-reference \.hr-area-men \{([^}]*)\}/,
    )?.[1] ?? "";

  assert.match(card, /position: relative/);
  assert.match(card, /border-radius: var\(--radius\)/);
  assert.match(card, /box-shadow: var\(--shadow-card-soft\)/);
  // The reference stands its cards a shade darker than the page, with no border.
  assert.match(card, /background: var\(--color-alt\)/);
  assert.doesNotMatch(card, /border: /);
  // The scroll-reveal pins `transform: none !important`, so hover must lift via `translate`.
  assert.match(
    styles,
    /\.home-reference \.hr-areas article:hover,\n\.home-reference \.hr-area-men:hover \{[^}]*translate: 0 -6px/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.home-reference \.hr-areas article:hover,\n\s*\.home-reference \.hr-area-men:hover \{\s*translate: none/,
  );
});

test("the benefits rows centre inside the disc", () => {
  // Stretched rows left the glyphs against the disc's left edge, 46px off its centre.
  const aside = styles.match(/\.hr-area-benefits \{([^}]*)\}/)?.[1] ?? "";

  assert.match(aside, /grid-template-columns: max-content/);
  assert.match(aside, /justify-content: center/);
});

test("the treatment-area composition uses the reference width and botanical detail", () => {
  assert.match(
    styles,
    /\.home-reference \.hr-areas-shell \{[^}]*max-width: 1088px/,
  );
  assert.match(home, /<BotanicalSprig className="hr-area-botanical" \/>/);
  assert.match(
    styles,
    /@media \(min-width: 1040px\) \{\s*\.hr-area-botanical \{[^}]*display: block/,
  );
});

test("the men's photo sits below the card copy without positioning it", () => {
  // `next/image` fill needs a positioned wrapper, and a positioned element paints above a
  // static sibling whatever the DOM order — that hid the badge behind the photo.
  assert.match(
    styles,
    /\.home-reference \.hr-area-men \{[^}]*isolation: isolate/,
  );
  assert.match(
    styles,
    /\.home-reference \.hr-area-men-image \{[^}]*z-index: -1/,
  );
  // Positioning the body instead would shrink the stretched card link to half the banner.
  const body =
    styles.match(
      /\.home-reference \.hr-area-men \.hr-area-body \{([^}]*)\}/,
    )?.[1] ?? "";
  assert.doesNotMatch(body, /position:|z-index:/);
});

test("the area icons fill their badge the way the reference does", () => {
  const icons = readFileSync("components/home/TreatmentAreaIcons.tsx", "utf8");

  assert.equal(icons.match(/viewBox="0 0 48 48"/g)?.length, 4);
  assert.equal(icons.match(/size = 40/g)?.length, 4);
  assert.match(icons, /"aria-hidden": true/);
  assert.match(home, /<Icon size=\{40\} \/>/);
  assert.match(home, /<MaleIcon size=\{40\} \/>/);
});

test("the benefits disc is decoration, not content", () => {
  // A circle carrying no meaning belongs on a pseudo-element, out of the accessibility tree.
  const disc = styles.match(/\.hr-area-benefits:before \{([^}]*)\}/)?.[1] ?? "";

  assert.match(disc, /border-radius: 50%/);
  assert.match(disc, /aspect-ratio: 1/);
  assert.match(disc, /content: ""/);
  // Its rows sit above the disc, so they need their own stacking position.
  assert.match(styles, /\.hr-area-benefits > div \{[^}]*position: relative/);
});

test("clinical services cards are separated, not fused into a hairline mosaic", () => {
  const grid =
    styles.match(/\.home-reference \.hr-services \{([^}]*)\}/)?.[1] ?? "";

  // The mosaic used `gap: 1px` with the container border showing through as seams.
  assert.doesNotMatch(grid, /gap:\s*1px/);
  assert.doesNotMatch(grid, /background:\s*var\(--color-line-card\)/);
  assert.match(grid, /gap:\s*clamp\(/);
});

test("clinical services cards each carry their own border, radius, and lift", () => {
  const card =
    styles.match(/\.home-reference \.hr-services article \{([^}]*)\}/)?.[1] ??
    "";

  assert.match(card, /border: 1px solid var\(--color-line-card\)/);
  assert.match(card, /border-radius: var\(--radius\)/);
  assert.match(card, /box-shadow: var\(--shadow-card-soft\)/);
  assert.match(styles, /--shadow-card-soft:/);
  // The scroll-reveal pins `transform: none !important`, so hover must lift via `translate`.
  assert.match(
    styles,
    /\.home-reference \.hr-services article:hover \{[^}]*translate: 0 -6px/,
  );
});

test("clinical services settle into three columns", () => {
  assert.match(
    styles,
    /@media \(min-width: 680px\) \{\s*\.home-reference \.hr-services \{\s*grid-template-columns: repeat\(2, 1fr\)/,
  );
  assert.match(
    styles,
    /@media \(min-width: 1040px\) \{\s*\.home-reference \.hr-services \{\s*grid-template-columns: repeat\(3, 1fr\)/,
  );
});

test("the SCOPE aesthetic-medicine services are live, not forthcoming stubs", () => {
  for (const key of ["injectable", "consultation"]) {
    const service = BOOKING_SERVICES.find((entry) => entry.key === key);
    assert.ok(service, `${key} is missing from the booking registry`);
    assert.equal(service.bookable, true, `${key} is still unbookable`);
    assert.ok(service.contentSlug, `${key} has no content page`);
    assert.ok(service.image, `${key} has no registry image`);
    assert.equal(
      existsSync(`public${service.image}`),
      true,
      `${service.image} is not committed`,
    );
  }
});

test("body and Endospheres use the supplied clinic imagery", () => {
  const expected = {
    body: "/media/clinic/body/body-treatment.png",
    endospheres: "/media/clinic/endospheres/endospheres-treatment.png",
  } as const;

  for (const [key, image] of Object.entries(expected)) {
    const service = BOOKING_SERVICES.find((entry) => entry.key === key);
    assert.equal(service?.image, image);
    assert.equal(
      existsSync(`public${image}`),
      true,
      `${image} is not committed`,
    );
    assert.equal(
      syncScript.includes(image),
      true,
      `${image} is missing from the Prisma content sync`,
    );
  }
});

test("no service renders twice on the homepage", () => {
  // Both services now arrive through the DB-derived `services` prop. The hardcoded
  // "coming soon" cards that used to stand in for them would duplicate those cards.
  assert.doesNotMatch(home, /\["injectable", "consultation"\]/);
  assert.doesNotMatch(home, /comingSoon/);
  assert.doesNotMatch(home, /"soon plain"/);
  // And the placeholder styling that only those cards used is gone with them.
  assert.doesNotMatch(styles, /\.home-reference \.hr-services article\.soon/);
});

test("desktop header keeps the logo left and navigation right", () => {
  // The full row is revealed at 1280px, not 1180px: the header's usable width is
  // 1160px at every desktop size, and the six-item menu overflowed it and was
  // drawn over the brand.
  const desktopRules =
    styles.match(
      /@media \(min-width: 1280px\) \{([\s\S]*?)\r?\n\}\r?\n@media \(min-width: 1200px\)/,
    )?.[1] ?? "";

  assert.match(desktopRules, /grid-template-columns: auto minmax\(0, 1fr\)/);
  assert.doesNotMatch(desktopRules, /\.hr-left/);
  assert.match(desktopRules, /\.hr-right \{[\s\S]*?justify-content: flex-end/);
  assert.match(
    desktopRules,
    /\.hr-nav a:not\(\.hr-btn\),\s*\.hr-nav \.hr-nav-label \{[\s\S]*?white-space: nowrap/,
  );
  assert.match(
    desktopRules,
    /\.hr-right \.hr-btn \{[\s\S]*?height: 44px;[\s\S]*?flex: none;[\s\S]*?white-space: nowrap/,
  );
  assert.match(desktopRules, /\.hr-mobile \{\s*display: none/);
});
