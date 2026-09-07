import { readFileSync, writeFileSync } from "node:fs";

const SOURCE_COMMIT = "953a40e";
const OUTPUT_PATH = "content/treatment-description-history.json";

function normalizeBulletLine(line) {
  if (!/(?<!\\)•/u.test(line)) return [line];

  const parts = line.split(/\s*(?<!\\)•\s*/u);
  const introduction = parts.shift()?.trimEnd() ?? "";
  const items = parts.map((part) => part.trim()).filter(Boolean);
  if (!items.length) return [line];

  const list = items.map((item) => `- ${item}`);
  return introduction ? [introduction, "", ...list] : list;
}

function normalizeRichTextMarkdown(value) {
  return value
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .flatMap(normalizeBulletLine)
    .join("\n")
    .replace(
      /(?<![\\\p{L}\p{N}])([\p{L}\p{N}]+)\*\*([\p{L}\p{N}%€][^*\n]*?)\*\*/gu,
      "**$1$2**",
    )
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (value += chunk));
    process.stdin.on("end", () => resolve(value));
    process.stdin.on("error", reject);
  });
}

function buildHistory(historical, current) {
  const descriptions = {};

  for (const [service, options] of Object.entries(historical.services)) {
    for (const [key, localized] of Object.entries(options)) {
      for (const [locale, treatment] of Object.entries(localized)) {
        const opening =
          current.services[service]?.[key]?.[locale]?.openingDescription;
        if (
          !opening ||
          treatment.description === opening ||
          normalizeRichTextMarkdown(treatment.description) !== opening
        ) {
          continue;
        }
        descriptions[service] ??= {};
        descriptions[service][key] ??= {};
        descriptions[service][key][locale] = treatment.description;
      }
    }
  }

  return {
    version: 1,
    sourceCommit: SOURCE_COMMIT,
    purpose:
      "Migration-only registry of exact historical source-owned treatment descriptions whose normalized Markdown is the current source opening.",
    descriptions,
  };
}

const historicalInput = await readStdin();
if (!historicalInput.trim()) {
  throw new Error(
    `Historical registry JSON is required on stdin. Run: git show ${SOURCE_COMMIT}:content/generated/treatment-details.json | node scripts/gen-treatment-description-history.mjs --check`,
  );
}

const current = JSON.parse(
  readFileSync("content/generated/treatment-details.json", "utf8"),
);
const generated = `${JSON.stringify(buildHistory(JSON.parse(historicalInput), current), null, 2)}\n`;

if (process.argv.includes("--write")) {
  writeFileSync(OUTPUT_PATH, generated);
} else if (process.argv.includes("--check")) {
  if (readFileSync(OUTPUT_PATH, "utf8") !== generated) {
    throw new Error(
      `${OUTPUT_PATH} does not match treatment descriptions at ${SOURCE_COMMIT}`,
    );
  }
} else {
  process.stdout.write(generated);
}
