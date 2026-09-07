import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { TreatmentInformation } from "@/components/services/TreatmentInformation";
import { ServiceCourseCards } from "@/components/services/ServiceCourseCards";
import { EndospheresEditorial } from "@/components/endospheres/EndospheresEditorial";
import { BeforeAfterGallery } from "@/components/endospheres/BeforeAfterGallery";
import { Markdown } from "@/components/Markdown";
import { getPublishedServiceByPath } from "@/lib/live-content";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  excerpt,
  faqJsonLd,
  serviceJsonLd,
  siteUrl,
} from "@/lib/seo";

const overviewHeading = {
  en: "About these treatments",
  fi: "Tietoa hoidoista",
  ru: "О процедурах",
} as const;

const bookCopy = {
  en: {
    heading: "Ready to book Endospheres Therapy®?",
    action: "Book an appointment.",
  },
  fi: {
    heading: "Valmis varaamaan Endospheres Therapy® -hoidon?",
    action: "Varaa aika.",
  },
  ru: {
    heading: "Готовы записаться на Endospheres Therapy®?",
    action: "Записаться на приём.",
  },
} as const;

export async function ServiceDetailPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const service = await getPublishedServiceByPath(`/${slug}`, locale);
  if (!service) notFound();
  const nav = await getTranslations("Nav");
  const isEndospheres = service.slug === "endospheres";
  const heroImage = service.images[0];
  const summary =
    service.content.shortDesc.trim() || excerpt(service.content.whatItIs, 220);
  const categoryOverview = service.content.whatItIs.trim();
  const options = service.options.flatMap((option) => {
    const content = option.contents[0];
    return content
      ? [
          {
            key: option.key,
            type: option.type,
            bookable: option.bookable,
            group: content.group,
            name: content.name,
            summary: content.summary,
            durationLabel: content.durationLabel,
            priceLabel: content.priceLabel,
            image: option.image,
            imageAlt: content.imageAlt,
            imageFocalX: option.imageFocalX,
            imageFocalY: option.imageFocalY,
          },
        ]
      : [];
  });
  const path = `/${slug}`;
  const canonical = absoluteLocalizedUrl(siteUrl(), path, locale);
  const faq = Array.isArray(service.content.faq)
    ? service.content.faq.flatMap((item) => {
        if (
          typeof item === "object" &&
          item !== null &&
          "q" in item &&
          "a" in item &&
          typeof item.q === "string" &&
          typeof item.a === "string"
        )
          return [{ q: item.q, a: item.a }];
        return [];
      })
    : [];

  return (
    <article className="bg-page">
      <JsonLd
        data={[
          serviceJsonLd({
            name: service.content.h1,
            description: summary,
            url: canonical,
            image: heroImage,
            locale,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            {
              name: nav("services"),
              url: absoluteLocalizedUrl(
                siteUrl(),
                PUBLIC_PATHS.services,
                locale,
              ),
            },
            { name: service.content.h1, url: canonical },
          ]),
          ...(faq.length ? [faqJsonLd(faq)] : []),
        ]}
      />
      <section className="relative isolate min-h-[clamp(380px,56vh,600px)] overflow-hidden">
        {heroImage ? (
          <>
            <Image
              src={heroImage}
              alt={service.content.imageAlt || service.content.h1}
              fill
              priority
              className="object-cover"
              sizes="100vw"
              style={{
                objectPosition: `${service.imageFocalX}% ${service.imageFocalY}%`,
              }}
            />
            <div className="absolute inset-0 bg-linear-to-t from-[rgba(34,30,27,.88)] via-[rgba(34,30,27,.42)] to-[rgba(34,30,27,.16)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-alt" />
        )}
        <Container className="absolute inset-x-0 bottom-0 pb-[clamp(28px,4.5vw,64px)]">
          <Eyebrow
            tone={heroImage ? "gold" : "accent"}
            tracking="wide"
            className="mb-3.5"
          >
            {nav("services")}
          </Eyebrow>
          <h1
            className={`font-display text-[clamp(34px,4.6vw,64px)] leading-[1.03] font-medium ${
              heroImage ? "text-cta-heading" : "text-ink"
            }`}
          >
            {service.content.h1}
          </h1>
          <p
            className={`mt-4 max-w-[52ch] font-sans text-copy leading-[1.75] font-normal ${
              heroImage
                ? "text-cta-heading [text-shadow:0_1px_10px_rgba(58,42,28,.72)]"
                : "text-body"
            }`}
          >
            {summary}
          </p>
        </Container>
      </section>

      {categoryOverview ? (
        <section className="py-[clamp(48px,7vw,80px)]">
          <Container>
            <div className="mx-auto grid max-w-265 gap-6 md:grid-cols-[minmax(220px,.7fr)_minmax(0,1.3fr)] md:gap-14">
              <h2 className="font-display text-[clamp(30px,4vw,44px)] leading-[1.08] font-medium text-ink">
                {overviewHeading[locale]}
              </h2>
              <div className="font-sans text-[clamp(17px,2vw,20px)] leading-[1.8] text-ink [&_p+p]:mt-5">
                <Markdown>{categoryOverview}</Markdown>
              </div>
            </div>
          </Container>
        </section>
      ) : null}
      {isEndospheres ? (
        <>
          {/*
           * The clinic asked for this order specifically: read what the
           * treatment is, see it, then book. The editorial carries the
           * photographs, so the cards follow the booking prompt rather than
           * separating the description from it.
           */}
          <EndospheresEditorial locale={locale} />
          <section className="border-t border-line-hair py-[clamp(40px,6vw,72px)]">
            <Container>
              <div className="mx-auto flex max-w-265 flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-display text-[clamp(26px,3.2vw,38px)] leading-[1.1] font-medium text-ink">
                  {bookCopy[locale].heading}
                </h2>
                <Button
                  href={{
                    pathname: PUBLIC_PATHS.booking,
                    query: { service: service.slug },
                  }}
                  iconRight={CalendarBlank}
                >
                  {bookCopy[locale].action}
                </Button>
              </div>
            </Container>
          </section>
          {options.length ? (
            <ServiceCourseCards
              serviceKey={service.slug}
              options={options}
              locale={locale}
            />
          ) : null}
          <BeforeAfterGallery locale={locale} />
        </>
      ) : (
        <>
          {options.length ? (
            <ServiceCourseCards
              serviceKey={service.slug}
              options={options}
              locale={locale}
            />
          ) : null}
          <section className="py-[clamp(48px,7vw,88px)]">
            <Container>
              <TreatmentInformation
                locale={locale}
                showWhatItIs={false}
                content={service.content}
              />
            </Container>
          </section>
        </>
      )}
    </article>
  );
}
