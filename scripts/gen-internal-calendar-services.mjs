import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "internal-services.txt");
const translationsPath = resolve(
  root,
  "content/internal-calendar-services.i18n.json",
);
const outputPath = resolve(
  root,
  "content/generated/internal-calendar-services.json",
);

const preserved = new Map([
  [
    "Ruokatauko\u0000Ruokatauko",
    {
      key: "lunch",
      color: "#D8C5A8",
      defaultEnabled: true,
    },
  ],
  [
    "Henkilökohtainen meno\u0000Henkilökoh",
    {
      key: "personal",
      color: "#CBB8A6",
      defaultEnabled: true,
    },
  ],
  [
    "Työmeno\u0000Työmeno",
    {
      key: "errand",
      color: "#B7C7BD",
      defaultEnabled: true,
    },
  ],
  [
    "Sairasloma\u0000Sairasloma",
    {
      key: "sick",
      color: "#D6AAA0",
      defaultEnabled: true,
    },
  ],
  [
    "Loma\u0000Loma",
    {
      key: "vacation",
      color: "#B8C5D1",
      defaultEnabled: false,
    },
  ],
]);

function durationFromName(name) {
  const match = name.match(/(?:^|\D)(30|45|60|75)\s*min\b/i);
  return match ? Number(match[1]) : 60;
}

const [source, translationsSource] = await Promise.all([
  readFile(sourcePath, "utf8"),
  readFile(translationsPath, "utf8"),
]);
const translations = JSON.parse(translationsSource);
const lines = source.replace(/^\uFEFF/, "").split(/\r?\n/);
const dataLines = lines.slice(4).filter((line, index, all) => {
  return index < all.length - 1 || line.trim();
});

if (dataLines.length % 2 !== 0) {
  throw new Error("internal-services.txt must contain name/alias line pairs.");
}

const occurrences = new Map();
const catalog = [];
for (let index = 0; index < dataLines.length; index += 2) {
  const labelFi = dataLines[index].trim();
  const dragLabel = dataLines[index + 1].trim();
  if (!labelFi || !dragLabel) {
    throw new Error(
      `Missing service name or drag label at source row ${index / 2 + 1}.`,
    );
  }
  if (Array.from(dragLabel).length > 14) {
    throw new Error(`Drag label exceeds 14 characters: ${dragLabel}`);
  }

  const identity = `${labelFi}\u0000${dragLabel}`;
  const occurrence = (occurrences.get(identity) ?? 0) + 1;
  occurrences.set(identity, occurrence);
  const known = preserved.get(identity);
  const key =
    known?.key ??
    `timma-${createHash("sha256")
      .update(`${identity}\u0000${occurrence}`)
      .digest("hex")
      .slice(0, 16)}`;
  const translation = translations[key];
  if (!translation) {
    throw new Error(`Missing English/Russian translation for ${key}.`);
  }
  for (const field of ["labelEn", "labelRu", "dragLabelEn", "dragLabelRu"]) {
    if (typeof translation[field] !== "string" || !translation[field].trim()) {
      throw new Error(`Missing ${field} for ${key}.`);
    }
  }
  for (const field of ["dragLabelEn", "dragLabelRu"]) {
    if (Array.from(translation[field].trim()).length > 14) {
      throw new Error(`${field} exceeds 14 characters for ${key}.`);
    }
  }

  catalog.push({
    key,
    labelFi,
    labelEn: translation.labelEn.trim(),
    labelRu: translation.labelRu.trim(),
    dragLabel,
    dragLabels: {
      fi: dragLabel,
      en: translation.dragLabelEn.trim(),
      ru: translation.dragLabelRu.trim(),
    },
    defaultDurationMin: durationFromName(labelFi),
    color: known?.color ?? "#C7C2B8",
    defaultEnabled: known?.defaultEnabled ?? false,
    displayOrder: catalog.length,
  });
}

if (catalog.length !== 119) {
  throw new Error(
    `Expected 119 internal calendar services, received ${catalog.length}.`,
  );
}

const generatedKeys = new Set(catalog.map((service) => service.key));
const extraTranslations = Object.keys(translations).filter(
  (key) => !generatedKeys.has(key),
);
if (extraTranslations.length) {
  throw new Error(
    `Translations contain unknown catalog keys: ${extraTranslations.join(", ")}.`,
  );
}

await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Generated ${catalog.length} internal calendar services.`);
