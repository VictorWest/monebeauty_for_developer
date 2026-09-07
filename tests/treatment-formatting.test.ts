import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "../components/Markdown";
import {
  extractMarkdownSummary,
  malformedRichTextPattern,
  normalizeRichTextMarkdown,
  promoteTreatmentDetailSectionHeadings,
  removeRepeatedMarkdownSummary,
} from "../lib/markdown-normalization";
import { groupTreatmentOptions } from "../lib/treatment-groups";

test("legacy bullets become Markdown lists while escaped bullets remain literal", () => {
  assert.equal(
    normalizeRichTextMarkdown("Includes: • **First item** • Second item"),
    "Includes:\n\n- **First item**\n- Second item",
  );
  assert.equal(
    normalizeRichTextMarkdown(String.raw`Keep \• as supplied`),
    String.raw`Keep \• as supplied`,
  );
});

test("known malformed strong boundaries are repaired without changing wording", () => {
  assert.equal(
    normalizeRichTextMarkdown("The package is 1**0 % cheaper**."),
    "The package is **10 % cheaper**.",
  );
  assert.equal(
    normalizeRichTextMarkdown("The package is 10**% more выгоднее**."),
    "The package is **10% more выгоднее**.",
  );
});

test("legacy treatment section labels become level-two headings", () => {
  assert.equal(
    promoteTreatmentDetailSectionHeadings(`**Benefits of the treatment:**

- First benefit

**What results can you expect?**

- First result

**Course:**
A course of six sessions.`),
    `## Benefits of the treatment:

- First benefit

## What results can you expect?

- First result

## Course:
A course of six sessions.`,
  );
});

test("treatment heading promotion preserves inline and ordinary emphasis", () => {
  const source = `- **Mechanical cleansing:** performed manually

**Important medical emphasis.**

Paragraph with **inline emphasis:** unchanged.`;

  assert.equal(promoteTreatmentDetailSectionHeadings(source), source);
});

test("treatment detail headings share one semantic and visual h2 treatment", () => {
  const html = renderToStaticMarkup(
    Markdown({
      variant: "treatment-detail",
      children: `**Benefits of the treatment:**

Recorded benefit.

**What results can you expect?**

Recorded result.

**Course:**
Six sessions.

## What the treatment is and how it works

Description.`,
    }),
  );
  const headings = [...html.matchAll(/<h2 class="([^"]+)">([^<]+)<\/h2>/gu)];

  assert.deepEqual(
    headings.map((heading) => heading[2]),
    [
      "Benefits of the treatment:",
      "What results can you expect?",
      "Course:",
      "What the treatment is and how it works",
    ],
  );
  assert.equal(new Set(headings.map((heading) => heading[1])).size, 1);
});

test("every generated localized treatment promotes eligible legacy labels", () => {
  const registry = JSON.parse(
    readFileSync("content/generated/treatment-details.json", "utf8"),
  ) as {
    services: Record<
      string,
      Record<string, Record<string, { description: string }>>
    >;
  };
  let localizedRecords = 0;
  let promotedLabels = 0;

  for (const options of Object.values(registry.services)) {
    for (const localized of Object.values(options)) {
      for (const treatment of Object.values(localized)) {
        localizedRecords += 1;
        const normalized = normalizeRichTextMarkdown(treatment.description);
        promotedLabels +=
          normalized.match(/^\*\*[^*\n]+[:?]\*\*[\t \u00a0]*(?=\n|$)/gmu)
            ?.length ?? 0;
        assert.doesNotMatch(
          promoteTreatmentDetailSectionHeadings(normalized),
          /^\*\*[^*\n]+[:?]\*\*[\t \u00a0]*(?=\n|$)/mu,
        );
      }
    }
  }

  assert.equal(localizedRecords, 361);
  assert.ok(promotedLabels > 0);
});

test("summary extraction preserves paragraphs, list structure, and bold markup", () => {
  const summary = extractMarkdownSummary(`The package includes:

- **Body diagnostics** and composition analysis
- **Personalized nutrition plan** from a nutritionist
- **12 Endospheres sessions**
- **6 pressotherapy sessions**
- **Personal training** and trainer support
- **Ongoing expert guidance** throughout the program`);

  assert.match(
    summary,
    /^The package includes:\n\n- \*\*Body diagnostics\*\*/u,
  );
  assert.equal(
    summary.split("\n").filter((line) => line.startsWith("- ")).length,
    6,
  );
  assert.doesNotMatch(summary, malformedRichTextPattern);
});

test("repeated summary removal consumes complete paragraph and list prefixes", () => {
  const paragraph = "A complete introductory paragraph.";
  assert.equal(
    removeRepeatedMarkdownSummary(
      `${paragraph}\n\n**Advantages of the procedure:**\n\n- First`,
      paragraph,
    ),
    "**Advantages of the procedure:**\n\n- First",
  );

  const listSummary = "The package includes:\n\n- First\n- Second";
  assert.equal(
    removeRepeatedMarkdownSummary(
      `${listSummary}\n\n## Safety\n\nAsk the clinic.`,
      listSummary,
    ),
    "## Safety\n\nAsk the clinic.",
  );
  assert.equal(
    removeRepeatedMarkdownSummary("Owner-edited opening", paragraph),
    "Owner-edited opening",
  );
  assert.equal(
    removeRepeatedMarkdownSummary(
      `### Introductory heading\n\n${paragraph}\n\n## Safety`,
      paragraph,
    ),
    "### Introductory heading\n\n## Safety",
  );
});

test("the shared summary renderer produces emphasis and a semantic list", () => {
  const html = renderToStaticMarkup(
    Markdown({
      variant: "treatment-summary",
      children: "Includes **important text**:\n\n- First\n- Second",
    }),
  );

  assert.match(html, /<strong[^>]*>important text<\/strong>/u);
  assert.match(html, /<ul[^>]*>[\s\S]*<li[^>]*>First<\/li>/u);
  assert.doesNotMatch(html, /\*\*/u);
});

test("generated Reset summaries retain a real multiline list", () => {
  const registry = JSON.parse(
    readFileSync("content/generated/treatment-details.json", "utf8"),
  ) as {
    services: {
      packages: Record<string, Record<"fi" | "en" | "ru", { summary: string }>>;
    };
  };
  const reset = registry.services.packages["reset-course"];

  for (const locale of ["fi", "en", "ru"] as const) {
    assert.match(reset[locale].summary, /\n- \*\*/u, locale);
    assert.doesNotMatch(
      reset[locale].summary,
      malformedRichTextPattern,
      locale,
    );
  }
});

test("treatment groups sort by size stably, preserve items, and put Other last", () => {
  const options = [
    { id: "a1", group: " Alpha " },
    { id: "b1", group: "Beta" },
    { id: "a2", group: "Alpha" },
    { id: "g1", group: "Gamma" },
    { id: "b2", group: "Beta" },
    { id: "o1", group: "Other treatments" },
    { id: "o2", group: null },
    { id: "o3", group: "Other treatments" },
  ];
  const groups = groupTreatmentOptions(options, "Other treatments");

  assert.deepEqual(
    groups.map((group) => group.name),
    ["Alpha", "Beta", "Gamma", "Other treatments"],
  );
  assert.deepEqual(
    groups[0].options.map((option) => option.id),
    ["a1", "a2"],
  );
  assert.deepEqual(
    groups.at(-1)?.options.map((option) => option.id),
    ["o1", "o2", "o3"],
  );
});
