import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient, type Locale } from "@prisma/client";
import { SERVICE_OVERVIEWS } from "../content/service-overviews";
import { AUTHORED_PAGES } from "../content/authored-pages";
import { TREATMENT_SOURCE_VERSION } from "../content/treatment-provenance";
import {
  isRetiredGeneratedTreatmentCopy,
  isSourceOwnedTreatmentDescription,
  isSourceOwnedTreatmentSummary,
} from "../content/treatment-sync-guard";
import {
  ENDOSPHERES_OPTION_SEED,
  PACKAGES_OPTION_SEED,
  SERVICE_MIGRATION_PAGES,
  STANDALONE_APPOINTMENT_OPTION_SEED,
  TREATMENT_MIGRATION_SOURCES,
  maximumPublishedDuration,
} from "../content/treatment-option-migration";
import { parseProcedures } from "../lib/procedures";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const locales = ["en", "fi", "ru"] as const;
type TreatmentDetail = {
  legacyIndex: number;
  group: string | null;
  name: string;
  durationLabel: string | null;
  priceLabel: string;
  summary: string;
  description: string;
  sourceUrl: string;
  scrapedAt: string;
  openingDescription: string;
  provenanceSourceIds: string[];
};
const detailRegistry = JSON.parse(
  readFileSync(
    join(process.cwd(), "content/generated/treatment-details.json"),
    "utf8",
  ),
) as {
  services: Record<
    string,
    Record<string, Partial<Record<Locale, TreatmentDetail>>>
  >;
};
const generated = JSON.parse(
  readFileSync(join(process.cwd(), "content/generated/pages.json"), "utf8"),
) as Record<string, Partial<Record<Locale, { body: string }>>>;
const summaryHistory = JSON.parse(
  readFileSync(
    join(process.cwd(), "content/treatment-summary-history.json"),
    "utf8",
  ),
) as {
  sourceCommit: string;
  summaries: Record<string, Record<string, Partial<Record<Locale, string>>>>;
};
const descriptionHistory = JSON.parse(
  readFileSync(
    join(process.cwd(), "content/treatment-description-history.json"),
    "utf8",
  ),
) as {
  sourceCommit: string;
  descriptions: Record<string, Record<string, Partial<Record<Locale, string>>>>;
};

