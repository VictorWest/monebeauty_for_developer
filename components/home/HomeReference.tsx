"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  FlowerLotus,
  Hourglass,
  Phone,
  User,
  WhatsappLogo,
  EnvelopeSimple,
  LockSimple,
  Flask,
  InstagramLogo,
  FacebookLogo,
  Certificate,
  ShieldCheck,
  TestTube,
  UserFocus,
} from "@phosphor-icons/react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  BotanicalSprig,
  BodyIcon,
  FaceProfileIcon,
  HairIcon,
  MaleIcon,
} from "@/components/home/TreatmentAreaIcons";
import { AddToCartButton } from "@/components/shop/AddToCartButton";
import type { Product } from "@/content/products";
import { CONTACT, SOCIALS } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import { cormorant } from "@/lib/fonts";
import { excerpt } from "@/lib/seo";
import {
  BOOKING_HANDOFF_KEY,
  createBookingHandoff,
} from "@/lib/booking-handoff";
import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  productPath,
} from "@/lib/public-routes";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { clinicTodayYmd } from "@/lib/clinic-date";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import type { PublicManagedImage } from "@/lib/site-media";

function addBookingDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const productOrder = {
  AROSHA_BODY: [
    "stretch-marks-200ml-1",
    "518-b-tone-100ml-3",
    "cellulite-200ml-4",
    "lipolytic-200ml-5",
    "peeling-120ml-6",
    "nio-drain-9",
    "516-cellunight-200ml-night-10",
    "breast-amp-decollete-11",
  ],
  DIXIDOX_TRICHO: [
    "1-1-dixidox-de-luxe-41",
    "1-3-dixidox-de-luxe-peeling-42",
    "2-1-dixidox-de-luxe-shampoo-43",
    "2-4-dixidox-de-luxe-lotion-44",
    "3-1-dixidox-de-luxe-shampoo-45",
    "3-4-dixidox-de-luxe-lotion-46",
    "3-4-2-crexepil-de-luxe-classic-47",
    "3-4-5-science-7-de-luxe-lotion-48",
  ],
} as const;

/**
 * The three care areas the clinic is organised around (SCOPE.md: "face, body, and hair"),
 * each pointing at the service page that already covers it. Deliberately a separate,
 * hand-curated list rather than a slice of `services`: this is the category-level entry
 * point, not the bookable-service list rendered below it in `#treatments`.
 */
const TREATMENT_AREAS = [
  {
    key: "face",
    href: SERVICE_PUBLIC_PATHS.facial,
    mediaKey: "home.area.face",
    Icon: FaceProfileIcon,
  },
  {
    key: "body",
    href: SERVICE_PUBLIC_PATHS.body,
    mediaKey: "home.area.body",
    Icon: BodyIcon,
  },
  {
    key: "hair",
    href: SERVICE_PUBLIC_PATHS.trichology,
    mediaKey: "home.area.hair",
    Icon: HairIcon,
  },
] as const;

const AREA_BENEFITS = [
  ["personalized", User],
  ["natural", FlowerLotus],
  ["longTerm", Hourglass],
] as const;

