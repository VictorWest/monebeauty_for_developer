import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";

const config = readFileSync("next.config.ts", "utf8");
const home = readFileSync("components/home/HomeReference.tsx", "utf8");
const siteMedia = readFileSync("content/site-media.ts", "utf8");

const FOUR_HOURS = 14400;

test("public media is cached instead of re-downloaded every visit", () => {
  // Next serves `public/` with `max-age=0`, so the hero video was fetched in full on every
  // page view: 6.1MB across the world, ahead of every image on the page.
  const rule =
    config.match(/source: "\/media\/:path\*"[\s\S]*?\],\s*\}/)?.[0] ?? "";

  assert.match(rule, /Cache-Control/);
  assert.match(rule, /immutable/);
  const maxAge = Number(config.match(/const YEAR_SECONDS = (\d+)/)?.[1] ?? "0");
  assert.ok(
    maxAge >= 2592000,
    `media should be cached for at least 30 days, got ${maxAge}s`,
  );
});

test("optimized images are not revalidated several times a day", () => {
  const ttl = Number(config.match(/const MONTH_SECONDS = (\d+)/)?.[1] ?? "0");

  assert.match(config, /minimumCacheTTL: MONTH_SECONDS/);
  assert.ok(
    ttl > FOUR_HOURS,
    `minimumCacheTTL must beat the ${FOUR_HOURS}s default, got ${ttl}s`,
  );
});

test("the managed hero has a local bootstrap and shares its poster source", () => {
  // The LCP image used to be a remote Unsplash URL, which the default next/image loader
  // fetches on the server before it can respond: a cross-internet hop in front of the
  // largest element above the fold.
  assert.doesNotMatch(home, /images\.unsplash\.com/);
  assert.match(siteMedia, /key: "home\.hero-poster"/);
  assert.match(siteMedia, /fallback: "\/media\/hero-poster\.jpg"/);
  assert.match(home, /src=\{heroMedia\.image!\}/);
  assert.match(home, /poster=\{heroMedia\.image \?\? undefined\}/);
  assert.match(home, /priority/);
});

test("the hero clip and its poster stay small enough to ship", () => {
  const video = statSync("public/media/hero.mp4").size;
  const poster = statSync("public/media/hero-poster.jpg").size;

  assert.ok(
    video < 1_500_000,
    `hero.mp4 is ${(video / 1048576).toFixed(2)}MB; it was 6.1MB before compression`,
  );
  assert.ok(
    poster < 400_000,
    `hero-poster.jpg is ${(poster / 1024).toFixed(0)}KB`,
  );
  // The archive poster was a fully black frame, which is why it was never used.
  assert.ok(poster > 5_000, "hero-poster.jpg looks empty");
});