async function main() {
  const services = await prisma.service.findMany({
    include: { contents: true, options: { include: { contents: true } } },
  });
  let writes = 0;
  let skipped = 0;
  for (const service of services) {
    for (const content of service.contents) {
      const overview = SERVICE_OVERVIEWS[service.slug]?.[content.locale];
      if (!overview || content.whatItIs === overview) {
        skipped += 1;
        continue;
      }
      const importedAggregate = SERVICE_MIGRATION_PAGES[service.slug]
        ? generated[SERVICE_MIGRATION_PAGES[service.slug]]?.[content.locale]
            ?.body
        : undefined;
      const authoredAggregate =
        AUTHORED_PAGES[`services/${service.slug}`]?.[content.locale]?.body;
      const sourceOwned =
        !content.whatItIs.trim() ||
        isRetiredGeneratedTreatmentCopy(content.whatItIs) ||
        content.whatItIs === importedAggregate ||
        content.whatItIs === authoredAggregate;
      if (!sourceOwned) {
        skipped += 1;
        continue;
      }
      console.log(
        `${apply ? "WRITE" : "WOULD WRITE"} ${service.slug}/${content.locale} category overview`,
      );
      if (apply)
        await prisma.treatmentContent.update({
          where: { id: content.id },
          data: { whatItIs: overview },
        });
      writes += 1;
    }
    if (service.slug === "endospheres") {
      // These options are keyed by duration ("30", "package-60-6"), not by the
      // registry's treatment keys, so the detail sync below never reaches them
      // and they were published with no card text at all. Fill them from the
      // clinic's PDF, and only where nothing has been written yet.
      for (const seed of ENDOSPHERES_OPTION_SEED) {
        const existing = service.options.find((item) => item.key === seed.key);
        if (!existing) continue;
        for (const current of existing.contents) {
          const summary = seed.labels[current.locale]?.summary;
          if (!summary || current.summary.trim()) continue;
          console.log(
            `${apply ? "WRITE" : "WOULD WRITE"} endospheres/${seed.key}/${current.locale} card summary`,
          );
          if (apply)
            await prisma.serviceOptionContent.update({
              where: { id: current.id },
              data: { summary },
            });
          writes += 1;
        }
      }
      for (const seed of ENDOSPHERES_OPTION_SEED.filter(
        (item) => item.type === "COURSE",
      )) {
        const existing = service.options.find((item) => item.key === seed.key);
        if (
          !existing ||
          existing.type !== "INFORMATIONAL_PACKAGE" ||
          existing.bookable ||
          existing.bookingDurationMin !== null ||
          !matchesEndospheresSourceContent(existing.contents, seed)
        ) {
          skipped += 1;
          continue;
        }
        const bookingServiceId = services.find(
          (item) => item.slug === seed.bookingServiceSlug,
        )?.id;
        if (!bookingServiceId) {
          console.warn(
            `SKIP endospheres/${seed.key}: scheduling service ${seed.bookingServiceSlug} is missing`,
          );
          skipped += 1;
          continue;
        }
        console.log(
          `${apply ? "WRITE" : "WOULD WRITE"} endospheres/${seed.key} first-visit course`,
        );
        if (apply)
          await prisma.serviceOption.updateMany({
            where: {
              id: existing.id,
              updatedAt: existing.updatedAt,
              type: "INFORMATIONAL_PACKAGE",
              bookable: false,
              bookingDurationMin: null,
            },
            data: {
              type: "COURSE",
              bookable: true,
              bookingDurationMin: seed.bookingDurationMin,
              bookingServiceId,
            },
          });
        writes += 1;
      }
    }
    if (service.slug === "packages") {
      const result = await migrateCanonicalPackages(service, services);
      writes += result.writes;
      skipped += result.skipped;
      continue;
    }
    const standaloneSeed = STANDALONE_APPOINTMENT_OPTION_SEED.find(
      (item) => item.serviceSlug === service.slug,
    );
    if (standaloneSeed) {
      const existing = service.options.find(
        (item) => item.key === standaloneSeed.key,
      );
      if (existing) {
        for (const current of existing.contents) {
          const page =
            AUTHORED_PAGES[`services/${service.slug}`]?.[current.locale];
          if (!page) continue;
          // Consultation and injectable have no old-site source, so their copy is
          // the hand-authored page body verbatim. Nothing is appended to it.
          const sourceOpening =
            SERVICE_OVERVIEWS[service.slug]?.[current.locale]?.trim() ??
            page.body.trim();
          if (
            !isSourceOwnedTreatmentDescription(current.description, [
              page.body,
              page.body.trim(),
              sourceOpening,
            ]) &&
            !isRetiredGeneratedTreatmentCopy(current.description)
          ) {
            skipped += 1;
            continue;
          }
          const update = {
            ...(current.description === sourceOpening
              ? {}
              : { description: sourceOpening }),
            ...(!current.summary
              ? {
                  summary:
                    service.contents.find(
                      (item) => item.locale === current.locale,
                    )?.shortDesc ?? "",
                }
              : {}),
            ...(!current.sourceUrl
              ? {
                  sourceUrl: `content/authored-pages.ts#services/${service.slug}@${TREATMENT_SOURCE_VERSION}`,
                }
              : {}),
          };
          if (!Object.keys(update).length) {
            skipped += 1;
            continue;
          }
          console.log(
            `${apply ? "WRITE" : "WOULD WRITE"} ${service.slug}/${standaloneSeed.key}/${current.locale} enriched detail content`,
          );
          if (apply)
            await prisma.serviceOptionContent.update({
              where: { id: current.id },
              data: update,
            });
          writes += 1;
        }
      } else {
        console.log(
          `${apply ? "CREATE" : "WOULD CREATE"} ${service.slug}/${standaloneSeed.key} (${TREATMENT_MIGRATION_SOURCES.authored})`,
        );
        if (apply)
          await prisma.serviceOption.create({
            data: {
              serviceId: service.id,
              key: standaloneSeed.key,
              bookingDurationMin: standaloneSeed.bookingDurationMin,
              image: service.images[0] ?? null,
              imageFocalX: service.imageFocalX,
              imageFocalY: service.imageFocalY,
              type: "APPOINTMENT",
              bookable: true,
              published: true,
              contents: {
                create: service.contents.map((content) => ({
                  locale: content.locale,
                  group: standaloneSeed.groups[content.locale],
                  name: content.h1,
                  summary: content.shortDesc,
                  description:
                    SERVICE_OVERVIEWS[service.slug]?.[content.locale]?.trim() ??
                    AUTHORED_PAGES[`services/${service.slug}`]?.[
                      content.locale
                    ]?.body.trim() ??
                    content.whatItIs.trim(),
                  imageAlt: content.imageAlt || content.h1,
                  durationLabel: standaloneSeed.durationLabels[content.locale],
                  priceLabel: null,
                  sourceUrl: `content/authored-pages.ts#services/${service.slug}@${TREATMENT_SOURCE_VERSION}`,
                  status: content.status,
                })),
              },
            },
          });
        writes += 1;
      }
      continue;
    }
    const registry = detailRegistry.services[service.slug];
    if (!registry) {
      skipped += service.options.length;
      continue;
    }
    const sourceOptions = Object.entries(registry).sort(
      ([, left], [, right]) => firstLegacyIndex(left) - firstLegacyIndex(right),
    );
    for (const [index, [key, detail]] of sourceOptions.entries()) {
      const existing = service.options.find((item) => item.key === key);
      if (existing) {
        const endospheresSeed = ENDOSPHERES_OPTION_SEED.find(
          (item) => service.slug === "endospheres" && item.key === key,
        );
        if (
          endospheresSeed?.type === "COURSE" &&
          existing.type === "INFORMATIONAL_PACKAGE" &&
          !existing.bookable &&
          existing.bookingDurationMin === null &&
          matchesEndospheresSourceContent(existing.contents, endospheresSeed)
        ) {
          const bookingServiceSlug = endospheresSeed.bookingServiceSlug;
          const bookingServiceId = services.find(
            (item) => item.slug === bookingServiceSlug,
          )?.id;
          if (!bookingServiceId) {
            console.warn(
              `SKIP endospheres/${key}: scheduling service ${bookingServiceSlug} is missing`,
            );
            skipped += 1;
          } else {
            console.log(
              `${apply ? "WRITE" : "WOULD WRITE"} endospheres/${key} first-visit course`,
            );
            if (apply)
              await prisma.serviceOption.updateMany({
                where: {
                  id: existing.id,
                  updatedAt: existing.updatedAt,
                  type: "INFORMATIONAL_PACKAGE",
                  bookable: false,
                  bookingDurationMin: null,
                },
                data: {
                  type: "COURSE",
                  bookable: true,
                  bookingDurationMin: endospheresSeed.bookingDurationMin,
                  bookingServiceId,
                },
              });
            writes += 1;
          }
        }
        const synced = await syncOptionDetails(service.slug, existing, detail);
        writes += synced.writes;
        skipped += synced.skipped;
        continue;
      }
      const endospheresSeed = ENDOSPHERES_OPTION_SEED.find(
        (item) => service.slug === "endospheres" && item.key === key,
      );
      const perLocale = locales.flatMap((locale) => {
        const procedure = detail[locale];
        const content = service.contents.find((item) => item.locale === locale);
        if (!procedure) return [];
        return [
          {
            locale,
            group: procedure.group,
            name: procedure.name,
            durationLabel: procedure.durationLabel,
            priceLabel: procedure.priceLabel,
            ...detailFields(procedure),
            status: content?.status ?? "DRAFT",
          },
        ];
      });
      const publishedDurations = perLocale
        .map((item) => maximumPublishedDuration(item.durationLabel ?? ""))
        .filter((item): item is number => item !== null);
      const packageWithoutDuration =
        publishedDurations.length === 0 &&
        perLocale.some((item) =>
          /(?:package|paket|пакет|hoitokert|kertaa|treatments|сеанс)/iu.test(
            `${item.group ?? ""} ${item.name} ${item.priceLabel ?? ""}`,
          ),
        );
      const duration = publishedDurations.length
        ? Math.max(...publishedDurations)
        : service.durationMin;
      const bookingServiceSlug =
        endospheresSeed && "bookingServiceSlug" in endospheresSeed
          ? endospheresSeed.bookingServiceSlug
          : null;
      const bookingServiceId = bookingServiceSlug
        ? (services.find((item) => item.slug === bookingServiceSlug)?.id ??
          null)
        : null;
      if (bookingServiceSlug && !bookingServiceId) {
        console.warn(
          `SKIP ${service.slug}/${key}: scheduling service ${bookingServiceSlug} is missing`,
        );
        skipped += 1;
        continue;
      }
      console.log(
        `${apply ? "CREATE" : "WOULD CREATE"} ${service.slug}/${key} (${TREATMENT_MIGRATION_SOURCES.generated})`,
      );
      if (apply)
        await prisma.serviceOption.create({
          data: {
            serviceId: service.id,
            key,
            displayOrder: endospheresSeed?.displayOrder ?? index,
            bookingDurationMin: endospheresSeed?.bookingDurationMin ?? duration,
            bookingServiceId,
            type:
              endospheresSeed?.type ??
              (packageWithoutDuration ? "COURSE" : "APPOINTMENT"),
            bookable: endospheresSeed?.bookable ?? true,
            offerRequiresAccount:
              endospheresSeed?.offerRequiresAccount ?? false,
            legacyProcedureIndex:
              service.slug === "endospheres" ? null : firstLegacyIndex(detail),
            contents: { create: perLocale },
          },
        });
      writes += 1;
    }
  }
  console.log(
    `${apply ? "Applied" : "Dry run"}: ${writes} change(s), ${skipped} existing records left unchanged.`,
  );
  if (!apply && writes)
    console.log(
      "Re-run with --apply after review. Existing canonical options and admin-edited content are never overwritten.",
    );
}

