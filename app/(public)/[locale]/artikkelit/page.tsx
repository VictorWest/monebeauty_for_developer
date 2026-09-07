import type { Metadata } from "next";
import Image from "next/image";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Link } from "@/i18n/navigation";
import { getPublishedArticles } from "@/lib/live-content";
import { absoluteLocalizedUrl, collectionJsonLd, siteUrl } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS, articlePath } from "@/lib/public-routes";
import { prisma } from "@/lib/db";
import { JsonLd } from "@/components/JsonLd";

const META_DESCRIPTION: Record<Locale, string> = {
  fi: "Mone Beauty Clinicin artikkelit esteettisestä lääketieteestä, ihon hyvinvoinnista sekä kasvojen, vartalon ja hiusten hoidosta Helsingissä.",
  en: "Articles from Mone Beauty Clinic about aesthetic medicine, skin wellbeing, and face, body and hair care in Helsinki.",
  ru: "Статьи Mone Beauty Clinic об эстетической медицине, здоровье кожи и уходе за лицом, телом и волосами в Хельсинки.",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Admin" });
  const currentLocale = locale as Locale;
  const availableRows = await prisma.articleContent.findMany({
    where: {
      status: "PUBLISHED",
      seoIndexable: true,
      article: { published: true, archivedAt: null },
    },
    distinct: ["locale"],
    select: { locale: true },
  });
  const availableLocales = availableRows.map((row) => row.locale);
  return managedLocalizedMetadata({
    locale: currentLocale,
    path: PUBLIC_PATHS.articles,
    title: t("modules.blog"),
    description: META_DESCRIPTION[currentLocale],
    indexable: availableLocales.includes(currentLocale),
    availableLocales,
  });
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const currentLocale = locale as Locale;
  const [t, articles] = await Promise.all([
    getTranslations("Admin"),
    getPublishedArticles(currentLocale),
  ]);
  return (
    <section className="bg-page py-[clamp(52px,7vw,104px)]">
      {articles.some((article) => article.content.seoIndexable) ? (
        <JsonLd
          data={collectionJsonLd({
            name: t("modules.blog"),
            url: absoluteLocalizedUrl(
              siteUrl(),
              PUBLIC_PATHS.articles,
              currentLocale,
            ),
            items: articles
              .filter((article) => article.content.seoIndexable)
              .map((article) => ({
                name: article.content.title,
                url: absoluteLocalizedUrl(
                  siteUrl(),
                  articlePath(article.slug),
                  currentLocale,
                ),
              })),
          })}
        />
      ) : null}
      <Container>
        <Eyebrow className="mb-3.5">Mone Beauty Clinic</Eyebrow>
        <h1 className="font-display text-h2 font-medium text-ink">
          {t("modules.blog")}
        </h1>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((article) => (
            <article
              key={article.id}
              className="relative overflow-hidden rounded-(--radius) border border-line-card bg-card"
            >
              {article.coverImage ? (
                <div className="relative block h-55">
                  <Image
                    src={article.coverImage}
                    alt={
                      article.content.imageAlt ||
                      article.coverAlt ||
                      article.content.title
                    }
                    fill
                    className="object-cover"
                    sizes="(max-width: 900px) 50vw, 33vw"
                    style={{
                      objectPosition: `${article.coverFocalX}% ${article.coverFocalY}%`,
                    }}
                  />
                </div>
              ) : null}
              <div className="p-5">
                <h2 className="font-display text-[25px] font-medium">
                  <Link
                    href={articlePath(article.slug)}
                    className="card-stretch"
                  >
                    {article.content.title}
                  </Link>
                </h2>
                {article.content.excerpt ? (
                  <p className="mt-2.5 font-sans text-compact leading-[1.7] text-body">
                    {article.content.excerpt}
                  </p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
        {!articles.length ? (
          <p className="mt-7 font-sans text-body">{t("common.empty")}</p>
        ) : null}
      </Container>
    </section>
  );
}
