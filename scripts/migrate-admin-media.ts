import { PrismaClient, type Locale } from "@prisma/client";
import { PROCEDURE_MEDIA_SEED } from "../content/procedure-media";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const locales: Locale[] = ["fi", "en", "ru"];

type Identity = { group: string | null; title: string };

function identities(value: unknown, locale: Locale): Identity[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const rows = (value as Record<string, unknown>)[locale];
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const group = (row as Record<string, unknown>).group;
    const title = (row as Record<string, unknown>).title;
    return typeof title === "string" &&
      (group === null || typeof group === "string")
      ? [{ group, title }]
      : [];
  });
}

function matches(rows: Identity[], group: string | null, title: string) {
  return rows.some((row) => row.group === group && row.title === title);
}

function markdownImages(markdown: string) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)\)/g)].map(
    (match) => match[1],
  );
}

function shareMarkdownImages(
  markdown: string,
  images: Array<string | undefined>,
) {
  let index = 0;
  return markdown.replace(
    /(!\[[^\]]*\]\()[^)\s]+(\))/g,
    (match, opening: string, closing: string) => {
      const image = images[index++];
      return image ? `${opening}${image}${closing}` : match;
    },
  );
}

async function main() {
  const [schema] = await prisma.$queryRaw<[{ ready: boolean }]>`
    SELECT
      EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ServiceOption'
          AND column_name = 'image'
      )
      AND EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'ContentPage'
          AND column_name = 'heroFocalX'
      )
      AND to_regclass('"SiteMediaSlot"') IS NOT NULL AS ready
  `;
  if (!schema?.ready) {
    console.error(
      [
        "Admin media schema is not installed; no backfill changes were made.",
        "Run `npm run db:migrate:deploy`, confirm `npm run db:migrate:status`,",
        "then rerun `npm run db:migrate-admin-media` before using the apply command.",
      ].join(" "),
    );
    process.exitCode = 1;
    return;
  }

  const options = await prisma.serviceOption.findMany({
    where: { archivedAt: null },
    include: {
      contents: true,
      service: { include: { procedureMedia: true } },
    },
  });
  let optionChanges = 0;
  for (const option of options) {
    let image: string | null = option.image;
    if (!image)
      for (const locale of locales) {
        const content = option.contents.find((row) => row.locale === locale);
        if (!content) continue;
        image =
          option.service.procedureMedia.find((record) =>
            matches(
              identities(record.identities, locale),
              content.group,
              content.name,
            ),
          )?.image ??
          PROCEDURE_MEDIA_SEED.find(
            (record) =>
              record.serviceSlug === option.service.slug &&
              matches(record.identities[locale], content.group, content.name),
          )?.image ??
          null;
        if (image) break;
      }
    image ??= option.service.images[0] ?? null;
    if (!image) continue;
    const missingAlt = option.contents.filter((content) => !content.imageAlt);
    if (!option.image || missingAlt.length) optionChanges++;
    if (apply) {
      if (!option.image)
        await prisma.serviceOption.update({
          where: { id: option.id },
          data: { image },
        });
      for (const content of missingAlt)
        await prisma.serviceOptionContent.update({
          where: { id: content.id },
          data: { imageAlt: content.name },
        });
    }
  }

  const pages = await prisma.contentPage.findMany({
    orderBy: { locale: "asc" },
  });
  const slugs = [...new Set(pages.map((page) => page.slug))];
  let pageChanges = 0;
  for (const slug of slugs) {
    const localized = pages.filter((page) => page.slug === slug);
    const sharedHero = locales
      .map((locale) => localized.find((page) => page.locale === locale)?.hero)
      .find(Boolean);
    const imagesByLocale = new Map(
      locales.map((locale) => [
        locale,
        markdownImages(
          localized.find((page) => page.locale === locale)?.body ?? "",
        ),
      ]),
    );
    const imageCount = Math.max(
      0,
      ...locales.map((locale) => imagesByLocale.get(locale)?.length ?? 0),
    );
    const sharedInline = Array.from({ length: imageCount }, (_, index) =>
      locales
        .map((locale) => imagesByLocale.get(locale)?.[index])
        .find(Boolean),
    );
    for (const page of localized) {
      const body = shareMarkdownImages(page.body, sharedInline);
      if (
        (!sharedHero || page.hero === sharedHero) &&
        (!page.hero || page.imageAlt) &&
        body === page.body
      )
        continue;
      pageChanges++;
      if (apply)
        await prisma.contentPage.update({
          where: { id: page.id },
          data: {
            hero: sharedHero ?? page.hero,
            imageAlt: sharedHero ? page.imageAlt || page.title : page.imageAlt,
            body,
          },
        });
    }
  }

  let localizedBodyChanges = 0;
  const technologies = await prisma.technology.findMany({
    include: { contents: true },
  });
  for (const technology of technologies) {
    const shared = Array.from(
      {
        length: Math.max(
          0,
          ...technology.contents.map((row) => markdownImages(row.body).length),
        ),
      },
      (_, index) =>
        locales
          .map(
            (locale) =>
              markdownImages(
                technology.contents.find((row) => row.locale === locale)
                  ?.body ?? "",
              )[index],
          )
          .find(Boolean),
    );
    for (const content of technology.contents) {
      const body = shareMarkdownImages(content.body, shared);
      if (body === content.body) continue;
      localizedBodyChanges++;
      if (apply)
        await prisma.technologyContent.update({
          where: { id: content.id },
          data: { body },
        });
    }
  }

  const products = await prisma.product.findMany({
    include: { contents: true },
  });
  for (const product of products) {
    const shared = Array.from(
      {
        length: Math.max(
          0,
          ...product.contents.map(
            (row) => markdownImages(row.description).length,
          ),
        ),
      },
      (_, index) =>
        locales
          .map(
            (locale) =>
              markdownImages(
                product.contents.find((row) => row.locale === locale)
                  ?.description ?? "",
              )[index],
          )
          .find(Boolean),
    );
    for (const content of product.contents) {
      const description = shareMarkdownImages(content.description, shared);
      if (description === content.description) continue;
      localizedBodyChanges++;
      if (apply)
        await prisma.productContent.update({
          where: { id: content.id },
          data: { description },
        });
    }
  }

  const articles = await prisma.article.findMany({
    include: { contents: true },
  });
  for (const article of articles) {
    const shared = Array.from(
      {
        length: Math.max(
          0,
          ...article.contents.map((row) => markdownImages(row.body).length),
        ),
      },
      (_, index) =>
        locales
          .map(
            (locale) =>
              markdownImages(
                article.contents.find((row) => row.locale === locale)?.body ??
                  "",
              )[index],
          )
          .find(Boolean),
    );
    for (const content of article.contents) {
      const body = shareMarkdownImages(content.body, shared);
      if (body === content.body) continue;
      localizedBodyChanges++;
      if (apply)
        await prisma.articleContent.update({
          where: { id: content.id },
          data: { body },
        });
    }
  }

  console.log(
    `${apply ? "Applied" : "Dry run"}: ${optionChanges} treatment image row(s), ${pageChanges} localized page image row(s), ${localizedBodyChanges} other localized body row(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
