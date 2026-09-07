import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import pagesData from "../content/generated/pages.json";
import productsData from "../content/generated/products.json";

type Locale = "en" | "fi" | "ru";
const pages = pagesData as Record<
  string,
  Partial<Record<Locale, { title: string; hero: string | null; body: string }>>
>;
const products = productsData as Array<{
  slug: string;
  size: string | null;
  price: number | null;
  image: string | null;
  i18n: Partial<Record<Locale, { name: string; description: string }>>;
}>;
const locales: Locale[] = ["en", "fi", "ru"];

test("page and product titles carry no YAML quoting", () => {
  // The archive quotes its front-matter values. Leaving the quotes attached
  // rendered them in every heading and broke the `in Helsinki` suffix strip on
  // the service cards, because the title no longer ended in "Helsinki".
  for (const [slug, localized] of Object.entries(pages))
    for (const locale of locales) {
      const title = localized[locale]?.title;
      if (!title) continue;
      assert.doesNotMatch(title, /^["']|["']$/u, `${slug}/${locale}: ${title}`);
      assert.equal(title, title.trim(), `${slug}/${locale}`);
    }
  for (const product of products)
    for (const locale of locales) {
      const name = product.i18n[locale]?.name;
      if (!name) continue;
      assert.doesNotMatch(name, /^["']|["']$/u, `${product.slug}/${locale}`);
    }
});

test("the `in Helsinki` suffix strip still reaches the service cards", () => {
  const cards = readFileSync("app/(public)/[locale]/palvelut/page.tsx", "utf8");
  assert.match(cards, /replace\(\/\\s\+in\\s\+Helsinki\$\/i, ""\)/);
  const suffixed = Object.values(pages).filter((localized) =>
    /\s+in\s+Helsinki$/i.test(localized.en?.title ?? ""),
  );
  assert.ok(
    suffixed.length >= 5,
    "no English title ends in 'in Helsinki' any more; the card strip is now dead code",
  );
});

test("no page repeats its own title as a body heading", () => {
  for (const [slug, localized] of Object.entries(pages))
    for (const locale of locales) {
      const page = localized[locale];
      if (!page) continue;
      const heading = page.body.match(/^#\s+([^\n]+)/u)?.[1];
      if (!heading) continue;
      const normalize = (value: string) =>
        value
          .replace(/\*\*|__|[*_`]/gu, "")
          .replace(/\s+/gu, " ")
          .trim()
          .toLowerCase();
      assert.notEqual(
        normalize(heading),
        normalize(page.title),
        `${slug}/${locale} renders its title twice`,
      );
    }
});

test("every product has its description in every locale", () => {
  // The description used to be the first `## ` section alone. English and
  // Finnish put the whole body under "## Description" with `###` subheadings,
  // but the Russian pages open a second `##` right after "## Описание", so that
  // first section was nothing but its own heading: four Russian products
  // shipped an entirely empty description and a fifth lost its instructions.
  const generator = readFileSync("scripts/gen-content.mjs", "utf8");
  assert.match(generator, /isCrossSell/u);
  assert.doesNotMatch(generator, /const block = parts\[1\]/u);

  for (const product of products)
    for (const locale of locales) {
      const copy = product.i18n[locale];
      assert.ok(copy, `${product.slug} has no ${locale} record`);
      assert.ok(
        copy.description.trim().length > 200,
        `${product.slug}/${locale} description is ${copy.description.length} chars`,
      );
      // The trailing cross-sell list belongs to the catalogue, not the product.
      assert.ok(
        (copy.description.match(/\]\(\/(?:[A-Z]{2}\/)?catalog\//gu) ?? [])
          .length < 2,
        `${product.slug}/${locale} carries the cross-sell list`,
      );
    }

  // Sections beyond the first survive, which is what the Russian pages need.
  const russianMultiSection = products.filter((product) =>
    /^## /mu.test(product.i18n.ru?.description ?? ""),
  );
  assert.ok(
    russianMultiSection.length >= 5,
    `only ${russianMultiSection.length} Russian products kept a later section`,
  );
});

test("product size and price come from the product's own page", () => {
  // The generator used to cut the page at the literal "## See also", which only
  // matches English. Finnish and Russian kept the whole cross-sell list, so ten
  // products were given a size printed on a neighbouring product's card.
  const generator = readFileSync("scripts/gen-content.mjs", "utf8");
  assert.doesNotMatch(generator, /split\("\\n## See also"\)/u);

  for (const product of products) {
    if (product.size)
      assert.match(
        product.size,
        /^\d+(?:[.,]\d+)?\s*(?:ml|phials|pcs)?$/iu,
        product.slug,
      );
    // Where the slug states the volume, the extracted size must agree with it.
    const fromSlug = product.slug.match(/(\d+)ml/iu)?.[1];
    if (fromSlug)
      assert.equal(
        product.size?.replace(/[^\d]/gu, ""),
        fromSlug,
        `${product.slug} size disagrees with its own slug`,
      );
    assert.ok(product.price && product.price > 0, product.slug);
  }
  assert.equal(products.length, 31);
});