function firstLegacyIndex(detail: Partial<Record<Locale, TreatmentDetail>>) {
  return Math.min(...Object.values(detail).map((item) => item!.legacyIndex));
}

function matchesEndospheresSourceContent(
  contents: Array<{
    locale: Locale;
    name: string;
    durationLabel: string | null;
    priceLabel: string | null;
  }>,
  seed: (typeof ENDOSPHERES_OPTION_SEED)[number],
) {
  return contents.every((content) => {
    const expected = seed.labels[content.locale];
    return Boolean(
      expected &&
      content.name === expected.name &&
      content.durationLabel === expected.durationLabel &&
      content.priceLabel === expected.priceLabel,
    );
  });
}

function detailFields(detail: TreatmentDetail | undefined) {
  return {
    summary: detail?.summary ?? "",
    description: detail?.description ?? "",
    sourceUrl: detail?.sourceUrl ?? null,
    sourceScrapedAt: detail
      ? new Date(`${detail.scrapedAt}T00:00:00.000Z`)
      : null,
  };
}

async function syncOptionDetails(
  serviceSlug: string,
  option: {
    id: string;
    key: string;
    legacyProcedureIndex: number | null;
    archivedAt: Date | null;
    contents: Array<{
      id: string;
      locale: Locale;
      group: string | null;
      name: string;
      durationLabel: string | null;
      priceLabel: string | null;
      summary: string;
      description: string;
      sourceUrl: string | null;
      sourceScrapedAt: Date | null;
      status: "DRAFT" | "PUBLISHED";
    }>;
  },
  detail: Partial<Record<Locale, TreatmentDetail>>,
) {
  let writes = 0;
  let skipped = 0;
  if (option.archivedAt) return { writes, skipped: skipped + 1 };
  for (const locale of locales) {
    const source = detail[locale];
    if (!source) continue;
    const current = option.contents.find((item) => item.locale === locale);
    if (!current) {
      if (
        serviceSlug !== "packages" &&
        serviceSlug !== "endospheres" &&
        option.legacyProcedureIndex !== source.legacyIndex
      ) {
        skipped += 1;
        continue;
      }
      console.log(
        `${apply ? "CREATE" : "WOULD CREATE"} ${serviceSlug}/${option.key}/${locale} detail content`,
      );
      if (apply)
        await prisma.serviceOptionContent.create({
          data: {
            optionId: option.id,
            locale,
            group: source.group,
            name: source.name,
            durationLabel: source.durationLabel,
            priceLabel: source.priceLabel,
            ...detailFields(source),
            status: "PUBLISHED",
          },
        });
      writes += 1;
      continue;
    }
    const approvedPriceUpgrade = approvedPackagePriceUpgrade(
      serviceSlug,
      option.key,
      locale,
      current.priceLabel,
      source.priceLabel,
    );
    const packageIdentity =
      serviceSlug === "packages"
        ? PACKAGES_OPTION_SEED.find((seed) => seed.key === option.key)?.labels[
            locale
          ]
        : undefined;
    const identity = packageIdentity ?? source;
    const legacyIdentity = legacySourceIdentity(
      serviceSlug,
      locale,
      source.legacyIndex,
    );
    const identityMatches =
      current.name === identity.name &&
      (serviceSlug === "endospheres" ||
        current.group === identity.group ||
        current.group === legacyIdentity?.group) &&
      (samePublishedPrice(current.priceLabel, identity.priceLabel) ||
        samePublishedPrice(current.priceLabel, legacyIdentity?.price) ||
        approvedPriceUpgrade) &&
      (serviceSlug === "packages" ||
        serviceSlug === "endospheres" ||
        option.legacyProcedureIndex === source.legacyIndex);
    if (!identityMatches) {
      console.warn(
        `SKIP ${serviceSlug}/${option.key}/${locale}: localized identity differs from source`,
      );
      skipped += 1;
      continue;
    }
    const descriptionSourceOwned =
      isSourceOwnedTreatmentDescription(
        current.description,
        [source.openingDescription, source.description],
        descriptionHistory.descriptions[serviceSlug]?.[option.key]?.[locale]
          ? [descriptionHistory.descriptions[serviceSlug][option.key][locale]!]
          : [],
      ) || isRetiredGeneratedTreatmentCopy(current.description);
    const summarySourceOwned = isSourceOwnedTreatmentSummary(
      current.summary,
      [source.openingDescription, source.description],
      source.summary,
      summaryHistory.summaries[serviceSlug]?.[option.key]?.[locale]
        ? [summaryHistory.summaries[serviceSlug][option.key][locale]!]
        : [],
    );
    const update = {
      ...(approvedPriceUpgrade ? { priceLabel: source.priceLabel } : {}),
      ...(summarySourceOwned && current.summary !== source.summary
        ? { summary: source.summary }
        : {}),
      ...(descriptionSourceOwned && current.description !== source.description
        ? { description: source.description }
        : {}),
      ...(!current.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
      ...(!current.sourceScrapedAt
        ? { sourceScrapedAt: new Date(`${source.scrapedAt}T00:00:00.000Z`) }
        : {}),
    };
    if (!Object.keys(update).length) {
      skipped += 1;
      continue;
    }
    console.log(
      `${apply ? "WRITE" : "WOULD WRITE"} ${serviceSlug}/${option.key}/${locale} detail content`,
    );
    if (apply)
      await prisma.serviceOptionContent.update({
        where: { id: current.id },
        data: update,
      });
    writes += 1;
  }
  return { writes, skipped };
}

function legacySourceIdentity(
  serviceSlug: string,
  locale: Locale,
  legacyIndex: number,
) {
  const page = SERVICE_MIGRATION_PAGES[serviceSlug];
  const source = page ? generated[page]?.[locale]?.body : undefined;
  return source ? parseProcedures(source)[legacyIndex - 1] : undefined;
}

function samePublishedPrice(
  current: string | null | undefined,
  expected: string | null | undefined,
) {
  if (!current || !expected) return current === expected;
  return (
    current.replace(/\s*\/\s*$/u, "").trim() ===
    expected.replace(/\s*\/\s*$/u, "").trim()
  );
}

function approvedPackagePriceUpgrade(
  serviceSlug: string,
  key: string,
  locale: Locale,
  current: string | null,
  desired: string,
) {
  if (serviceSlug !== "packages") return false;
  const stale: Record<string, string> = {
    "endospheres-60-12": locale === "fi" ? "960 €" : "€960",
    "endospheres-75-12": "€1150",
  };
  const amount = (value: string | null | undefined) =>
    value?.replace(/[^\d]/gu, "") ?? "";
  return (
    amount(current) === amount(stale[key]) &&
    amount(current) !== amount(desired)
  );
}

async function migrateCanonicalPackages(
  service: Awaited<ReturnType<typeof prisma.service.findMany>>[number] & {
    contents: Array<{
      locale: Locale;
      status: "DRAFT" | "PUBLISHED";
      h1: string;
      whatItIs: string;
    }>;
    options: Array<{
      id: string;
      key: string;
      displayOrder: number;
      bookingDurationMin: number | null;
      bookingServiceId: string | null;
      type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
      bookable: boolean;
      offerRequiresAccount: boolean;
      published: boolean;
      legacyProcedureIndex: number | null;
      archivedAt: Date | null;
      updatedAt: Date;
      contents: Array<{
        id: string;
        locale: Locale;
        group: string | null;
        name: string;
        durationLabel: string | null;
        priceLabel: string | null;
        summary: string;
        description: string;
        sourceUrl: string | null;
        sourceScrapedAt: Date | null;
        status: "DRAFT" | "PUBLISHED";
      }>;
    }>;
  },
  services: Array<{ id: string; slug: string }>,
) {
  let writes = 0;
  let skipped = 0;
  for (const seed of PACKAGES_OPTION_SEED) {
    const existing = service.options.find((item) => item.key === seed.key);
    const bookingServiceId = seed.bookingServiceSlug
      ? (services.find((item) => item.slug === seed.bookingServiceSlug)?.id ??
        null)
      : null;
    if (seed.bookingServiceSlug && !bookingServiceId) {
      console.warn(
        `SKIP packages/${seed.key}: scheduling service ${seed.bookingServiceSlug} is missing`,
      );
      skipped += 1;
      continue;
    }
    if (existing) {
      const detail = detailRegistry.services.packages?.[seed.key] ?? {};
      const synced = await syncOptionDetails("packages", existing, detail);
      writes += synced.writes;
      skipped += synced.skipped;
      if (
        matchesCanonicalPackageOption(existing, seed, service.contents) &&
        (existing.type !== "COURSE" ||
          !existing.bookable ||
          existing.bookingDurationMin !== seed.bookingDurationMin ||
          existing.bookingServiceId !== bookingServiceId)
      ) {
        console.log(
          `${apply ? "WRITE" : "WOULD WRITE"} packages/${seed.key} first-visit course`,
        );
        if (apply) {
          const updated = await prisma.serviceOption.updateMany({
            where: {
              id: existing.id,
              updatedAt: existing.updatedAt,
            },
            data: {
              type: "COURSE",
              bookable: true,
              bookingDurationMin: seed.bookingDurationMin,
              bookingServiceId,
            },
          });
          if (!updated.count) {
            console.warn(
              `SKIP packages/${seed.key} first-visit course: record changed concurrently`,
            );
            skipped += 1;
            continue;
          }
        }
        writes += 1;
      }
      continue;
    }
    const detail = detailRegistry.services.packages?.[seed.key] ?? {};
    const localized = locales.flatMap((locale) => {
      const content = seed.labels[locale];
      const treatment = detail[locale];
      if (!content || !treatment) return [];
      const serviceContent = service.contents.find(
        (item) => item.locale === locale,
      );
      if (!serviceContent) return [];
      return [
        {
          locale,
          ...content,
          ...detailFields(treatment),
          status: serviceContent.status,
        },
      ];
    });
    if (!localized.length) continue;
    console.log(
      `${apply ? "CREATE" : "WOULD CREATE"} packages/${seed.key} (${seed.source})`,
    );
    if (apply)
      await prisma.serviceOption.create({
        data: {
          serviceId: service.id,
          key: seed.key,
          displayOrder: seed.displayOrder,
          bookingDurationMin: seed.bookingDurationMin,
          bookingServiceId,
          type: "COURSE",
          bookable: true,
          contents: { create: localized },
        },
      });
    writes += 1;
  }

  const expectedLegacy = legacyGeneratedPackageOptions(service);
  for (const option of service.options) {
    const expected = expectedLegacy.get(option.key);
    if (!expected || option.archivedAt) continue;
    if (!matchesLegacyGeneratedOption(option, expected)) {
      console.warn(
        `SKIP packages/${option.key} archive: record differs from the superseded generated source`,
      );
      skipped += 1;
      continue;
    }
    console.log(
      `${apply ? "ARCHIVE" : "WOULD ARCHIVE"} packages/${option.key} (superseded positional option)`,
    );
    if (apply) {
      const archived = await prisma.serviceOption.updateMany({
        where: { id: option.id, updatedAt: option.updatedAt, archivedAt: null },
        data: {
          archivedAt: new Date(),
          published: false,
          type: "INFORMATIONAL_PACKAGE",
          bookingDurationMin: null,
          bookable: false,
        },
      });
      if (!archived.count) {
        console.warn(
          `SKIP packages/${option.key} archive: record changed concurrently`,
        );
        skipped += 1;
        continue;
      }
    }
    writes += 1;
  }
  return { writes, skipped };
}

function matchesCanonicalPackageOption(
  option: {
    displayOrder: number;
    bookingDurationMin: number | null;
    type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
    bookable: boolean;
    offerRequiresAccount: boolean;
    published: boolean;
    archivedAt: Date | null;
    contents: Array<{
      locale: Locale;
      group: string | null;
      name: string;
      durationLabel: string | null;
      priceLabel: string | null;
      status: "DRAFT" | "PUBLISHED";
    }>;
  },
  seed: (typeof PACKAGES_OPTION_SEED)[number],
  serviceContents: Array<{
    locale: Locale;
    status: "DRAFT" | "PUBLISHED";
  }>,
) {
  if (
    option.displayOrder !== seed.displayOrder ||
    option.bookingDurationMin !== seed.bookingDurationMin ||
    (option.type !== "APPOINTMENT" && option.type !== "COURSE") ||
    !option.bookable ||
    option.offerRequiresAccount ||
    !option.published ||
    option.archivedAt
  )
    return false;
  const expected = locales.flatMap((locale) => {
    const content = seed.labels[locale];
    const serviceContent = serviceContents.find(
      (item) => item.locale === locale,
    );
    return content && serviceContent
      ? [{ locale, ...content, status: serviceContent.status }]
      : [];
  });
  if (option.contents.length !== expected.length) return false;
  return expected.every((content) => {
    const actual = option.contents.find(
      (item) => item.locale === content.locale,
    );
    return Boolean(
      actual &&
      actual.group === content.group &&
      actual.name === content.name &&
      actual.durationLabel === content.durationLabel &&
      actual.priceLabel === content.priceLabel &&
      actual.status === content.status,
    );
  });
}

function legacyGeneratedPackageOptions(service: {
  durationMin: number;
  contents: Array<{ locale: Locale; status: "DRAFT" | "PUBLISHED" }>;
}): Map<string, LegacyGeneratedPackageOption> {
  const localized = new Map<Locale, ReturnType<typeof parseProcedures>>();
  for (const content of service.contents) {
    const source = generated["services/packages"]?.[content.locale]?.body;
    localized.set(content.locale, source ? parseProcedures(source) : []);
  }
  const count = Math.max(
    0,
    ...Array.from(localized.values(), (items) => items.length),
  );
  return new Map<string, LegacyGeneratedPackageOption>(
    Array.from({ length: count }, (_, index) => {
      const contents = locales.flatMap((locale) => {
        const procedure = localized.get(locale)?.[index];
        const serviceContent = service.contents.find(
          (item) => item.locale === locale,
        );
        if (!procedure || !serviceContent) return [];
        return [
          {
            locale,
            group: procedure.group,
            name: procedure.title,
            durationLabel: durationPart(procedure.price),
            priceLabel: procedure.price,
            status: serviceContent.status,
          },
        ];
      });
      const publishedDurations = contents
        .map((item) => maximumPublishedDuration(item.durationLabel ?? ""))
        .filter((item): item is number => item !== null);
      const packageWithoutDuration =
        publishedDurations.length === 0 &&
        contents.some((item) =>
          /(?:package|paket|пакет|hoitokert|kertaa|treatments|сеанс)/iu.test(
            `${item.group ?? ""} ${item.name} ${item.priceLabel}`,
          ),
        );
      return [
        `treatment-${String(index + 1).padStart(2, "0")}`,
        {
          displayOrder: index,
          bookingDurationMin: packageWithoutDuration
            ? null
            : publishedDurations.length
              ? Math.max(...publishedDurations)
              : service.durationMin,
          type: packageWithoutDuration
            ? "INFORMATIONAL_PACKAGE"
            : "APPOINTMENT",
          bookable: !packageWithoutDuration,
          legacyProcedureIndex: index + 1,
          contents,
        },
      ] as const;
    }),
  );
}

function matchesLegacyGeneratedOption(
  option: {
    displayOrder: number;
    bookingDurationMin: number | null;
    type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
    bookable: boolean;
    offerRequiresAccount: boolean;
    published: boolean;
    legacyProcedureIndex: number | null;
    contents: Array<{
      locale: Locale;
      group: string | null;
      name: string;
      durationLabel: string | null;
      priceLabel: string | null;
      status: "DRAFT" | "PUBLISHED";
    }>;
  },
  expected: LegacyGeneratedPackageOption,
) {
  if (
    option.displayOrder !== expected.displayOrder ||
    option.bookingDurationMin !== expected.bookingDurationMin ||
    option.type !== expected.type ||
    option.bookable !== expected.bookable ||
    option.offerRequiresAccount ||
    !option.published ||
    option.legacyProcedureIndex !== expected.legacyProcedureIndex ||
    option.contents.length !== expected.contents.length
  )
    return false;
  return expected.contents.every((content) => {
    const actual = option.contents.find(
      (item) => item.locale === content.locale,
    );
    return Boolean(
      actual &&
      actual.group === content.group &&
      actual.name === content.name &&
      actual.durationLabel === content.durationLabel &&
      actual.priceLabel === content.priceLabel &&
      actual.status === content.status,
    );
  });
}

type LegacyGeneratedPackageOption = {
  displayOrder: number;
  bookingDurationMin: number | null;
  type: "APPOINTMENT" | "COURSE" | "INFORMATIONAL_PACKAGE";
  bookable: boolean;
  legacyProcedureIndex: number;
  contents: Array<{
    locale: Locale;
    group: string | null;
    name: string;
    durationLabel: string | null;
    priceLabel: string;
    status: "DRAFT" | "PUBLISHED";
  }>;
};

function durationPart(value: string) {
  const match = value.match(
    /(?:\d{1,3}\s*(?:–|-|—)\s*)?\d{1,3}\s*(?:min(?:ute)?s?|мин(?:ут[ы]?)?)/iu,
  );
  return match?.[0] ?? null;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
