import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  localizedMetadata,
  medicalClinicJsonLd,
  productJsonLd,
  siteUrl,
} from "../lib/seo";
import { renderSitemap } from "../lib/sitemap";

test("localized metadata supplies canonical, hreflang, social cards and robots", () => {
  const site = siteUrl();
  const metadata = localizedMetadata({
    locale: "en",
    path: "/palvelut/kasvohoidot",
    title: "Facial treatments in Helsinki",
    description: "Approved localized description",
    image: "/media/home/facial.jpg",
    imageAlt: "Facial treatment",
    indexable: false,
  });

  assert.equal(
    metadata.alternates?.canonical,
    `${site}/en/palvelut/kasvohoidot`,
  );
  assert.equal(
    metadata.alternates?.languages?.fi,
    `${site}/palvelut/kasvohoidot`,
  );
  assert.equal(
    metadata.robots && typeof metadata.robots === "object"
      ? metadata.robots.index
      : null,
    false,
  );
  assert.equal(
    (metadata.openGraph as { type?: string } | undefined)?.type,
    "website",
  );
  assert.equal(
    (metadata.twitter as { card?: string } | undefined)?.card,
    "summary_large_image",
  );
});

test("sitemap output deduplicates URLs and exposes only available translations", () => {
  const site = siteUrl();
  const updatedAt = new Date("2026-07-31T12:00:00.000Z");
  const sitemap = renderSitemap([
    { path: "/verkkokauppa", locale: "fi" },
    { path: "/verkkokauppa", locale: "en", updatedAt },
    {
      path: "/verkkokauppa",
      locale: "en",
      image: "/media/home/arosha.jpg",
    },
  ]);

  assert.equal(sitemap.length, 2);
  const english = sitemap.find(
    (entry) => new URL(entry.url.toString()).pathname === "/en/verkkokauppa",
  );
  assert.ok(english);
  assert.deepEqual(english.images, [`${site}/media/home/arosha.jpg`]);
  assert.equal(english.lastModified, updatedAt);
  assert.equal(
    english.alternates?.languages?.["x-default"],
    `${site}/verkkokauppa`,
  );
  assert.equal(english.alternates?.languages?.ru, undefined);
});

test("sitemap policy includes the shop and excludes legal and test URLs", () => {
  const source = readFileSync("app/sitemap.ts", "utf8");
  assert.match(source, /PUBLIC_PATHS\.shop/);
  assert.doesNotMatch(source, /PUBLIC_PATHS\.privacy/);
  assert.doesNotMatch(source, /PUBLIC_PATHS\.terms/);
  assert.doesNotMatch(source, /PUBLIC_PATHS\.cookies/);
  assert.match(source, /stripe-checkout-test-item/);
  assert.match(source, /seoIndexable: true/);
  assert.match(
    source,
    /row\.service\.publicPath !== SERVICE_PUBLIC_PATHS\.body/,
  );
  assert.match(
    source,
    /entries\.filter\(\(entry\) => entry\.path !== SERVICE_PUBLIC_PATHS\.body\)/,
  );
  assert.match(source, /treatmentOptionPath\(/);
});

test("products emit Product schema and clinic hours are not fabricated", () => {
  const product = productJsonLd({
    name: "AROSHA product",
    description: "Approved product description",
    url: "https://monebeauty.fi/verkkokauppa/product",
    image: "/media/images/photo/5.jpg",
    price: 49,
    currency: "EUR",
    brand: "AROSHA",
  });
  assert.equal(product["@type"], "Product");
  assert.equal(product.offers.price, "49.00");
  assert.equal(product.offers.priceCurrency, "EUR");

  const clinic = medicalClinicJsonLd();
  assert.equal("openingHoursSpecification" in clinic, false);
  assert.equal(clinic.address.addressLocality, "Helsinki");
});

test("localized CMS records expose an explicit search-indexing control", () => {
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const admin = readFileSync("components/admin/AdminRouter.tsx", "utf8");
  assert.equal((schema.match(/seoIndexable\s+Boolean/g) ?? []).length, 5);
  assert.match(admin, /name=\{`seoIndexable_\$\{locale\}`\}/);
});
