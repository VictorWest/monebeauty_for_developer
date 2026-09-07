import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  CalendarCheck,
  ChatCircleDots,
  ClipboardText,
  MapPin,
  ShieldCheck,
} from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { Link } from "@/i18n/navigation";
import { BOOKING_SERVICES, bookableServices } from "@/content/booking-services";
import { getPageContent } from "@/content/pages";
import { PRODUCTS } from "@/content/products";
import { CONTACT } from "@/content/site";
import { excerpt } from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
import { ProductTabs } from "./ProductTabs";
import { ServicePicker } from "./ServicePicker";
import { PUBLIC_PATHS, TECHNOLOGY_PUBLIC_PATHS } from "@/lib/public-routes";

const technologyRows = [
  [
    "instrumental/endosphere",
    TECHNOLOGY_PUBLIC_PATHS.endospheres,
    "/media/clinic/endospheres/endospheres-treatment.png",
  ],
  [
    "instrumental/laser",
    TECHNOLOGY_PUBLIC_PATHS.laser,
    "/media/clinic/laser/laser-forearm-hair-removal.jpeg",
  ],
  [
    "instrumental/mikroneulanrf",
    TECHNOLOGY_PUBLIC_PATHS.rf,
    "/media/files/land/280/21b80358547be97456baf00ac6a98ac9.jpeg",
  ],
  [
    "trichology",
    TECHNOLOGY_PUBLIC_PATHS.trichology,
    "/media/files/land/303/8b2e9288e47ba7705d700a8d7edb596e.jpeg",
  ],
] as const;

