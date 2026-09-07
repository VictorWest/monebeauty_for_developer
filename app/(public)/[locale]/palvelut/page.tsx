import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import {
  getIndexablePageLocales,
  getLivePageContent,
  getPublishedServices,
} from "@/lib/live-content";
import {
  absoluteLocalizedUrl,
  collectionJsonLd,
  excerpt,
  siteUrl,
} from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import { JsonLd } from "@/components/JsonLd";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [content, availableLocales] = await Promise.all([
    getLivePageContent("services", locale as Locale),
    getIndexablePageLocales("services"),
  ]);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.services,
    title: content?.seoTitle || content?.title,
    description:
      content?.seoDescription || (content ? excerpt(content.body) : undefined),
    image: content?.hero,
    imageAlt: content?.imageAlt || content?.title,
    indexable: content?.seoIndexable ?? false,
    availableLocales,
  });
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  setRequestLocale(locale);
  const [common, page, services] = await Promise.all([
    getTranslations("Common"),
    getLivePageContent("services", currentLocale),
    getPublishedServices(currentLocale),
  ]);
  if (!page) notFound();
  const visibleServices = services.filter((service) => service.publicPath);

  return (
    <section className="bg-alt py-[clamp(52px,7vw,104px)]">
      <JsonLd
        data={collectionJsonLd({
          name: page.title,
          url: absoluteLocalizedUrl(
            siteUrl(),
            PUBLIC_PATHS.services,
            currentLocale,
          ),
          items: visibleServices.map((service) => ({
            name: service.content.h1,
            url: absoluteLocalizedUrl(
              siteUrl(),
              service.publicPath as string,
              currentLocale,
            ),
          })),
        })}
      />
      <Container>
        <div className="mb-[clamp(32px,4vw,56px)] max-w-[700px]">
          <h1 className="font-display text-h2 leading-[1.06] font-medium text-ink">
            {page.title}
          </h1>
        </div>
        <div className="grid grid-cols-1 gap-[clamp(16px,1.8vw,26px)] sm:grid-cols-2 lg:grid-cols-3">
          {visibleServices.map((service, index) => {
            if (!service.publicPath) return null;
            const image = service.images[0];
            return (
              <article
                key={service.id}
                className="group relative flex min-h-full flex-col overflow-hidden rounded-[var(--radius)] border border-line-card bg-card transition-all duration-300 hover:-translate-y-[6px] hover:border-line-card-hover hover:shadow-card motion-reduce:transform-none"
              >
                <div className="relative block h-[248px] overflow-hidden bg-page">
                  <span className="absolute top-[24px] left-[20px] z-10 font-display text-[24px] text-[rgba(58,42,28,.34)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {image ? (
                    <Image
                      src={image}
                      alt={service.content.imageAlt || service.content.h1}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04] motion-reduce:transform-none"
                      sizes="(max-width: 900px) 100vw, 33vw"
                      style={{
                        objectPosition: `${service.imageFocalX}% ${service.imageFocalY}%`,
                      }}
                    />
                  ) : null}
                </div>
                <div className="flex flex-1 flex-col p-[clamp(22px,2.4vw,30px)]">
                  <h2 className="font-display text-[26px] leading-[1.1] font-semibold text-ink">
                    {service.content.h1.replace(/\s+in\s+Helsinki$/i, "")}
                  </h2>
                  <p className="mt-[14px] flex-1 font-sans text-compact leading-[1.7] font-normal text-body">
                    {excerpt(
                      service.content.shortDesc || service.content.whatItIs,
                      115,
                    )}
                  </p>
                  <div className="mt-[22px] flex items-center gap-[14px] whitespace-nowrap">
                    {service.bookable ? (
                      <Button
                        href={{
                          pathname: PUBLIC_PATHS.booking,
                          query: { service: service.slug },
                        }}
                        iconRight={ArrowRight}
                        className="relative z-[2]"
                      >
                        {common("book")}
                      </Button>
                    ) : null}
                    <Button
                      href={service.publicPath}
                      variant="textLink"
                      iconRight={ArrowUpRight}
                      className="card-stretch"
                    >
                      {common("readMore")}
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
