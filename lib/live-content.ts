import "server-only";

import { prisma } from "@/lib/db";
import type { PageContent } from "@/content/pages";
import type { Product, ProductCategory } from "@/content/products";
import type { Locale } from "@/i18n/routing";

export async function getIndexablePageLocales(slug: string): Promise<Locale[]> {
  const rows = await prisma.contentPage.findMany({
    where: { slug, status: "PUBLISHED", seoIndexable: true },
    select: { locale: true },
  });
  return rows.map((row) => row.locale);
}

export async function getIndexableServiceLocales(
  publicPath: string,
): Promise<Locale[]> {
  const rows = await prisma.treatmentContent.findMany({
    where: {
      status: "PUBLISHED",
      seoIndexable: true,
      service: { publicPath, archivedAt: null, published: true },
    },
    select: { locale: true },
  });
  return rows.map((row) => row.locale);
}

export async function getIndexableServiceOptionLocales(
  publicPath: string,
  optionKey: string,
): Promise<Locale[]> {
  const rows = await prisma.serviceOptionContent.findMany({
    where: {
      status: "PUBLISHED",
      description: { not: "" },
      option: {
        key: optionKey,
        archivedAt: null,
        published: true,
        service: {
          publicPath,
          archivedAt: null,
          published: true,
          contents: { some: { status: "PUBLISHED", seoIndexable: true } },
        },
      },
    },
    select: {
      locale: true,
      option: {
        select: {
          service: {
            select: {
              contents: {
                where: { status: "PUBLISHED", seoIndexable: true },
                select: { locale: true },
              },
            },
          },
        },
      },
    },
  });
  return rows.flatMap((row) =>
    row.option.service.contents.some((content) => content.locale === row.locale)
      ? [row.locale]
      : [],
  );
}

export async function getIndexableTechnologyLocales(
  publicPath: string,
): Promise<Locale[]> {
  const rows = await prisma.technologyContent.findMany({
    where: {
      status: "PUBLISHED",
      seoIndexable: true,
      technology: { publicPath, archivedAt: null },
    },
    select: { locale: true },
  });
  return rows.map((row) => row.locale);
}

export async function getIndexableProductLocales(
  slug: string,
): Promise<Locale[]> {
  const rows = await prisma.productContent.findMany({
    where: {
      status: "PUBLISHED",
      seoIndexable: true,
      product: { slug, archivedAt: null, published: true },
    },
    select: { locale: true },
  });
  return rows.map((row) => row.locale);
}

export async function getIndexableArticleLocales(
  slug: string,
): Promise<Locale[]> {
  const rows = await prisma.articleContent.findMany({
    where: {
      status: "PUBLISHED",
      seoIndexable: true,
      article: { slug, archivedAt: null, published: true },
    },
    select: { locale: true },
  });
  return rows.map((row) => row.locale);
}

/** Public content is database-owned: only the requested locale's published row is visible. */
export async function getLivePageContent(
  slug: string,
  locale: Locale,
): Promise<
  | (PageContent & {
      seoTitle: string | null;
      seoDescription: string | null;
      seoIndexable: boolean;
      heroFocalX: number;
      heroFocalY: number;
      imageAlt: string | null;
      updatedAt: Date;
    })
  | undefined
> {
  const content = await prisma.contentPage.findFirst({
    where: { slug, locale, status: "PUBLISHED" },
    select: {
      title: true,
      hero: true,
      heroFocalX: true,
      heroFocalY: true,
      imageAlt: true,
      body: true,
      seoTitle: true,
      seoDescription: true,
      seoIndexable: true,
      updatedAt: true,
    },
  });
  return content ?? undefined;
}

export async function getPublishedPages(locale: Locale) {
  return prisma.contentPage.findMany({
    where: { locale, status: "PUBLISHED" },
    select: {
      slug: true,
      title: true,
      hero: true,
      heroFocalX: true,
      heroFocalY: true,
      imageAlt: true,
      body: true,
      seoTitle: true,
      seoDescription: true,
      seoIndexable: true,
      updatedAt: true,
    },
    orderBy: { slug: "asc" },
  });
}

export async function getLiveProducts(locale: Locale): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
    },
  });
  return rows.flatMap((row) => {
    const content = row.contents[0];
    if (!content) return [];
    return [
      {
        slug: row.slug,
        category: row.category as ProductCategory,
        kind: row.kind,
        image: row.images[0] ?? null,
        imageFocalX: row.imageFocalX,
        imageFocalY: row.imageFocalY,
        price: Number(row.price),
        size: row.size,
        currency: row.currency,
        updatedAt: row.updatedAt,
        i18n: {
          [locale]: {
            name: content.name,
            description: content.description,
            shortDescription: content.shortDescription,
            imageAlt: content.imageAlt,
            seoTitle: content.seoTitle,
            seoDescription: content.seoDescription,
            seoIndexable: content.seoIndexable,
            updatedAt: content.updatedAt,
          },
        } as Product["i18n"],
      },
    ];
  });
}

