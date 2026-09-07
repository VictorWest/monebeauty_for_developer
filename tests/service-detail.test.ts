import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  SERVICE_PUBLIC_PATHS,
  serviceLandingContentPath,
} from "../lib/public-routes";

const detail = readFileSync(
  "components/services/ServiceDetailPage.tsx",
  "utf8",
);
const information = readFileSync(
  "components/services/TreatmentInformation.tsx",
  "utf8",
);
const selector = readFileSync(
  "components/services/ServiceCourseCards.tsx",
  "utf8",
);
const serviceRoute = readFileSync(
  "app/(public)/[locale]/palvelut/[slug]/page.tsx",
  "utf8",
);
const sitemap = readFileSync("app/sitemap.ts", "utf8");

test("service detail keeps one full-bleed hero image and one h1", () => {
  assert.match(detail, /min-h-\[clamp\(380px,56vh,600px\)\]/);
  assert.match(detail, /fill\s+priority/);
  assert.match(detail, /sizes="100vw"/);
  assert.equal((detail.match(/<h1/g) ?? []).length, 1);
  assert.doesNotMatch(detail, /TreatmentCard|procedureMedia|treatmentImages/);
});

test("approved overview and cards precede the remaining detailed information", () => {
  assert.ok(
    detail.indexOf("<Markdown>{categoryOverview}</Markdown>") <
      detail.indexOf("<ServiceCourseCards"),
  );
  assert.ok(
    detail.indexOf("<ServiceCourseCards") <
      detail.indexOf("<TreatmentInformation"),
  );
  assert.match(detail, /showWhatItIs=\{false\}/);
  assert.match(information, /content\.whatItIs/);
  assert.match(information, /content\.suitableFor/);
  assert.match(information, /content\.benefits/);
  assert.match(information, /content\.contraindications/);
  assert.match(information, /content\.preCare/);
  assert.match(information, /content\.postCare/);
  assert.match(information, /parseFaq/);
});

test("the Endospheres page reads description, photos, book, then results", () => {
  // Requested by the clinic: the treatment is explained and shown before the
  // visitor is asked to book, and the before/after results close the page.
  const editorial = detail.indexOf("<EndospheresEditorial");
  const book = detail.indexOf("{bookCopy[locale].heading}");
  const cards = detail.indexOf("<ServiceCourseCards", book);
  const results = detail.indexOf("<BeforeAfterGallery");
  assert.ok(editorial > 0 && book > 0 && cards > 0 && results > 0);
  assert.ok(editorial < book, "the description must precede the booking call");
  assert.ok(book < cards, "the booking call must precede the treatment cards");
  assert.ok(cards < results, "before/after results close the page");
});

test("before/after pairs are admin-supplied and hidden until complete", () => {
  const gallery = readFileSync(
    "components/endospheres/BeforeAfterGallery.tsx",
    "utf8",
  );
  const media = readFileSync("content/site-media.ts", "utf8");
  // No such photograph exists in the archive, so the slots carry no fallback
  // and the section stays off the page until the clinic uploads a real pair.
  assert.match(gallery, /if \(!pairs\.length\) return null;/);
  assert.match(gallery, /before\?\.image && after\?\.image/);
  assert.match(media, /endospheres\.beforeafter\.\$\{pair\}\.\$\{phase\}/);
  assert.match(media, /fallback: null/);
  for (const pair of [1, 2, 3])
    for (const phase of ["before", "after"])
      assert.ok(
        gallery.includes(`endospheres.beforeafter.$\{pair}.${phase}`),
        `pair ${pair} ${phase} is not read by the gallery`,
      );
});

test("Body Treatments resolves to the complete same-locale Endospheres landing", () => {
  assert.equal(
    serviceLandingContentPath(SERVICE_PUBLIC_PATHS.body),
    SERVICE_PUBLIC_PATHS.endospheres,
  );
  assert.equal(
    serviceLandingContentPath(SERVICE_PUBLIC_PATHS.facial),
    SERVICE_PUBLIC_PATHS.facial,
  );

  assert.match(
    serviceRoute,
    /const path = serviceLandingContentPath\(requestedPath\)/,
  );
  assert.match(
    serviceRoute,
    /getPublishedServiceByPath\(path, locale as Locale\)/,
  );
  assert.match(serviceRoute, /getIndexableServiceLocales\(path\)/);
  assert.match(serviceRoute, /managedLocalizedMetadata\(\{[\s\S]*path,/);
  assert.match(
    serviceRoute,
    /const path = serviceLandingContentPath\(`\$\{PUBLIC_PATHS\.services\}\/\$\{slug\}`\)/,
  );
  assert.match(serviceRoute, /slug=\{path\.slice\(1\)\}/);

  assert.match(
    detail,
    /const canonical = absoluteLocalizedUrl\(siteUrl\(\), path, locale\)/,
  );
  assert.match(detail, /query: \{ service: service\.slug \}/);
  assert.match(detail, /serviceKey=\{service\.slug\}/);
  assert.doesNotMatch(detail, /service\.slug === "body"/);
  assert.doesNotMatch(detail, /LaserBodyZones|EndospheresBodyAppendix/);
  assert.equal(
    existsSync("components/services/EndospheresBodyAppendix.tsx"),
    false,
  );
  assert.equal(existsSync("components/services/LaserBodyZones.tsx"), false);

  assert.match(
    sitemap,
    /row\.service\.publicPath !== SERVICE_PUBLIC_PATHS\.body/,
  );
  assert.match(
    sitemap,
    /entries\.filter\(\(entry\) => entry\.path !== SERVICE_PUBLIC_PATHS\.body\)/,
  );
  assert.match(sitemap, /treatmentOptionPath\(/);
});

test("responsive cards use a whole-card treatment detail link", () => {
  assert.match(
    selector,
    /grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3/,
  );
  assert.match(selector, /soleOption && "sm:grid-cols-1 xl:grid-cols-1"/);
  assert.match(
    selector,
    /treatmentOptionPath\([\s\S]*servicePath,[\s\S]*option\.key/,
  );
  assert.doesNotMatch(selector, /procedure:/);
  assert.match(selector, /<Link/);
  assert.match(selector, /option\.summary/);
  assert.match(selector, /details: "View details"/);
  assert.match(selector, /focus-visible:outline-2/);
  assert.match(selector, /motion-reduce:transition-none/);
  assert.doesNotMatch(selector, /<Image/);
  assert.doesNotMatch(selector, /firstVisit/);
  assert.match(selector, /pathname: "\/ajanvaraus"/);
  assert.match(selector, /service: serviceKey/);
  assert.match(selector, /option: option\.key/);
  assert.match(selector, /absolute inset-0/);
  assert.match(selector, /relative z-10/);
  assert.doesNotMatch(selector, /line-clamp-(?:2|6)/);
  assert.doesNotMatch(selector, /hover:border-accent/);
});
