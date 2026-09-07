import { getLocale, getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { Link } from "@/i18n/navigation";
import { bookableServices } from "@/content/booking-services";
import { getPageContent } from "@/content/pages";
import type { Locale } from "@/i18n/routing";
import { excerpt } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";

/**
 * Single home services section: the browse list AND the one-click booking entry.
 * Uses the design-handoff treatment card (03-homepage-spec §2) — real photos where we have
 * them, the beige ImageSlot placeholder otherwise, so every card is uniform.
 */
export async function ChooseService() {
  const t = await getTranslations("Common");
  const tb = await getTranslations("Booking");
  const locale = (await getLocale()) as Locale;
  const services = bookableServices();

  return (
    <section id="treatments" className="bg-alt py-[clamp(60px,7vw,110px)]">
      <Container>
        <div className="mb-[clamp(28px,4vw,52px)]">
          <Eyebrow className="mb-[14px]">{t("chooseServiceEyebrow")}</Eyebrow>
          <h2 className="max-w-[560px] font-display text-h2-treat leading-[1.08] font-medium text-ink">
            {t("chooseServiceHeading")}
          </h2>
        </div>

        <div className="grid grid-cols-[repeat(auto-fit,minmax(232px,1fr))] gap-[clamp(16px,1.8vw,26px)]">
          {services.map((s, index) => {
            const title = tb(`services.${s.key}`);
            const page = getPageContent(s.contentSlug ?? "", locale);
            const description = page?.body ? excerpt(page.body, 128) : "";
            const pageHref = s.contentSlug ? `/${s.contentSlug}` : undefined;

            return (
              <article
                key={s.key}
                className="group flex flex-col overflow-hidden rounded-[var(--radius)] border border-line-card bg-card transition-all duration-300 hover:-translate-y-[6px] hover:border-line-card-hover hover:shadow-card"
              >
                <Link
                  href={{ pathname: PUBLIC_PATHS.booking, query: { service: s.key } }}
                  className="relative block h-[248px] w-full overflow-hidden"
                  aria-label={title}
                >
                  <span className="absolute top-[26px] left-[20px] z-10 font-display text-[24px] text-[rgba(58,42,28,.34)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {s.image ? (
                    <Image
                      src={s.image}
                      alt={title}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                      sizes="(max-width: 900px) 100vw, 25vw"
                    />
                  ) : (
                    <ImageSlot
                      caption={title}
                      minHeight={248}
                      rounded={false}
                    />
                  )}
                </Link>

                <div className="flex flex-1 flex-col p-[clamp(20px,2vw,26px)]">
                  <h3 className="font-display text-[24px] leading-[1.1] font-semibold text-ink">
                    {title}
                  </h3>
                  <p className="mt-[12px] flex-1 font-sans text-[13px] leading-[1.6] font-light text-body">
                    {description}
                  </p>
                  <div className="mt-[18px] flex items-center justify-between gap-[12px]">
                    <Button
                      href={{ pathname: PUBLIC_PATHS.booking, query: { service: s.key } }}
                      variant="primary"
                      size="sm"
                      iconRight={ArrowRight}
                    >
                      {t("book")}
                    </Button>
                    {pageHref && (
                      <Button href={pageHref} variant="textLink">
                        {t("readMore")}
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-[clamp(28px,3vw,40px)]">
          <Button href={PUBLIC_PATHS.services} variant="outline" iconRight={ArrowRight}>
            {t("allServices")}
          </Button>
        </div>
      </Container>
    </section>
  );
}