export async function getLiveProduct(
  slug: string,
  locale: Locale,
): Promise<Product | undefined> {
  const row = await prisma.product.findFirst({
    where: {
      slug,
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: { contents: { where: { locale, status: "PUBLISHED" }, take: 1 } },
  });
  const content = row?.contents[0];
  if (!row || !content) return undefined;
  return {
    slug: row.slug,
    category: row.category as ProductCategory,
    kind: row.kind,
    image: row.images[0] ?? null,
    imageFocalX: row.imageFocalX,
    imageFocalY: row.imageFocalY,
    price: Number(row.price),
    size: row.size,
    currency: row.currency,
    updatedAt: row.updatedAt,
    i18n: {
      [locale]: {
        name: content.name,
        description: content.description,
        shortDescription: content.shortDescription,
        imageAlt: content.imageAlt,
        seoTitle: content.seoTitle,
        seoDescription: content.seoDescription,
        seoIndexable: content.seoIndexable,
        updatedAt: content.updatedAt,
      },
    } as Product["i18n"],
  };
}

export async function getPublishedServices(locale: Locale) {
  const rows = await prisma.service.findMany({
    where: {
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: { contents: { where: { locale, status: "PUBLISHED" }, take: 1 } },
  });
  return rows.flatMap((row) => {
    const content = row.contents[0];
    return content ? [{ ...row, content }] : [];
  });
}

export async function getPublishedServiceByPath(path: string, locale: Locale) {
  const row = await prisma.service.findFirst({
    where: {
      publicPath: path,
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      procedureMedia: true,
      options: {
        where: { archivedAt: null, published: true },
        orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
        include: {
          contents: {
            where: {
              locale,
              status: "PUBLISHED",
              description: { not: "" },
            },
            take: 1,
          },
        },
      },
    },
  });
  const content = row?.contents[0];
  return row && content ? { ...row, content } : undefined;
}

export async function getPublishedServiceOption(
  publicPath: string,
  optionKey: string,
  locale: Locale,
) {
  const row = await prisma.serviceOption.findFirst({
    where: {
      key: optionKey,
      archivedAt: null,
      published: true,
      service: {
        publicPath,
        archivedAt: null,
        published: true,
        contents: { some: { locale, status: "PUBLISHED" } },
      },
      contents: {
        some: { locale, status: "PUBLISHED", description: { not: "" } },
      },
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      service: {
        include: {
          contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
          procedureMedia: true,
        },
      },
    },
  });
  const content = row?.contents[0];
  const serviceContent = row?.service.contents[0];
  return row && content && serviceContent
    ? { ...row, content, service: { ...row.service, content: serviceContent } }
    : undefined;
}

export async function getPublishedTechnologies(locale: Locale) {
  const rows = await prisma.technology.findMany({
    where: {
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { slug: "asc" }],
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      relatedService: {
        select: {
          slug: true,
          bookable: true,
          options: {
            where: { archivedAt: null, published: true },
            orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
            include: {
              contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
            },
          },
        },
      },
    },
  });
  return rows.flatMap((row) => {
    const content = row.contents[0];
    return content ? [{ ...row, content }] : [];
  });
}

export async function getPublishedTechnologyByPath(
  path: string,
  locale: Locale,
) {
  const row = await prisma.technology.findFirst({
    where: {
      publicPath: path,
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
      relatedService: {
        select: {
          slug: true,
          bookable: true,
          options: {
            where: { archivedAt: null, published: true },
            orderBy: [{ displayOrder: "asc" }, { key: "asc" }],
            include: {
              contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
            },
          },
        },
      },
    },
  });
  const content = row?.contents[0];
  return row && content ? { ...row, content } : undefined;
}

export async function getPublishedPricing(locale: Locale) {
  const rows = await prisma.pricingItem.findMany({
    where: {
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { price: "asc" }],
    include: { contents: { where: { locale, status: "PUBLISHED" }, take: 1 } },
  });
  return rows.flatMap((row) =>
    row.contents[0] ? [{ ...row, content: row.contents[0] }] : [],
  );
}

export async function getPublishedArticles(locale: Locale) {
  const rows = await prisma.article.findMany({
    where: {
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    orderBy: [{ order: "asc" }, { publishedAt: "desc" }],
    include: { contents: { where: { locale, status: "PUBLISHED" }, take: 1 } },
  });
  return rows.flatMap((row) =>
    row.contents[0] ? [{ ...row, content: row.contents[0] }] : [],
  );
}

export async function getBookableServices(locale: Locale) {
  const services = await getPublishedServices(locale);
  return services.filter((service) => service.bookable);
}
