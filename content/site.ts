import {
  PUBLIC_PATHS,
  SERVICE_PUBLIC_PATHS,
  TECHNOLOGY_PUBLIC_PATHS,
} from "@/lib/public-routes";

/**
 * Brand + global site constants — Mone Beauty Clinic (per SCOPE.md; aesthetic medicine).
 * Real NAP, nav, and hours from scraped_content. Logo/favicon are the real assets.
 */

export const BRAND = {
  name: "Mone Beauty Clinic",
  shortName: "Mone Beauty Clinic",
  logo: "/logo.svg",
  domain: "monebeauty.fi",
  url: "https://monebeauty.fi",
} as const;

export const CONTACT = {
  phone: "+358 40 129 3800",
  phoneHref: "tel:+358401293800",
  email: "info@monebeauty.fi",
  emailHref: "mailto:info@monebeauty.fi",
  address: {
    street: "Solvikinkatu 5",
    postalCode: "00990",
    city: "Helsinki",
    country: "Finland",
  },
  geo: { lat: 60.2099, lng: 25.0807 },
} as const;

export const SOCIALS = {
  instagram: "https://www.instagram.com/monebeauty.fi/",
  facebook: "https://www.facebook.com/monebeauty.fi/",
  whatsapp: "https://wa.me/358401293800",
} as const;

export type NavChild = { key: string; href: string };
export type NavItem =
  { key: string; href: string } | { key: string; children: NavChild[] };

/** Primary navigation (labels resolve to messages.Nav.*). Mirrors the live header. */
export const NAV: NavItem[] = [
  { key: "about", href: PUBLIC_PATHS.clinic },
  {
    key: "instrumental",
    children: [
      { key: "endospheres", href: TECHNOLOGY_PUBLIC_PATHS.endospheres },
      { key: "laser", href: TECHNOLOGY_PUBLIC_PATHS.laser },
      { key: "rf", href: TECHNOLOGY_PUBLIC_PATHS.rf },
    ],
  },
  { key: "trichology", href: PUBLIC_PATHS.trichology },
  { key: "arosha", href: "/arosha" },
  {
    key: "services",
    children: [
      { key: "face", href: SERVICE_PUBLIC_PATHS.facial },
      { key: "body", href: SERVICE_PUBLIC_PATHS.body },
      { key: "serviceTricho", href: SERVICE_PUBLIC_PATHS.trichology },
      { key: "serviceLaser", href: SERVICE_PUBLIC_PATHS.laser },
      { key: "serviceRf", href: SERVICE_PUBLIC_PATHS.rf },
      { key: "eyebrows", href: SERVICE_PUBLIC_PATHS.brows },
      { key: "packages", href: SERVICE_PUBLIC_PATHS.packages },
      { key: "giftCards", href: SERVICE_PUBLIC_PATHS.giftCards },
    ],
  },
  { key: "catalog", href: PUBLIC_PATHS.shop },
];

/** Footer navigation columns (mirrors the live footer). */
export const FOOTER_NAV: NavChild[] = [
  { key: "about", href: PUBLIC_PATHS.clinic },
  { key: "endospheres", href: TECHNOLOGY_PUBLIC_PATHS.endospheres },
  { key: "trichology", href: PUBLIC_PATHS.trichology },
  { key: "arosha", href: "/arosha" },
  { key: "services", href: PUBLIC_PATHS.services },
  { key: "catalog", href: PUBLIC_PATHS.shop },
];

export const LEGAL_NAV = [
  { key: "privacy", href: PUBLIC_PATHS.privacy },
  { key: "terms", href: PUBLIC_PATHS.terms },
  { key: "cookies", href: PUBLIC_PATHS.cookies },
] as const;
