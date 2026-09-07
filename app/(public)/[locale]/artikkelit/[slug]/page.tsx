import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Markdown } from "@/components/Markdown";
import { JsonLd } from "@/components/JsonLd";
import { prisma } from "@/lib/db";
import {
  absoluteLocalizedUrl,
  articleJsonLd,
  breadcrumbJsonLd,
  siteUrl,
} from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, articlePath } from "@/lib/public-routes";
import { getIndexableArticleLocales } from "@/lib/live-content";

async function article(slug: string, locale: Locale) {
  return prisma.article.findFirst({
    where: {
      slug,
      archivedAt: null,
      published: true,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const [row, availableLocales] = await Promise.all([
    article(slug, locale as Locale),
    getIndexableArticleLocales(slug),
  ]);
  const content = row?.contents[0];
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: articlePath(slug),
    title: content?.seoTitle || content?.title,
    description: content?.seoDescription || content?.excerpt || content?.body,
    image: row?.coverImage,
    imageAlt: content?.imageAlt || row?.coverAlt || content?.title,
    indexable: content?.seoIndexable ?? false,
    type: "article",
    availableLocales,
  });
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const row = await article(slug, locale as Locale);
  const content = row?.contents[0];
  if (!row || !content) notFound();
  const canonical = absoluteLocalizedUrl(siteUrl(), articlePath(slug), locale);
  return (
    <article className="bg-page py-[clamp(52px,7vw,104px)]">
      <JsonLd
        data={[
          articleJsonLd({
            title: content.title,
            description: content.seoDescription || content.excerpt,
            url: canonical,
            image: row.coverImage,
            locale: locale as Locale,
            publishedAt: row.publishedAt,
            updatedAt: content.updatedAt,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            {
              name: "Articles",
              url: absoluteLocalizedUrl(
                siteUrl(),
                PUBLIC_PATHS.articles,
                locale,
              ),
            },
            { name: content.title, url: canonical },
          ]),
        ]}
      />
      <Container className="max-w-[880px]">
        <h1 className="font-display text-[clamp(38px,5vw,64px)] leading-[1.04] font-medium">
          {content.title}
        </h1>
        {row.coverImage ? (
          <div className="relative mt-[28px] h-[clamp(280px,48vw,520px)] overflow-hidden rounded-[var(--radius)]">
            <Image
              src={row.coverImage}
              alt={content.imageAlt || row.coverAlt || content.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
              style={{
                objectPosition: `${row.coverFocalX}% ${row.coverFocalY}%`,
              }}
            />
          </div>
        ) : null}
        <div className="mt-[32px]">
          <Markdown>{content.body}</Markdown>
        </div>
      </Container>
    </article>
  );
}
