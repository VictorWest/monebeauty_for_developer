import { getTranslations } from "next-intl/server";
import {
  InstagramLogo,
  FacebookLogo,
  WhatsappLogo,
  Phone,
  EnvelopeSimple,
  MapPin,
  Clock,
} from "@phosphor-icons/react/ssr";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { BRAND, CONTACT, SOCIALS, FOOTER_NAV, LEGAL_NAV } from "@/content/site";

const socials = [
  { href: SOCIALS.instagram, Icon: InstagramLogo, label: "Instagram" },
  { href: SOCIALS.facebook, Icon: FacebookLogo, label: "Facebook" },
  { href: SOCIALS.whatsapp, Icon: WhatsappLogo, label: "WhatsApp" },
];

export async function Footer() {
  const t = await getTranslations();

  const colHeading =
    "mb-[18px] font-sans text-meta font-medium uppercase tracking-[.2em] text-footer-heading";
  const linkCls =
    "font-sans text-[14.5px] font-normal text-footer-link transition-colors hover:text-footer-logo";

  return (
    <footer className="bg-footer">
      <div className="mx-auto w-full max-w-[1280px] px-[clamp(20px,5vw,56px)] py-[clamp(56px,7vw,88px)]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-[clamp(34px,4vw,56px)] border-b border-line-footer pb-[clamp(40px,5vw,56px)]">
          {/* Brand */}
          <div className="flex flex-col gap-[20px]">
            <Image
              src={BRAND.logo}
              alt={BRAND.name}
              width={150}
              height={77}
              unoptimized
              className="h-[56px] w-auto brightness-0 invert"
            />
            <div className="flex gap-[12px]">
              {socials.map(({ href, Icon, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="grid h-[40px] w-[40px] place-items-center rounded-full border border-line-social text-footer-link transition-colors hover:border-accent hover:bg-accent hover:text-page"
                >
                  <Icon size={18} weight="thin" />
                </a>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className={colHeading}>{t("Footer.navHeading")}</h4>
            <ul className="flex flex-col gap-[12px]">
              {FOOTER_NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} className={linkCls}>
                    {t(`Nav.${n.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h4 className={colHeading}>{t("Footer.contactsHeading")}</h4>
            <ul className="flex flex-col gap-[14px]">
              <li>
                <a
                  href={CONTACT.phoneHref}
                  className={`inline-flex items-center gap-[10px] ${linkCls}`}
                >
                  <Phone size={16} weight="thin" className="text-accent" />
                  {CONTACT.phone}
                </a>
              </li>
              <li>
                <a
                  href={CONTACT.emailHref}
                  className={`inline-flex items-center gap-[10px] ${linkCls}`}
                >
                  <EnvelopeSimple
                    size={16}
                    weight="thin"
                    className="text-accent"
                  />
                  {CONTACT.email}
                </a>
              </li>
              <li className="flex items-start gap-[10px] font-sans text-[14.5px] font-normal text-footer-link">
                <MapPin
                  size={16}
                  weight="thin"
                  className="mt-[2px] shrink-0 text-accent"
                />
                <span>
                  {CONTACT.address.street}
                  <br />
                  {CONTACT.address.postalCode} {CONTACT.address.city}
                </span>
              </li>
            </ul>
          </div>

          {/* Opening hours */}
          <div>
            <h4 className={colHeading}>{t("Footer.openingHours")}</h4>
            <p className="inline-flex items-start gap-[10px] font-sans text-[14.5px] font-normal text-footer-link">
              <Clock
                size={16}
                weight="thin"
                className="mt-[2px] shrink-0 text-accent"
              />
              {t("Footer.hours")}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-wrap items-center justify-between gap-[14px] pt-[26px]">
          <p className="font-sans text-[12px] text-footer-copy">
            © {new Date().getFullYear()} {BRAND.name}. {t("Footer.rights")}
          </p>
          <div className="flex flex-wrap gap-[20px]">
            {LEGAL_NAV.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="font-sans text-[12px] text-footer-copy transition-colors hover:text-footer-logo"
              >
                {t(`Footer.${l.key}`)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
