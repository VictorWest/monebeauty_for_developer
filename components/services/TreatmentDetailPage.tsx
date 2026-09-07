import Image from "next/image";
import { ArrowRight, EnvelopeSimple } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Markdown } from "@/components/Markdown";
import { JsonLd } from "@/components/JsonLd";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { CONTACT } from "@/content/site";
import { resolveProcedureImage } from "@/lib/procedure-media";
import { removeRepeatedMarkdownSummary } from "@/lib/markdown-normalization";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  serviceJsonLd,
  siteUrl,
} from "@/lib/seo";

const copy = {
  en: {
    services: "Services",
    duration: "Duration",
    price: "Price",
    book: "Book now",
    contact: "Contact the clinic",
    firstVisit:
      "The online reservation covers the first visit. Remaining sessions are arranged directly with the clinic.",
  },
  fi: {
    services: "Palvelut",
    duration: "Kesto",
    price: "Hinta",
    book: "Varaa nyt",
    contact: "Ota yhteyttä klinikkaan",
    firstVisit:
      "Verkkoajanvaraus koskee ensimmäistä käyntiä. Loput hoitokerrat sovitaan suoraan klinikan kanssa.",
  },
  ru: {
    services: "Услуги",
    duration: "Продолжительность",
    price: "Цена",
    book: "Записаться",
    contact: "Связаться с клиникой",
    firstVisit:
      "Онлайн-запись оформляется на первое посещение. Остальные сеансы согласуются напрямую с клиникой.",
  },
} as const;

export function TreatmentDetailPage({
  option,
  locale,
  servicePath,
  optionPath,
}: {
  option: Awaited<
    ReturnType<typeof import("@/lib/live-content").getPublishedServiceOption>
  > & {};
  locale: Locale;
  servicePath: string;
  optionPath: string;
}) {
  if (!option) return null;
  const t = copy[locale];
  const image =
    option.image ??
    resolveProcedureImage({
      serviceSlug: option.service.slug,
      locale,
      procedure: {
        group: option.content.group,
        title: option.content.name,
        description: option.content.description,
        price: option.content.priceLabel ?? "",
      },
      records: option.service.procedureMedia,
    }) ??
    option.service.images[0] ??
    null;
  const canonical = absoluteLocalizedUrl(siteUrl(), optionPath, locale);
  const serviceCanonical = absoluteLocalizedUrl(siteUrl(), servicePath, locale);
  const isCourse = option.type === "COURSE";
  const bookable =
    (option.type === "APPOINTMENT" || option.type === "COURSE") &&
    option.bookable;
  const description = removeRepeatedMarkdownSummary(
    option.content.description,
    option.content.summary,
  );

  return (
    <article className="bg-page">
      <JsonLd
        data={[
          serviceJsonLd({
            name: option.content.name,
            description: option.content.summary || option.content.description,
            url: canonical,
            image,
            locale,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            {
              name: t.services,
              url: absoluteLocalizedUrl(
                siteUrl(),
                PUBLIC_PATHS.services,
                locale,
              ),
            },
            { name: option.service.content.h1, url: serviceCanonical },
            { name: option.content.name, url: canonical },
          ]),
        ]}
      />
      <Container className="py-[clamp(24px,4vw,44px)]">
        <nav
          aria-label="Breadcrumb"
          className="font-sans text-label text-muted"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href={PUBLIC_PATHS.services} className="hover:text-accent">
                {t.services}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={servicePath} className="hover:text-accent">
                {option.service.content.h1}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-body">
              {option.content.name}
            </li>
          </ol>
        </nav>
      </Container>

      <section className="pb-[clamp(48px,7vw,88px)]">
        <Container>
          <div className="grid items-center gap-[clamp(28px,5vw,72px)] lg:grid-cols-[minmax(0,1fr)_minmax(360px,.82fr)]">
            <div>
              {option.content.group ? (
                <Eyebrow className="mb-4">{option.content.group}</Eyebrow>
              ) : null}
              <h1 className="font-display text-[clamp(38px,5.6vw,68px)] leading-[1.02] font-medium text-ink">
                {option.content.name}
              </h1>
              {option.content.summary ? (
                <Markdown
                  variant="treatment-summary"
                  className="mt-5 max-w-[62ch] [&_li]:text-[clamp(17px,2vw,20px)] [&_p]:text-[clamp(17px,2vw,20px)]"
                >
                  {option.content.summary}
                </Markdown>
              ) : null}
              <dl className="mt-7 flex flex-wrap gap-x-10 gap-y-4 border-y border-line-hair py-5 font-sans">
                {option.content.durationLabel ? (
                  <div>
                    <dt className="text-meta tracking-[.12em] text-muted uppercase">
                      {t.duration}
                    </dt>
                    <dd className="mt-1 text-ink">
                      {option.content.durationLabel}
                    </dd>
                  </div>
                ) : null}
                {option.content.priceLabel ? (
                  <div>
                    <dt className="text-meta tracking-[.12em] text-muted uppercase">
                      {t.price}
                    </dt>
                    <dd className="mt-1 font-medium text-ink">
                      {option.content.priceLabel}
                    </dd>
                  </div>
                ) : null}
              </dl>
              {isCourse ? (
                <p className="mt-5 max-w-[62ch] font-sans text-[14px] leading-[1.7] text-muted">
                  {t.firstVisit}
                </p>
              ) : null}
              <div className="mt-7">
                {bookable ? (
                  <Button
                    href={{
                      pathname: PUBLIC_PATHS.booking,
                      query: {
                        service: option.service.slug,
                        option: option.key,
                      },
                    }}
                    iconRight={ArrowRight}
                    className="min-h-11 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    {t.book}
                  </Button>
                ) : (
                  <ButtonLink
                    href={`mailto:${CONTACT.email}`}
                    newTab={false}
                    iconRight={EnvelopeSimple}
                  >
                    {t.contact}
                  </ButtonLink>
                )}
              </div>
            </div>
            {image ? (
              <div className="relative aspect-4/5 overflow-hidden rounded-(--radius) shadow-(--shadow-card)">
                <Image
                  src={image}
                  alt={option.content.imageAlt || option.content.name}
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width:1024px) 42vw, 100vw"
                  style={{
                    objectPosition: option.image
                      ? `${option.imageFocalX}% ${option.imageFocalY}%`
                      : "50% 50%",
                  }}
                />
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="border-t border-line-hair bg-alt py-[clamp(48px,7vw,88px)]">
        <Container>
          <div className="mx-auto max-w-205">
            <Markdown variant="treatment-detail">{description}</Markdown>
          </div>
        </Container>
      </section>
    </article>
  );
}
