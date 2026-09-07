import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { SERVICE_SUMMARIES } from "../content/service-summaries";
import type { Locale } from "../i18n/routing";

const locales: Locale[] = ["en", "fi", "ru"];
const syncScript = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
const registry = readFileSync("content/booking-services.ts", "utf8");

test("every published service has summary copy in all three locales", () => {
  const slugs = [
    "facial",
    "body",
    "endospheres",
    "laser",
    "rf",
    "trichology",
    "brows",
    "packages",
    "injectable",
    "consultation",
  ];
  for (const slug of slugs)
    for (const locale of locales) {
      const summary = SERVICE_SUMMARIES[slug]?.[locale];
      assert.ok(summary, `${slug}/${locale} is missing a summary`);
      assert.ok(
        summary.length <= 160,
        `${slug}/${locale} exceeds the meta-description budget`,
      );
      assert.match(
        summary,
        /[.!?]$/u,
        `${slug}/${locale} does not end as a sentence`,
      );
    }
});

test("summaries carry none of the price-list artefacts of the source pages", () => {
  for (const slug of Object.keys(SERVICE_SUMMARIES))
    for (const locale of locales) {
      const summary = SERVICE_SUMMARIES[slug][locale];
      assert.doesNotMatch(
        summary,
        /€|Into a basket|ostoskoriin|корзину/i,
        slug,
      );
      assert.doesNotMatch(summary, /…$/u, `${slug}/${locale} is truncated`);
    }
});

test("the CMS sync prefers curated summaries and cuts excerpts on word boundaries", () => {
  assert.match(syncScript, /shortDesc: summary/);
  assert.match(
    syncScript,
    /SERVICE_SUMMARIES\[definition\.slug\]\?\.\[locale\]/,
  );
  // The old helper ended with a bare `.slice(0, max)`, which cut words in half.
  const helper = syncScript.match(/function excerpt\([\s\S]*?\n\}/)?.[0] ?? "";
  assert.match(helper, /replace\(\/\\s\+\\S\*\$\/, ""\) \+ "…"/);
});

test("stock-photographed services are wired to committed, attributed files", () => {
  const cases: Array<[string, RegExp, RegExp]> = [
    [
      "injectable",
      /"(\/media\/stock\/dermal-filler-[^"]+)"/,
      /cosmetic-procedure-dermal-filler-injection/,
    ],
  ];
  for (const [slug, imagePattern, sourcePattern] of cases) {
    const image = syncScript.match(imagePattern)?.[1];
    assert.ok(image, `${slug} is not wired to its stock image`);
    assert.equal(
      existsSync(`public${image}`),
      true,
      `${image} is not committed`,
    );
    // The Pexels source URL is recorded beside the path, as provenance for the clinic.
    assert.match(syncScript, sourcePattern, `${slug} has no source URL`);
    assert.match(
      registry,
      new RegExp(image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      `${slug} is missing from content/booking-services.ts`,
    );
  }
});
