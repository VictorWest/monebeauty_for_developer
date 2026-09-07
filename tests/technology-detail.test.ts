import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const detail = readFileSync(
  "components/technology/TechnologyDetailPage.tsx",
  "utf8",
);

test("technology detail shares the one-image information-first structure", () => {
  assert.match(detail, /min-h-\[clamp\(420px,58vh,640px\)\]/);
  assert.match(detail, /fill\s+priority/);
  assert.equal((detail.match(/<h1/g) ?? []).length, 1);
  assert.ok(
    detail.indexOf("<TreatmentInformation") <
      detail.indexOf("<ServiceOptionSelector"),
  );
  assert.doesNotMatch(detail, /bookHref|primaryOnDark|nav:sticky/);
});

test("ordinary technology copy remains database-owned and localized", () => {
  assert.match(detail, /technology\.content\.body/);
  assert.match(detail, /<Markdown variant="technology">/);
  assert.match(detail, /technology\.slug === "endospheres"/);
  assert.match(detail, /<TechnologyEditorial/);
  assert.match(detail, /technology\.relatedService\?\.options/);
});
