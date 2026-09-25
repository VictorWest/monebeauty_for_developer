import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { ImageSlot } from "@/components/ui/ImageSlot";
import Image from "next/image";
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
  const [content, availableLocales, t] = await Promise.all([
    getLivePageContent("services", locale as Locale),
    getIndexablePageLocales("services"),
    getTranslations({ locale, namespace: "HomeReference" }),
  ]);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.servicesForMen,
    title: t("areas.items.men.title"),
    description: t("areas.items.men.body"),
    image: content?.hero,
    imageAlt: content?.imageAlt,
    indexable: content?.seoIndexable ?? false,
    availableLocales,
  });
}

/**
 * A dedicated men's landing page — the homepage's "Treatments for men" card
 * used to link straight into the general services catalog, which naturally
 * shows whichever gender each service's default photo happens to be (mostly
 * women, since that's the majority of clients). Reuses the same service list
 * as /palvelut, but shows each service's `maleImage` instead of its default
 * photo, falling back to the plain placeholder (never the default photo)
 * for a service that doesn't have one yet — showing no photo at all is
 * better than showing the wrong gender.
 */
export default async function ServicesForMenPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const currentLocale = locale as Locale;
  setRequestLocale(locale);
  const [common, t, page, services] = await Promise.all([
    getTranslations("Common"),
    getTranslations("HomeReference"),
    getLivePageContent("services", currentLocale),
    getPublishedServices(currentLocale),
  ]);
  if (!page) notFound();
  const visibleServices = services.filter((service) => service.publicPath);

  return (
    <section className="bg-alt py-[clamp(52px,7vw,104px)]">
      <JsonLd
        data={collectionJsonLd({
          name: t("areas.items.men.title"),
          url: absoluteLocalizedUrl(
            siteUrl(),
            PUBLIC_PATHS.servicesForMen,
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
            {t("areas.items.men.title")}
          </h1>
          <p className="mt-4 font-sans text-[16px] leading-[1.7] text-body">
            {t("areas.items.men.body")}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-[clamp(16px,1.8vw,26px)] sm:grid-cols-2 lg:grid-cols-3">
          {visibleServices.map((service, index) => {
            if (!service.publicPath) return null;
            const image = service.maleImage;
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
                  ) : (
                    <ImageSlot minHeight={248} rounded={false} />
                  )}
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