export const productDescriptions: Record<Locale, Record<string, string>> = {
  en: {
    "stretch-marks-200ml-1": "Targeted cream for stretch marks.",
    "518-b-tone-100ml-3": "Firming body concentrate.",
    "cellulite-200ml-4": "Anti-cellulite body gel.",
    "lipolytic-200ml-5": "Contouring lipolytic treatment.",
    "peeling-120ml-6": "Exfoliating body peeling.",
    "nio-drain-9": "Draining body concentrate.",
    "516-cellunight-200ml-night-10": "Overnight cellulite treatment.",
    "breast-amp-decollete-11": "Firming décolleté care.",
    "1-1-dixidox-de-luxe-41": "Antiseborrheic scalp shampoo.",
    "1-3-dixidox-de-luxe-peeling-42": "Purifying scalp peeling.",
    "2-1-dixidox-de-luxe-shampoo-43": "Anti-dandruff shampoo.",
    "2-4-dixidox-de-luxe-lotion-44": "Anti-dandruff scalp lotion.",
    "3-1-dixidox-de-luxe-shampoo-45": "Intensive scalp shampoo.",
    "3-4-dixidox-de-luxe-lotion-46": "Fortifying scalp lotion.",
    "3-4-2-crexepil-de-luxe-classic-47": "Classic scalp care lotion.",
    "3-4-5-science-7-de-luxe-lotion-48": "Advanced scalp lotion.",
  },
  fi: {
    "stretch-marks-200ml-1": "Kohdennettu voide raskausarville.",
    "518-b-tone-100ml-3": "Kiinteyttävä vartalotiiviste.",
    "cellulite-200ml-4": "Selluliittia hoitava vartalogeeli.",
    "lipolytic-200ml-5": "Muotoileva lipolyyttinen hoito.",
    "peeling-120ml-6": "Kuoriva vartalokuorinta.",
    "nio-drain-9": "Nestekiertoa tukeva vartalotiiviste.",
    "516-cellunight-200ml-night-10": "Yön yli vaikuttava selluliittihoito.",
    "breast-amp-decollete-11": "Kiinteyttävä dekolteen hoito.",
    "1-1-dixidox-de-luxe-41": "Antiseborrooinen hiuspohjashampoo.",
    "1-3-dixidox-de-luxe-peeling-42": "Puhdistava hiuspohjan kuorinta.",
    "2-1-dixidox-de-luxe-shampoo-43": "Hilsettä ehkäisevä shampoo.",
    "2-4-dixidox-de-luxe-lotion-44":
      "Hilsettä ehkäisevä hiuspohjan hoitoneste.",
    "3-1-dixidox-de-luxe-shampoo-45": "Tehokas hiuspohjashampoo.",
    "3-4-dixidox-de-luxe-lotion-46": "Vahvistava hiuspohjan hoitoneste.",
    "3-4-2-crexepil-de-luxe-classic-47": "Klassinen hiuspohjan hoitoneste.",
    "3-4-5-science-7-de-luxe-lotion-48":
      "Edistyksellinen hiuspohjan hoitoneste.",
  },
  ru: {
    "stretch-marks-200ml-1": "Целевой крем против растяжек.",
    "518-b-tone-100ml-3": "Укрепляющий концентрат для тела.",
    "cellulite-200ml-4": "Антицеллюлитный гель для тела.",
    "lipolytic-200ml-5": "Липолитическое средство для контуров тела.",
    "peeling-120ml-6": "Отшелушивающий пилинг для тела.",
    "nio-drain-9": "Дренирующий концентрат для тела.",
    "516-cellunight-200ml-night-10": "Ночной антицеллюлитный уход.",
    "breast-amp-decollete-11": "Укрепляющий уход за зоной декольте.",
    "1-1-dixidox-de-luxe-41": "Антисеборейный шампунь для кожи головы.",
    "1-3-dixidox-de-luxe-peeling-42": "Очищающий пилинг кожи головы.",
    "2-1-dixidox-de-luxe-shampoo-43": "Шампунь против перхоти.",
    "2-4-dixidox-de-luxe-lotion-44": "Лосьон для кожи головы против перхоти.",
    "3-1-dixidox-de-luxe-shampoo-45": "Интенсивный шампунь для кожи головы.",
    "3-4-dixidox-de-luxe-lotion-46": "Укрепляющий лосьон для кожи головы.",
    "3-4-2-crexepil-de-luxe-classic-47": "Классический лосьон для кожи головы.",
    "3-4-5-science-7-de-luxe-lotion-48":
      "Инновационный лосьон для кожи головы.",
  },
};

