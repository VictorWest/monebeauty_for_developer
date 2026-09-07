import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import pages from "../content/generated/pages.json";
import { PROCEDURE_MEDIA_SEED } from "../content/procedure-media";
import type { Locale } from "../i18n/routing";
import { resolveProcedureImage } from "../lib/procedure-media";
import { parseProcedures } from "../lib/procedures";

const locales: Locale[] = ["en", "fi", "ru"];
const services = {
  facial: "services/face",
  body: "services/body",
  trichology: "services/tricho",
  laser: "services/laser",
  rf: "services/mikroneulanrf",
  brows: "services/eyebrows",
  packages: "services/packages",
} as const;

test("every localized treatment card has a specific non-adjacent image", () => {
  let procedureCount = 0;
  for (const [serviceSlug, page] of Object.entries(services)) {
    for (const locale of locales) {
      const procedures = parseProcedures(pages[page][locale].body);
      const images = procedures.map((procedure) =>
        resolveProcedureImage({
          serviceSlug,
          locale,
          procedure,
          records: [],
        }),
      );
      procedureCount += procedures.length;
      assert.equal(images.every(Boolean), true, `${serviceSlug}/${locale}`);
      assert.equal(
        images.some((image, index) => index > 0 && image === images[index - 1]),
        false,
        `${serviceSlug}/${locale} repeats adjacent imagery`,
      );
    }
  }
  // 341, up from 331. Ten Finnish cards were being dropped: eight packages
  // whose titles ("30 minuutin hoitopaketit 6 kerta") were read as price lines
  // and so closed a card that had never opened, plus the eyebrow tinting
  // combination and the "Uudistuminen" package, which title themselves with
  // `###` and were taken for group headings.
  assert.equal(procedureCount, 341);
});

test("procedure media uses 51 committed images with provenance", () => {
  const images = new Set(PROCEDURE_MEDIA_SEED.map((item) => item.image));
  assert.equal(images.size, 51);
  for (const item of PROCEDURE_MEDIA_SEED) {
    assert.match(item.image, /^\/media\//);
    assert.match(item.sourceUrl, /^https:\/\//);
    assert.match(
      item.sourceLicense,
      /^(CLIENT_SUPPLIED|CLINIC_ARCHIVE|PEXELS)$/,
    );
    assert.equal(existsSync(`public${item.image}`), true, item.image);
  }
  // Four stock photos across five seed entries: the Endospheres one illustrates both the
  // body and the packages procedure lists.
  assert.equal(
    PROCEDURE_MEDIA_SEED.filter((item) => item.sourceLicense === "PEXELS")
      .length,
    5,
  );
});

test("laser treatments use client-supplied photos matched to each body area", () => {
  const expected = [
    "face",
    "chin",
    "face",
    "neck",
    "face",
    "chin",
    "face",
    "neck",
    "upper-body",
    "neck",
    "upper-body",
    "underarm",
    "upper-body",
    "underarm",
    "upper-body",
    "underarm",
    "upper-arm",
    "forearm",
    "full-arm",
    "underarm",
    "upper-body",
    "lower-body",
    "upper-body",
    "lower-body",
    "bikini",
    "thigh-closeup",
    "bikini",
    "lower-body",
    "thigh",
    "lower-leg",
    "full-leg",
    "underarm",
    "bikini",
    "lower-body",
    "full-leg",
    "lower-body",
  ].map((area) => `/media/clinic/laser/laser-${area}-hair-removal.jpeg`);

  for (const locale of locales) {
    const procedures = parseProcedures(pages["services/laser"][locale].body);
    const images = procedures.map((procedure) =>
      resolveProcedureImage({
        serviceSlug: "laser",
        locale,
        procedure,
        records: [],
      }),
    );
    assert.deepEqual(images, expected, `laser/${locale}`);
  }
});

test("laser packages use locale-aware client-supplied photography", () => {
  const expected = [
    "face",
    "chin",
    "underarm",
    "bikini",
    "underarm",
    "bikini",
    "lower-body",
    "full-leg",
    "lower-body",
    "full-leg",
    "upper-arm",
    "lower-body",
  ].map((area) => `/media/clinic/laser/laser-${area}-hair-removal.jpeg`);

  for (const locale of locales) {
    const procedures = parseProcedures(pages["services/packages"][locale].body);
    const laserPackages = procedures.slice(-expected.length);
    const images = laserPackages.map((procedure) =>
      resolveProcedureImage({
        serviceSlug: "packages",
        locale,
        procedure,
        records: [],
      }),
    );
    assert.deepEqual(images, expected, `packages/${locale}`);
  }
});

test("all fourteen unique client-supplied laser photographs are registered", () => {
  const images = new Set(
    PROCEDURE_MEDIA_SEED.filter(
      (item) => item.sourceLicense === "CLIENT_SUPPLIED",
    ).map((item) => item.image),
  );
  assert.equal(images.size, 14);
  assert.equal(
    [...images].every((image) => image.startsWith("/media/clinic/laser/")),
    true,
  );

  const files = readdirSync("public/media/clinic/laser").sort();
  const hashes = files.map((file) =>
    createHash("sha256")
      .update(readFileSync(`public/media/clinic/laser/${file}`))
      .digest("hex"),
  );
  assert.equal(files.length, 14);
  assert.equal(new Set(hashes).size, 14);
});

test("laser bootstrap media stays client-supplied while runtime media is database-owned", () => {
  for (const locale of locales) {
    const page = pages["instrumental/laser"][locale];
    assert.equal(
      page.hero,
      "/media/clinic/laser/laser-forearm-hair-removal.jpeg",
    );
    const images = [
      ...page.body.matchAll(/!\[[^\]]*\]\((\/media\/[^)\s]+)\)/g),
    ].map((match) => match[1]);
    assert.equal(images.length, 9);
    assert.equal(
      images.every((image) => image.startsWith("/media/clinic/laser/")),
      true,
    );
  }

  const booking = readFileSync("content/booking-services.ts", "utf8");
  const home = readFileSync("components/home/HomeSections.tsx", "utf8");
  const service = readFileSync(
    "components/services/ServiceDetailPage.tsx",
    "utf8",
  );
  const sync = readFileSync("scripts/sync-cms-from-generated.ts", "utf8");
  assert.match(booking, /laser-upper-arm-hair-removal\.jpeg/);
  assert.match(home, /laser-forearm-hair-removal\.jpeg/);
  assert.match(service, /const heroImage = service\.images\[0\]/);
  assert.doesNotMatch(service, /laser-upper-arm-hair-removal\.jpeg/);
  assert.match(sync, /definition\.slug === "laser"[\s\S]*laserArticleImages/);
  assert.match(
    sync,
    /const forceImages = process\.argv\.includes\("--force-images"\)/,
  );
});

test("saved procedure media overrides bootstrap without relying on order", () => {
  const definition = PROCEDURE_MEDIA_SEED.find(
    (item) => item.serviceSlug === "body" && item.identities.en.length > 0,
  );
  assert.ok(definition);
  const procedure = definition.identities.en[0];
  const resolved = resolveProcedureImage({
    serviceSlug: "body",
    locale: "en",
    procedure: { ...procedure, description: "", price: "" },
    records: [
      { key: definition.key, image: "/media/custom.jpg", identities: {} },
      {
        key: definition.key,
        image: "/media/override.jpg",
        identities: definition.identities,
      },
    ].reverse(),
  });
  assert.equal(resolved, "/media/override.jpg");
});
