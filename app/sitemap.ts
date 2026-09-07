import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { renderSitemap, type SitemapEntry } from "@/lib/sitemap";
import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  articlePath,
  contentPagePath,
  productPath,
  treatmentOptionPath,
} from "@/lib/public-routes";

const STATIC_SEARCH_PATHS = [
  PUBLIC_PATHS.home,
  PUBLIC_PATHS.booking,
  PUBLIC_PATHS.pricing,
  PUBLIC_PATHS.shop,
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, services, serviceOptions, technologies, products, articles] =
    await Promise.all([
      prisma.contentPage.findMany({
        where: { status: "PUBLISHED", seoIndexable: true },
        select: { slug: true, locale: true, hero: true, updatedAt: true },
      }),
      prisma.treatmentContent.findMany({
        where: {
          status: "PUBLISHED",
          seoIndexable: true,
          service: {
            archivedAt: null,
            published: true,
            publicPath: { not: null },
          },
        },
        select: {
          locale: true,
          updatedAt: true,
          service: { select: { publicPath: true, images: true } },
        },
      }),
      prisma.serviceOptionContent.findMany({
        where: {
          status: "PUBLISHED",
          description: { not: "" },
          option: {
            archivedAt: null,
            published: true,
            service: {
              archivedAt: null,
              published: true,
              publicPath: { not: null },
            },
          },
        },
        select: {
          locale: true,
          updatedAt: true,
          option: {
            select: {
              key: true,
              image: true,
              service: {
                select: {
                  publicPath: true,
                  images: true,
                  contents: {
                    where: { status: "PUBLISHED", seoIndexable: true },
                    select: { locale: true },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.technologyContent.findMany({
        where: {
          status: "PUBLISHED",
          seoIndexable: true,
          technology: { archivedAt: null },
        },
        select: {
          locale: true,
          updatedAt: true,
          technology: { select: { publicPath: true, images: true } },
        },
      }),
      prisma.productContent.findMany({
        where: {
          status: "PUBLISHED",
          seoIndexable: true,
          product: {
            archivedAt: null,
            published: true,
            slug: { not: "stripe-checkout-test-item" },
          },
        },
        select: {
          locale: true,
          updatedAt: true,
          product: { select: { slug: true, images: true } },
        },
      }),
      prisma.articleContent.findMany({
        where: {
          status: "PUBLISHED",
          seoIndexable: true,
          article: { archivedAt: null, published: true },
        },
        select: {
          locale: true,
          updatedAt: true,
          article: { select: { slug: true, coverImage: true } },
        },
      }),
    ]);

  const entries: SitemapEntry[] = [];
  for (const locale of routing.locales)
    for (const path of STATIC_SEARCH_PATHS) entries.push({ path, locale });
  for (const locale of new Set(articles.map((row) => row.locale)))
    entries.push({ path: PUBLIC_PATHS.articles, locale });
  for (const row of pages)
    entries.push({
      path: contentPagePath(row.slug),
      locale: row.locale,
      updatedAt: row.updatedAt,
      image: row.hero,
    });
  for (const row of services)
    if (
      row.service.publicPath &&
      row.service.publicPath !== SERVICE_PUBLIC_PATHS.body
    )
      entries.push({
        path: row.service.publicPath,
        locale: row.locale,
        updatedAt: row.updatedAt,
        image: row.service.images[0],
      });
  for (const row of serviceOptions)
    if (
      row.option.service.publicPath &&
      row.option.service.contents.some(
        (content) => content.locale === row.locale,
      )
    )
      entries.push({
        path: treatmentOptionPath(
          row.option.service.publicPath,
          row.option.key,
        ),
        locale: row.locale,
        updatedAt: row.updatedAt,
        image: row.option.image || row.option.service.images[0],
      });
  for (const row of technologies)
    entries.push({
      path: row.technology.publicPath,
      locale: row.locale,
      updatedAt: row.updatedAt,
      image: row.technology.images[0],
    });
  for (const row of products)
    entries.push({
      path: productPath(row.product.slug),
      locale: row.locale,
      updatedAt: row.updatedAt,
      image: row.product.images[0],
    });
  for (const row of articles)
    entries.push({
      path: articlePath(row.article.slug),
      locale: row.locale,
      updatedAt: row.updatedAt,
      image: row.article.coverImage,
    });
  return renderSitemap(
    entries.filter((entry) => entry.path !== SERVICE_PUBLIC_PATHS.body),
  );
}