function Marker({ children }: { children: React.ReactNode }) {
  return (
    <span className="hr-marker">
      <span>{children}</span>
    </span>
  );
}

type HomeService = {
  key: string;
  name: string;
  description: string;
  durationMin: number;
  image: string | null;
  imageFocalX: number;
  imageFocalY: number;
  href: string;
};
type HomeTechnology = {
  key: string;
  name: string;
  specification: string | null;
  body: string;
  image: string | null;
  imageFocalX: number;
  imageFocalY: number;
  href: string;
  bookingKey: string | null;
};

// Owner decision: retain the database-owned technology content and routes, but do not
// present this section on the homepage until the owner explicitly restores it.
const HOMEPAGE_TECHNOLOGIES_ARCHIVED = true;

export function HomeReference({
  services,
  technologies,
  productCatalog,
  siteMedia,
}: {
  services: HomeService[];
  technologies: HomeTechnology[];
  productCatalog: Product[];
  siteMedia: Record<string, PublicManagedImage>;
}) {
  const t = useTranslations("HomeReference");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const heroMedia = siteMedia["home.hero-poster"];
  const [tab, setTab] = useState<"AROSHA_BODY" | "DIXIDOX_TRICHO">(
    "AROSHA_BODY",
  );
  const [selected, setSelected] = useState("");
  const [availableDates, setAvailableDates] = useState<string[] | undefined>();
  const products = productOrder[tab]
    .map((slug) => productCatalog.find((product) => product.slug === slug))
    .filter((product): product is Product => Boolean(product));
  useEffect(() => {
    const elements = document.querySelectorAll<HTMLElement>(
      ".home-reference .hr-section-head, .home-reference .hr-care article, .home-reference .hr-areas article, .home-reference .hr-areas-wide > *, .home-reference .hr-services article, .home-reference .hr-tech article, .home-reference .hr-products article, .home-reference .hr-booking > *",
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elements.forEach((element) => element.classList.add("hr-visible"));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("hr-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [tab]);
  useEffect(() => {
    const service = selected || "facial";
    const from = clinicTodayYmd();
    const to = addBookingDays(from, BUSINESS_HOURS.daysAhead);
    let live = true;
    fetch(
      `/api/booking/availability?from=${from}&to=${to}&service=${encodeURIComponent(service)}&locale=${locale}`,
    )
      .then((response) =>
        response.json().then((data) => ({ ok: response.ok, data })),
      )
      .then(({ ok, data }) => {
        if (live)
          setAvailableDates(
            ok && !data.degraded && Array.isArray(data.dates)
              ? data.dates
              : undefined,
          );
      })
      .catch(() => {
        if (live) setAvailableDates(undefined);
      });
    return () => {
      live = false;
    };
  }, [locale, selected]);
  const nav = [
    ["treatments", t("nav.treatments")],
    ...(!HOMEPAGE_TECHNOLOGIES_ARCHIVED
      ? ([["technologies", t("nav.technologies")]] as const)
      : []),
    ["products", t("nav.products")],
    ["standard", t("nav.standard")],
    ["booking", t("nav.consultation")],
  ];
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const key = String(fd.get("service") || selected || "facial");
    const handoff = createBookingHandoff({
      service: key,
      preferredDate: String(fd.get("date") || ""),
      fullName: String(fd.get("name") || ""),
      phone: String(fd.get("phone") || ""),
      email: String(fd.get("email") || ""),
      notes: String(fd.get("notes") || ""),
    });
    try {
      window.sessionStorage.setItem(
        BOOKING_HANDOFF_KEY,
        JSON.stringify(handoff),
      );
    } catch {
      // Navigation still works when tab-scoped storage is unavailable.
    }
    router.push({ pathname: PUBLIC_PATHS.booking, query: { service: key } });
  };
  return (
    <div className="home-reference" id="top">
      <main>
        <section className="hr-hero">
          <div className="hr-container">
            <div className="hr-meta">
              <span>{t("hero.metaLeft")}</span>
              <span>{t("hero.metaRight")}</span>
            </div>
            <div className="hr-hero-copy">
              <h1>{t("hero.title")}</h1>
              <p>{t("hero.lead")}</p>
              <div>
                <Link className="hr-btn dark" href={PUBLIC_PATHS.booking}>
                  {t("common.bookOnline")}
                </Link>
                <a className="hr-btn ghost" href="#treatments">
                  {t("hero.explore")}
                </a>
              </div>
            </div>
            {/* A frame lifted from the hero clip rather than a remote stock photo: this is the
                LCP element, and fetching it from Unsplash made the origin do a cross-internet
                round trip before it could serve the largest thing above the fold. */}
            <div className="hr-hero-image">
              <Image
                src={heroMedia.image!}
                alt={heroMedia.alt || t("hero.imageAlt")}
                fill
                priority
                sizes="100vw"
                style={{
                  objectPosition: `${heroMedia.focalX}% ${heroMedia.focalY}%`,
                }}
              />
              <video
                muted
                loop
                autoPlay
                playsInline
                poster={heroMedia.image ?? undefined}
              >
                <source src="/media/hero.mp4" type="video/mp4" />
              </video>
              <span>{t("hero.tag")}</span>
            </div>
            <dl className="hr-strip">
              {["location", "hours", "telephone"].map((k) => (
                <div key={k}>
                  <dt>{t(`hero.facts.${k}.label`)}</dt>
                  <dd>{t(`hero.facts.${k}.value`)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
        <Section
          id="standard"
          alt
          marker={t("standard.marker")}
          title={t("standard.title")}
          lead={t("standard.lead")}
        >
          <div className="hr-care">
            {["consultation", "diagnosis", "plan", "care"].map((k, i) => (
              <article key={k}>
                <span className={cormorant.className}>0{i + 1}</span>
                <h3>{t(`standard.items.${k}.title`)}</h3>
                <p>{t(`standard.items.${k}.body`)}</p>
              </article>
            ))}
          </div>
          <div className="hr-creds">
            {[
              ["licensed", Certificate],
              ["eu", ShieldCheck],
              ["evidence", TestTube],
              ["personalized", UserFocus],
              ["gdpr", LockSimple],
            ].map(([key, Icon]) => (
              <span key={key as string}>
                <Icon size={17} weight="thin" />
                {t(`standard.credentials.${key as string}`)}
              </span>
            ))}
          </div>
        </Section>
        <Section
          id="areas"
          headClassName="hr-areas-head"
          marker={t("areas.marker")}
          title={t("areas.title")}
          lead={t("areas.lead")}
        >
          <div className="hr-areas-shell">
            <div className="hr-areas">
              {TREATMENT_AREAS.map(({ key, href, mediaKey, Icon }) => {
                const media = siteMedia[mediaKey];
                return (
                  <article key={key}>
                    <div className="hr-area-image">
                      {media?.image ? (
                        <Image
                          src={media.image}
                          alt={media.alt}
                          fill
                          className={`hr-area-photo hr-area-photo-${key}`}
                          sizes="(min-width: 1040px) 363px, (min-width: 680px) 50vw, 100vw"
                          style={{
                            objectPosition: `${media.focalX}% ${media.focalY}%`,
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="hr-area-body">
                      <span className="hr-area-icon">
                        <Icon size={40} />
                      </span>
                      <div>
                        <h3 className={cormorant.className}>
                          {t(`areas.items.${key}.title`)}
                        </h3>
                        <p>{t(`areas.items.${key}.body`)}</p>
                        <Link href={href} className="hr-area-more card-stretch">
                          {t("common.readMore")}
                          <ArrowRight size={14} weight="thin" />
                        </Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="hr-areas-wide">
              <article className="hr-area-men">
                <div className="hr-area-men-image">
                  {siteMedia["home.area.men"]?.image ? (
                    <Image
                      src={siteMedia["home.area.men"].image!}
                      alt={siteMedia["home.area.men"].alt}
                      fill
                      className="hr-area-photo hr-area-photo-men"
                      sizes="(min-width: 1040px) 790px, (min-width: 900px) 62vw, 100vw"
                      style={{
                        objectPosition: `${siteMedia["home.area.men"].focalX}% ${siteMedia["home.area.men"].focalY}%`,
                      }}
                    />
                  ) : null}
                </div>
                <div className="hr-area-body">
                  <span className="hr-area-icon">
                    <MaleIcon size={40} />
                  </span>
                  <div>
                    <h3 className={cormorant.className}>
                      {t("areas.items.men.title")}
                    </h3>
                    <p>{t("areas.items.men.body")}</p>
                    <Link
                      href={PUBLIC_PATHS.services}
                      className="hr-area-more card-stretch"
                    >
                      {t("common.readMore")}
                      <ArrowRight size={14} weight="thin" />
                    </Link>
                  </div>
                </div>
              </article>
              <aside className="hr-area-benefits">
                <BotanicalSprig className="hr-area-botanical" />
                {AREA_BENEFITS.map(([key, Icon]) => (
                  <div key={key}>
                    <Icon size={22} weight="thin" />
                    <span>{t(`areas.benefits.${key}`)}</span>
                  </div>
                ))}
              </aside>
            </div>
          </div>
        </Section>
        <Section
          id="treatments"
          marker={t("treatments.marker")}
          title={t("treatments.title")}
          lead={t("treatments.lead")}
        >
          <div className="hr-services">
            {services.map((service, i) => (
              <article className={i === 0 ? "featured" : ""} key={service.key}>
                <div className="hr-card-image">
                  {service.image ? (
                    <Image
                      src={service.image}
                      alt={service.name}
                      fill
                      sizes={
                        i === 0
                          ? "100vw"
                          : "(min-width: 1040px) 33vw, (min-width: 680px) 50vw, 100vw"
                      }
                      style={{
                        objectPosition: `${service.imageFocalX}% ${service.imageFocalY}%`,
                      }}
                    />
                  ) : null}
                </div>
                <div className="hr-card-body">
                  <span>
                    0{i + 1} · {service.durationMin} min
                  </span>
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <div>
                    <button
                      className={`hr-btn ${i === 0 ? "dark" : "ghost"} small`}
                      onClick={() =>
                        router.push({
                          pathname: PUBLIC_PATHS.booking,
                          query: { service: service.key },
                        })
                      }
                    >
                      {t("common.book")}
                    </button>
                    <Link
                      href={service.href}
                      className={
                        i === 0
                          ? "hr-btn ghost small card-stretch"
                          : "hr-more card-stretch"
                      }
                    >
                      {t("common.readMore")}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Section>
        {!HOMEPAGE_TECHNOLOGIES_ARCHIVED ? (
          <Section
            id="technologies"
            alt
            marker={t("technology.marker")}
            title={t("technology.title")}
            lead={t("technology.lead")}
          >
            <div className="hr-tech">
              {technologies.map((technology, i) => (
                <article
                  key={technology.key}
                  className={i % 2 ? "hr-tech-reverse" : ""}
                >
                  <div className="hr-tech-image">
                    {technology.image ? (
                      <Image
                        src={technology.image}
                        alt={technology.name}
                        fill
                        sizes="(min-width: 860px) 50vw, 100vw"
                        style={{
                          objectPosition: `${technology.imageFocalX}% ${technology.imageFocalY}%`,
                        }}
                      />
                    ) : null}
                  </div>
                  <div className="hr-tech-body">
                    <b className={cormorant.className}>0{i + 1}</b>
                    <span className="hr-tech-spec">
                      {technology.specification}
                    </span>
                    <h3 className={cormorant.className}>{technology.name}</h3>
                    <p className="hr-tech-text">{technology.body}</p>
                    <div className="hr-tech-actions justify-between">
                      <button
                        className="hr-btn ghost small"
                        onClick={() =>
                          technology.bookingKey &&
                          router.push({
                            pathname: PUBLIC_PATHS.booking,
                            query: { service: technology.bookingKey },
                          })
                        }
                        disabled={!technology.bookingKey}
                      >
                        {t("common.book")}
                      </button>
                      <Link
                        href={technology.href}
                        className="hr-more card-stretch"
                      >
                        {t("common.readMore")}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Section>
        ) : null}
        <Section
          id="products"
          marker={t("products.marker")}
          title={t("products.title")}
          lead={t("products.lead")}
        >
          <div className="hr-tabs" role="tablist">
            {(["AROSHA_BODY", "DIXIDOX_TRICHO"] as const).map((key) => (
              <button
                key={key}
                role="tab"
                aria-selected={tab === key}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {t(`products.tabs.${key}`)}{" "}
                <span>
                  {productCatalog.filter((p) => p.category === key).length}
                </span>
              </button>
            ))}
          </div>
          <div className="hr-products">
            {products.map((p) => (
              <article key={p.slug}>
                <div className="hr-product-image">
                  {p.image && (
                    <Image
                      src={p.image}
                      alt={p.i18n[locale].name}
                      fill
                      sizes="(max-width: 1039px) 50vw, 25vw"
                      style={{
                        objectPosition: `${p.imageFocalX ?? 50}% ${p.imageFocalY ?? 50}%`,
                      }}
                    />
                  )}
                </div>
                <div>
                  <small>{tab === "AROSHA_BODY" ? "AROSHA" : "DIXIDOX"}</small>
                  <h3>{p.i18n[locale].name}</h3>
                  <p>{excerpt(p.i18n[locale]?.description ?? "", 120)}</p>
                  <strong>
                    {p.size} <em>{p.price ? `€${p.price}` : ""}</em>
                  </strong>
                  <div className="hr-product-actions">
                    <AddToCartButton
                      slug={p.slug}
                      label={t("products.add")}
                      className="hr-add"
                    />
                    <Link
                      href={productPath(p.slug)}
                      className="hr-more card-stretch"
                    >
                      {t("common.readMore")}
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="hr-product-foot">
            <p>
              <Flask /> {t("products.note")}
            </p>
            <Link className="hr-btn ghost small" href={PUBLIC_PATHS.shop}>
              {t("products.all")}
            </Link>
          </div>
        </Section>
        <Section
          id="booking"
          alt
          marker={t("booking.marker")}
          title={t("booking.title")}
          lead={t("booking.lead")}
        >
          <div className="hr-booking">
            <div>
              <p>{t("booking.intro")}</p>
              {selected && (
                <div className="hr-echo">
                  <span>{t("booking.requested")}</span>
                  <strong>
                    {services.find((service) => service.key === selected)
                      ?.name ?? selected}
                  </strong>
                </div>
              )}
              <div className="hr-contact">
                <a href={CONTACT.phoneHref}>
                  <Phone /> {CONTACT.phone}
                </a>
                <a href={SOCIALS.whatsapp}>
                  <WhatsappLogo /> {t("booking.whatsapp")}
                </a>
                <a href={CONTACT.emailHref}>
                  <EnvelopeSimple /> {CONTACT.email}
                </a>
              </div>
              <p className="hr-gdpr">
                <LockSimple />{" "}
                {t.rich("booking.gdpr", {
                  link: (chunks) => (
                    <Link href={PUBLIC_PATHS.privacy} target="_blank" className="underline underline-offset-4">
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            </div>
            <form onSubmit={submit}>
              <div className="hr-form-row">
                <Field label={t("booking.fields.name")} name="name" required />
                <Field
                  label={t("booking.fields.phone")}
                  name="phone"
                  type="tel"
                  required
                />
              </div>
              <Field
                label={t("booking.fields.email")}
                name="email"
                type="email"
                required
              />
              <div className="hr-form-row">
                <label>
                  {t("booking.fields.treatment")}
                  <ThemedSelect
                    name="service"
                    value={selected}
                    onValueChange={setSelected}
                    required
                    placeholder={t("booking.select")}
                    options={services.map((service) => ({
                      value: service.key,
                      label: service.name,
                    }))}
                  />
                </label>
                <label>
                  {t("booking.fields.date")}
                  <DatePicker
                    locale={locale}
                    name="date"
                    min={clinicTodayYmd()}
                    disableClosedDays
                    availableDates={availableDates}
                    placeholder={t("booking.fields.date")}
                    ariaLabel={t("booking.fields.date")}
                  />
                </label>
              </div>
              <label>
                {t("booking.fields.notes")}
                <textarea
                  name="notes"
                  placeholder={t("booking.notesPlaceholder")}
                />
              </label>
              <button className="hr-btn dark" type="submit">
                {t("booking.submit")}
              </button>
            </form>
          </div>
        </Section>
      </main>
      <footer className="hr-footer" id="contact">
        <div className="hr-container hr-footer-grid">
          <div>
            <div className="hr-footer-logo">
              <FlowerLotus />
              <b>MONE</b>
              <span>Beauty Clinic</span>
            </div>
            <p>{t("footer.about")}</p>
            <div className="hr-social">
              <a href={SOCIALS.instagram}>
                <InstagramLogo />
              </a>
              <a href={SOCIALS.facebook}>
                <FacebookLogo />
              </a>
              <a href={SOCIALS.whatsapp}>
                <WhatsappLogo />
              </a>
            </div>
          </div>
          <FooterCol title={t("footer.clinic")}>
            <p>Solvikinkatu 5</p>
            <p>00990 Helsinki</p>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <a href={CONTACT.emailHref}>{CONTACT.email}</a>
          </FooterCol>
          <FooterCol title={t("footer.hours")}>
            <p>{t("footer.byAgreement")}</p>
            <p>{t("footer.booking247")}</p>
          </FooterCol>
          <FooterCol title={t("footer.explore")}>
            {nav.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </FooterCol>
          <FooterCol title={t("footer.legal")}>
            <Link href={PUBLIC_PATHS.privacy}>{t("footer.privacy")}</Link>
            <Link href={PUBLIC_PATHS.terms}>{t("footer.terms")}</Link>
            <Link href={PUBLIC_PATHS.cookies}>{t("footer.cookies")}</Link>
          </FooterCol>
        </div>
        <div className="hr-footer-bar">
          <div className="hr-container hr-footer-bar-inner">
            <span>© {new Date().getFullYear()} Mone Beauty Clinic</span>
            <div>
              <Link href={PUBLIC_PATHS.privacy}>{t("footer.privacy")}</Link>
              <Link href={PUBLIC_PATHS.terms}>{t("footer.terms")}</Link>
              <Link href={PUBLIC_PATHS.cookies}>{t("footer.cookies")}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Section({
  id,
  alt = false,
  headClassName = "",
  marker,
  title,
  lead,
  children,
}: {
  id: string;
  alt?: boolean;
  /** Per-section head modifier: only the treatment areas use one so far. */
  headClassName?: string;
  marker: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`hr-section ${alt ? "alt" : ""}`}>
      <div className="hr-container">
        <header className={`hr-section-head ${headClassName}`.trimEnd()}>
          <Marker>{marker}</Marker>
          <h2 className={cormorant.className}>{title}</h2>
          <p>{lead}</p>
        </header>
        {children}
      </div>
    </section>
  );
}
function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input name={name} type={type} required={required} />
    </label>
  );
}
function FooterCol({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hr-footer-col">
      <h4>{title}</h4>
      {children}
    </div>
  );
}
