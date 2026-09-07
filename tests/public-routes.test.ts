import assert from "node:assert/strict";
import test from "node:test";
import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  canonicalInternalHref,
  canonicalizeLegacyPublicPath,
  contentPagePath,
  productPath,
} from "../lib/public-routes";

test("canonical public paths use Finnish route segments", () => {
  assert.equal(PUBLIC_PATHS.basket, "/ostoskori");
  assert.equal(PUBLIC_PATHS.booking, "/ajanvaraus");
  assert.equal(PUBLIC_PATHS.shop, "/verkkokauppa");
  assert.equal(SERVICE_PUBLIC_PATHS.facial, "/palvelut/kasvohoidot");
  assert.equal(
    productPath("stable-product-slug"),
    "/verkkokauppa/stable-product-slug",
  );
});

test("legacy public paths redirect with locale and dynamic identifiers intact", () => {
  assert.equal(canonicalizeLegacyPublicPath("/basket"), "/ostoskori");
  assert.equal(
    canonicalizeLegacyPublicPath("/en/services/face"),
    "/en/palvelut/kasvohoidot",
  );
  assert.equal(
    canonicalizeLegacyPublicPath("/ru/catalog/stretch-marks-200ml-1"),
    "/ru/verkkokauppa/stretch-marks-200ml-1",
  );
  assert.equal(
    canonicalizeLegacyPublicPath("/order/order-123"),
    "/tilaus/order-123",
  );
  assert.equal(canonicalizeLegacyPublicPath("/ostoskori"), null);
});

test("scraped internal links use the current locale and canonical Finnish path", () => {
  assert.equal(
    canonicalInternalHref("/EN/services/body/?source=page#details"),
    "/palvelut/vartalohoidot?source=page#details",
  );
  assert.equal(
    canonicalInternalHref("/RU/catalog/product-slug"),
    "/verkkokauppa/product-slug",
  );
  assert.equal(
    canonicalInternalHref("https://example.com/services/body"),
    "https://example.com/services/body",
  );
});

test("database content keys map to public Finnish paths without being renamed", () => {
  assert.equal(contentPagePath("home"), "/");
  assert.equal(contentPagePath("about"), "/klinikka");
  assert.equal(
    contentPagePath("instrumental/laser"),
    "/laitehoidot/laserkarvanpoisto",
  );
  assert.equal(
    contentPagePath("services/eyebrows"),
    "/palvelut/kulmat-ja-ripset",
  );
});