export async function StandardOfCare() {
  const t = await getTranslations("HomeEditorial");
  const icons = [ClipboardText, ShieldCheck, CalendarCheck] as const;
  return (
    <section id="standard" className="bg-page py-[clamp(68px,8vw,118px)]">
      <Container>
        <div className="grid gap-[36px] nav:grid-cols-[.8fr_2fr]">
          <div>
            <Eyebrow>{t("standard.eyebrow")}</Eyebrow>
            <h2 className="mt-[16px] font-display text-h2-treat leading-[1.08] font-medium text-ink">
              {t("standard.heading")}
            </h2>
          </div>
          <ol className="grid gap-[22px] sm:grid-cols-3">
            {icons.map((Icon, index) => (
              <li key={index} className="border-t border-line-hair pt-[22px]">
                <div className="flex items-center justify-between">
                  <Icon size={27} weight="thin" className="text-accent" />
                  <span className="font-display text-[24px] text-line-card-hover">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-[22px] font-display text-[25px] font-medium text-ink">
                  {t(`standard.items.${index}.title`)}
                </h3>
                <p className="mt-[10px] text-[14px] leading-[1.7] font-light text-body">
                  {t(`standard.items.${index}.body`)}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}

export async function ClinicalServices() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("HomeEditorial");
  const tb = await getTranslations("Booking");
  const tc = await getTranslations("Common");
  const real = BOOKING_SERVICES.slice(0, 6);
  const stubs = BOOKING_SERVICES.filter((service) => !service.bookable);
  const cards = [...real, ...stubs];
  const featured = cards[0];
  const titleFor = (key: string) =>
    key === "injectable" || key === "consultation"
      ? t(`services.stubs.${key}`)
      : tb(`services.${key}`);
  return (
    <section id="treatments" className="bg-alt py-[clamp(68px,8vw,118px)]">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-[20px]">
          <div>
            <Eyebrow>{t("services.eyebrow")}</Eyebrow>
            <h2 className="mt-[14px] font-display text-h2 leading-[1.06] font-medium text-ink">
              {t("services.heading")}
            </h2>
          </div>
          <Button
            href={PUBLIC_PATHS.services}
            variant="textLink"
            iconRight={ArrowRight}
          >
            {tc("allServices")}
          </Button>
        </div>
        <article className="mt-[42px] grid overflow-hidden rounded-[var(--radius)] bg-card nav:grid-cols-[1.25fr_.75fr]">
          <ImageSlot
            src={featured.image}
            alt={titleFor(featured.key)}
            minHeight={440}
            rounded={false}
          />
          <div className="flex flex-col justify-center p-[clamp(28px,5vw,64px)]">
            <span className="text-[11px] tracking-[.2em] text-accent uppercase">
              01 · {t("services.featured")}
            </span>
            <h3 className="mt-[16px] font-display text-[clamp(30px,4vw,48px)] leading-[1.05] font-medium">
              {titleFor(featured.key)}
            </h3>
            <p className="mt-[18px] text-[14px] leading-[1.75] font-light text-body">
              {excerpt(
                getPageContent(featured.contentSlug!, locale)?.body ?? "",
                210,
              )}
            </p>
            <div className="mt-[28px]">
              <Button
                href={{
                  pathname: PUBLIC_PATHS.booking,
                  query: { service: featured.key },
                }}
                iconRight={ArrowRight}
              >
                {tc("book")}
              </Button>
            </div>
          </div>
        </article>
        <div className="mt-[22px] grid gap-[18px] nav:grid-cols-3 sm:grid-cols-2">
          {cards.slice(1).map((service, index) => {
            const page = service.contentSlug
              ? getPageContent(service.contentSlug, locale)
              : null;
            return (
              <article
                key={service.key}
                className="flex min-h-[270px] flex-col rounded-[var(--radius)] border border-line-card bg-card p-[24px] transition-all hover:-translate-y-1 hover:shadow-card"
              >
                <span className="font-display text-[21px] text-line-card-hover">
                  {String(index + 2).padStart(2, "0")}
                </span>
                <h3 className="mt-[26px] font-display text-[27px] leading-[1.1] font-medium">
                  {titleFor(service.key)}
                </h3>
                <p className="mt-[12px] flex-1 text-[13px] leading-[1.65] font-light text-body">
                  {page ? excerpt(page.body, 130) : "[CLINIC TO PROVIDE]"}
                </p>
                {service.bookable ? (
                  <Link
                    href={{
                      pathname: PUBLIC_PATHS.booking,
                      query: { service: service.key },
                    }}
                    className="mt-[20px] inline-flex items-center gap-[8px] text-[11px] font-medium tracking-[.15em] text-accent uppercase"
                  >
                    {tc("book")}
                    <ArrowRight size={15} />
                  </Link>
                ) : (
                  <span className="mt-[20px] text-[10px] tracking-[.12em] text-muted uppercase">
                    [CLINIC TO PROVIDE]
                  </span>
                )}
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

export async function Technologies() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("HomeEditorial");
  const tc = await getTranslations("Common");
  return (
    <section id="technologies" className="bg-page py-[clamp(68px,8vw,118px)]">
      <Container>
        <div className="text-center">
          <Eyebrow>{t("technology.eyebrow")}</Eyebrow>
          <h2 className="mt-[14px] font-display text-h2 font-medium">
            {t("technology.heading")}
          </h2>
        </div>
        <div className="mt-[48px] space-y-[clamp(48px,7vw,88px)]">
          {technologyRows.map(([slug, href, image], index) => {
            const page = getPageContent(slug, locale);
            if (!page) return null;
            return (
              <article
                key={slug}
                className="grid items-center gap-[clamp(28px,6vw,74px)] nav:grid-cols-2"
              >
                <div className={index % 2 ? "nav:order-2" : ""}>
                  <ImageSlot src={image} alt={page.title} minHeight={390} />
                </div>
                <div>
                  <span className="font-display text-[22px] text-line-card-hover">
                    0{index + 1}
                  </span>
                  <h3 className="mt-[16px] font-display text-[clamp(30px,3.7vw,48px)] leading-[1.06] font-medium">
                    {page.title}
                  </h3>
                  <p className="mt-[18px] text-[15px] leading-[1.8] font-light text-body">
                    {excerpt(page.body, 260)}
                  </p>
                  <div className="mt-[26px]">
                    <Button
                      href={href}
                      variant="textLink"
                      iconRight={ArrowRight}
                    >
                      {tc("readMore")}
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

export async function ProductShowcase() {
  const locale = (await getLocale()) as Locale;
  const t = await getTranslations("HomeEditorial");
  const cat = await getTranslations("Catalog");
  return (
    <section id="products" className="bg-alt py-[clamp(68px,8vw,118px)]">
      <Container>
        <div className="max-w-[720px]">
          <Eyebrow>{t("products.eyebrow")}</Eyebrow>
          <h2 className="mt-[14px] font-display text-h2 font-medium">
            {t("products.heading")}
          </h2>
          <p className="mt-[16px] text-[15px] leading-[1.75] font-light text-body">
            {t("products.lead")}
          </p>
        </div>
        <ProductTabs
          products={PRODUCTS}
          locale={locale}
          labels={{
            AROSHA_BODY: cat("categoryBody"),
            DIXIDOX_TRICHO: cat("categoryTricho"),
          }}
          intoBasket={cat("intoBasket")}
        />
        <div className="mt-[36px] text-center">
          <Button
            href={PUBLIC_PATHS.shop}
            variant="outline"
            iconRight={ArrowRight}
          >
            {t("products.all")}
          </Button>
        </div>
      </Container>
    </section>
  );
}

export async function BookingAndContact() {
  const t = await getTranslations("HomeEditorial");
  const tb = await getTranslations("Booking");
  const services = bookableServices().map((service) => ({
    key: service.key,
    title: tb(`services.${service.key}`),
  }));
  return (
    <>
      <section id="booking" className="bg-page py-[clamp(68px,8vw,112px)]">
        <Container>
          <div className="grid overflow-hidden rounded-[var(--radius)] bg-cta nav:grid-cols-[1fr_.85fr]">
            <div className="p-[clamp(30px,6vw,76px)]">
              <Eyebrow className="text-gold">{t("booking.eyebrow")}</Eyebrow>
              <h2 className="mt-[16px] font-display text-h2-cta leading-[1.06] font-medium text-cta-heading">
                {t("booking.heading")}
              </h2>
              <p className="mt-[18px] max-w-[560px] text-[15px] leading-[1.75] font-light text-cta-body">
                {t("booking.lead")}
              </p>
              <div className="mt-[28px]">
                <ServicePicker
                  services={services}
                  labels={{
                    placeholder: t("booking.placeholder"),
                    cta: t("booking.cta"),
                  }}
                />
              </div>
            </div>
            <ImageSlot
              src="/media/home/about.jpg"
              alt={t("booking.heading")}
              minHeight={400}
              rounded={false}
              tone="dark"
            />
          </div>
        </Container>
      </section>
      <section className="bg-alt py-[clamp(64px,7vw,100px)]">
        <Container>
          <div className="grid gap-[36px] nav:grid-cols-[1fr_1fr]">
            <div>
              <Eyebrow>{t("contact.eyebrow")}</Eyebrow>
              <h2 className="mt-[14px] font-display text-h2-treat font-medium">
                {t("contact.heading")}
              </h2>
              <p className="mt-[18px] max-w-[580px] text-[15px] leading-[1.8] font-light text-body">
                {t("contact.lead")}
              </p>
            </div>
            <div className="grid gap-[16px] sm:grid-cols-2">
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(`${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}`)}`}
                className="rounded-[var(--radius)] border border-line-card bg-card p-[22px]"
              >
                <MapPin size={25} weight="thin" className="text-accent" />
                <span className="mt-[16px] block text-[13px] leading-[1.6]">
                  {CONTACT.address.street}
                  <br />
                  {CONTACT.address.postalCode} {CONTACT.address.city}
                </span>
              </a>
              <a
                href={CONTACT.phoneHref}
                className="rounded-[var(--radius)] border border-line-card bg-card p-[22px]"
              >
                <ChatCircleDots
                  size={25}
                  weight="thin"
                  className="text-accent"
                />
                <span className="mt-[16px] block text-[13px]">
                  {CONTACT.phone}
                  <br />
                  {CONTACT.email}
                </span>
              </a>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
