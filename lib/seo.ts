import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { BRAND, CONTACT, SOCIALS } from "@/content/site";

export const DEFAULT_OG_IMAGE = "/opengraph-image";

const OG_LOCALES: Record<Locale, string> = {
  fi: "fi_FI",
  en: "en_GB",
  ru: "ru_RU",
};

export function siteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall back to the canonical live domain if deploy env is malformed.
    }
  }
  return BRAND.url;
}

/** Plain-text excerpt from markdown for meta descriptions. */
export function excerpt(markdown: string, max = 160): string {
  const text = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links -> text
    .replace(/[#>*_`|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max
    ? text.slice(0, max).replace(/\s+\S*$/, "") + "…"
    : text;
}

export function localizedPath(path: string, locale: string) {
  const cleanPath = path === "/" ? "" : path;
  return locale === routing.defaultLocale
    ? cleanPath || "/"
    : `/${locale}${cleanPath}`;
}

export function absoluteLocalizedUrl(
  site: string,
  path: string,
  locale: string,
) {
  const base = site.replace(/\/$/, "");
  return `${base}${localizedPath(path, locale)}`;
}

export function absoluteAssetUrl(path: string) {
  return new URL(path, `${siteUrl()}/`).toString();
}

/** hreflang + canonical for a locale-agnostic path (e.g. "/palvelut/x"). */
export function localeAlternates(path: string, locale: string) {
  const site = siteUrl();
  const languages: Record<string, string> = {};
  for (const l of routing.locales)
    languages[l] = absoluteLocalizedUrl(site, path, l);
  languages["x-default"] = absoluteLocalizedUrl(
    site,
    path,
    routing.defaultLocale,
  );
  return {
    canonical: absoluteLocalizedUrl(site, path, locale),
    languages,
  };
}

export function localizedMetadata({
  locale,
  path,
  title,
  description,
  image,
  imageAlt,
  indexable = true,
  availableLocales = [...routing.locales],
  type = "website",
}: {
  locale: Locale;
  path: string;
  title?: string | null;
  description?: string | null;
  image?: string | null;
  imageAlt?: string | null;
  indexable?: boolean;
  availableLocales?: readonly Locale[];
  type?: "website" | "article";
}): Metadata {
  const site = siteUrl();
  const canonical = absoluteLocalizedUrl(site, path, locale);
  const socialImage = absoluteAssetUrl(image || DEFAULT_OG_IMAGE);
  const languages = Object.fromEntries([
    ...availableLocales.map((available) => [
      available,
      absoluteLocalizedUrl(site, path, available),
    ]),
    ...(availableLocales.includes(routing.defaultLocale)
      ? [["x-default", absoluteLocalizedUrl(site, path, routing.defaultLocale)]]
      : []),
  ]);
  const cleanDescription = description ? excerpt(description, 160) : undefined;
  const images = [
    {
      url: socialImage,
      alt: imageAlt || title || BRAND.name,
      ...(image ? {} : { width: 1200, height: 630 }),
    },
  ];
  return {
    metadataBase: new URL(site),
    title: title || BRAND.name,
    description: cleanDescription,
    alternates: { canonical, languages },
    robots: indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type,
      siteName: BRAND.name,
      locale: OG_LOCALES[locale],
      alternateLocale: availableLocales
        .filter((available) => available !== locale)
        .map((available) => OG_LOCALES[available]),
      url: canonical,
      title: title || BRAND.name,
      description: cleanDescription,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: title || BRAND.name,
      description: cleanDescription,
      images: [socialImage],
    },
  };
}

/** LocalBusiness / MedicalClinic JSON-LD with Helsinki NAP (local SEO). */
export function medicalClinicJsonLd(image = DEFAULT_OG_IMAGE) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    "@id": `${BRAND.url}/#clinic`,
    name: BRAND.name,
    description:
      "Aesthetic-medicine clinic in Helsinki. Visits are available by appointment.",
    url: BRAND.url,
    image: absoluteAssetUrl(image),
    logo: absoluteAssetUrl(BRAND.logo),
    telephone: CONTACT.phone,
    email: CONTACT.email,
    priceRange: "€€",
    sameAs: [SOCIALS.instagram, SOCIALS.facebook],
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTACT.address.street,
      postalCode: CONTACT.address.postalCode,
      addressLocality: CONTACT.address.city,
      addressCountry: "FI",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: CONTACT.geo.lat,
      longitude: CONTACT.geo.lng,
    },
    medicalSpecialty: "Aesthetic",
    areaServed: { "@type": "City", name: "Helsinki" },
    availableLanguage: ["Finnish", "English", "Russian"],
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

export function faqJsonLd(faq: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function serviceJsonLd({
  name,
  description,
  url,
  image,
  locale,
}: {
  name: string;
  description: string;
  url: string;
  image?: string | null;
  locale: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalProcedure",
    name,
    description,
    url,
    inLanguage: locale,
    ...(image ? { image: absoluteAssetUrl(image) } : {}),
    provider: { "@type": "MedicalClinic", name: BRAND.name, url: BRAND.url },
  };
}

export function productJsonLd({
  name,
  description,
  url,
  image,
  price,
  currency,
  brand,
}: {
  name: string;
  description: string;
  url: string;
  image?: string | null;
  price: number;
  currency: string;
  brand: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    ...(image ? { image: absoluteAssetUrl(image) } : {}),
    brand: { "@type": "Brand", name: brand },
    offers: {
      "@type": "Offer",
      url,
      price: price.toFixed(2),
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
    },
  };
}

export function collectionJsonLd({
  name,
  url,
  items,
}: {
  name: string;
  url: string;
  items: Array<{ name: string; url: string }>;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        url: item.url,
      })),
    },
  };
}

export function articleJsonLd({
  title,
  description,
  url,
  image,
  locale,
  publishedAt,
  updatedAt,
}: {
  title: string;
  description?: string | null;
  url: string;
  image?: string | null;
  locale: Locale;
  publishedAt?: Date | null;
  updatedAt: Date;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    ...(description ? { description } : {}),
    url,
    inLanguage: locale,
    ...(image ? { image: absoluteAssetUrl(image) } : {}),
    ...(publishedAt ? { datePublished: publishedAt.toISOString() } : {}),
    dateModified: updatedAt.toISOString(),
    publisher: {
      "@type": "Organization",
      name: BRAND.name,
      logo: { "@type": "ImageObject", url: absoluteAssetUrl(BRAND.logo) },
    },
  };
}

export function webPageJsonLd({
  name,
  description,
  url,
  image,
  locale,
}: {
  name: string;
  description?: string | null;
  url: string;
  image?: string | null;
  locale: Locale;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name,
    ...(description ? { description } : {}),
    url,
    inLanguage: locale,
    ...(image ? { primaryImageOfPage: absoluteAssetUrl(image) } : {}),
    about: { "@id": `${BRAND.url}/#clinic` },
  };
}
