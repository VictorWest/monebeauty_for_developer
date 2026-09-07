import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import en from "../messages/en.json";
import fi from "../messages/fi.json";
import ru from "../messages/ru.json";
import { mainNavigation } from "../lib/navigation";
import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  TECHNOLOGY_PUBLIC_PATHS,
} from "../lib/public-routes";

const messages = { en, fi, ru } as Record<
  string,
  { Nav: Record<string, string> }
>;
const header = readFileSync("components/layout/Header.tsx", "utf8");
const mobile = readFileSync("components/layout/MobileMenu.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

/** The menu the clinic's previous site published, top level in order. */
const TOP_LEVEL = [
  "about",
  "instrumental",
  "trichology",
  "arosha",
  "services",
  "catalog",
] as const;

function navFor(locale: string) {
  const dict = messages[locale].Nav;
  return mainNavigation((key) => {
    const value = dict[key];
    assert.ok(value, `${locale} is missing the Nav.${key} label`);
    return value;
  });
}

test("the header publishes the previous site's menu structure", () => {
  const nav = navFor("en");
  assert.deepEqual(
    nav.map((item) => item.label),
    TOP_LEVEL.map((key) => messages.en.Nav[key]),
  );

  const instrumental = nav.find(
    (item) => item.label === messages.en.Nav.instrumental,
  )!;
  assert.deepEqual(
    instrumental.items?.map((item) => item.href),
    [
      TECHNOLOGY_PUBLIC_PATHS.endospheres,
      TECHNOLOGY_PUBLIC_PATHS.laser,
      TECHNOLOGY_PUBLIC_PATHS.rf,
    ],
  );
  // There is no /laitehoidot index route, so the group opens a submenu only.
  assert.equal(instrumental.href, undefined);

  const services = nav.find((item) => item.label === messages.en.Nav.services)!;
  assert.equal(services.href, PUBLIC_PATHS.services);
  assert.deepEqual(
    services.items?.map((item) => item.href),
    [
      SERVICE_PUBLIC_PATHS.facial,
      SERVICE_PUBLIC_PATHS.body,
      SERVICE_PUBLIC_PATHS.trichology,
      SERVICE_PUBLIC_PATHS.laser,
      SERVICE_PUBLIC_PATHS.rf,
      SERVICE_PUBLIC_PATHS.brows,
      SERVICE_PUBLIC_PATHS.packages,
      SERVICE_PUBLIC_PATHS.giftCards,
      SERVICE_PUBLIC_PATHS.endospheres,
      SERVICE_PUBLIC_PATHS.injectable,
      SERVICE_PUBLIC_PATHS.consultation,
    ],
  );
});

test("every published service is reachable from the menu", () => {
  const services = navFor("en").find((item) => item.items?.length === 11)!;
  const linked = new Set(services.items!.map((item) => item.href));
  for (const [slug, path] of Object.entries(SERVICE_PUBLIC_PATHS))
    assert.ok(linked.has(path), `${slug} has no entry in the services menu`);
});

test("the menu is fully translated in every locale", () => {
  for (const locale of ["en", "fi", "ru"]) {
    const nav = navFor(locale);
    const labels: string[] = [];
    for (const item of nav) {
      labels.push(item.label);
      for (const child of item.items ?? []) {
        labels.push(child.label);
        assert.match(child.href, /^\//u, `${locale}: ${child.label}`);
      }
    }
    for (const label of labels)
      assert.ok(label.trim().length > 1, `${locale}: empty label`);
    // Nothing fell through to a raw message key.
    for (const label of labels)
      assert.doesNotMatch(label, /^Nav\.|^[a-z]+[A-Z][a-z]+$/u, locale);
  }
});

test("the header no longer navigates to homepage anchors", () => {
  // The menu previously pointed at /#treatments, /#technologies, /#products and
  // /#standard, so none of the site's own pages was reachable from it.
  assert.doesNotMatch(
    header,
    /"\/#(treatments|technologies|products|standard)"/u,
  );
  assert.match(header, /mainNavigation/u);
  assert.match(header, /<NavDropdown/u);
});

test("the desktop row fits the header in every locale", () => {
  // The six-item menu overflowed its track and was drawn over the brand: the
  // header caps at 1280px with a 40px inset, so the usable width is the same on
  // a 1280px screen and a 1920px one. Finnish is the binding case. This is an
  // estimate from character counts, deliberately generous, and its job is to
  // catch a new item or a longer label reintroducing the overflow.
  const CHARACTER = 12 * 0.62 + 12 * 0.1; // 12px uppercase, .10em tracking
  const GAP = 16; // clamp(10px, 1vw, 16px) at its maximum
  const ICON = 44; // cart, account, language switcher
  const BUDGET = 1280 - 80 - 110; // container - inset - brand

  for (const locale of ["en", "fi", "ru"]) {
    const nav = navFor(locale);
    const labels = nav.reduce(
      (total, item) =>
        total + item.label.length * CHARACTER + (item.items ? 17 : 0),
      0,
    );
    const book = (
      messages[locale] as unknown as {
        HomeReference: { common: { bookOnline: string } };
      }
    ).HomeReference.common.bookOnline;
    const width =
      labels + (nav.length + 4) * GAP + (book.length * 7.5 + 40) + ICON * 3;
    assert.ok(
      width <= BUDGET,
      `${locale} navigation needs ~${Math.round(width)}px of ${BUDGET}px`,
    );
  }
});

test("the header row is styled from one place and reveals only when it fits", () => {
  // Revealing at 1180px put the row on screen 100px before it could fit.
  assert.match(css, /@media \(min-width: 1280px\)/u);
  assert.doesNotMatch(css, /@media \(min-width: 1180px\)/u);
  // Both dropdown triggers share the plain links' sizing, so tightening the row
  // cannot leave the unlinked group label behind at the old size.
  assert.match(css, /\.hr-nav a:not\(\.hr-btn\),\s*\.hr-nav \.hr-nav-label/u);
  const dropdown = readFileSync("components/layout/NavDropdown.tsx", "utf8");
  assert.match(dropdown, /hr-nav-label/u);
  assert.doesNotMatch(dropdown, /text-\[12px\]|tracking-\[\.14em\]/u);
  // The account control lost its visible text, so it must name itself.
  assert.match(header, /aria-label=\{th\("account"\)\}/u);
});

test("the mobile menu carries the same nested structure", () => {
  // .hr-nav only becomes visible at 1280px, so every narrower viewport depends
  // on this menu for the whole navigation.
  assert.match(css, /@media \(min-width: 1280px\)/u);
  assert.match(mobile, /link\.items/u);
  assert.match(mobile, /hr-menu-sub/u);
  assert.match(mobile, /hr-menu-group/u);
  // The submenu wrapper nests links one level deeper than the old markup, so
  // the top-level row styling must reach them.
  assert.match(css, /\.hr-menu > div > a/u);
  assert.match(css, /\.hr-menu-sub a/u);
});
