import { getTranslations } from "next-intl/server";
import { ArrowRight, MapPin, Clock, Heart } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { Button } from "@/components/ui/Button";
import { PUBLIC_PATHS } from "@/lib/public-routes";

export async function HomeHero() {
  const t = await getTranslations("HomeEditorial");
  const facts = [
    { key: "location", Icon: MapPin },
    { key: "hours", Icon: Clock },
    { key: "approach", Icon: Heart },
  ] as const;
  return (
    <section className="bg-page pt-[clamp(38px,6vw,86px)]">
      <Container className="text-center">
        <div className="flex items-center justify-center gap-3.5 font-sans text-[10px] tracking-[.22em] text-muted uppercase">
          <span>Helsinki</span>
          <span aria-hidden="true" className="h-px w-8.5 bg-line-hair" />
          <span>Est. 2020</span>
        </div>
        <Eyebrow className="mt-6 mb-4.5">{t("hero.eyebrow")}</Eyebrow>
        <h1 className="mx-auto max-w-245 font-display text-h1 leading-[1.02] font-medium tracking-[.005em] text-ink uppercase">
          {t("hero.heading")}
        </h1>
        <p className="mx-auto mt-5.5 max-w-170 font-sans text-lead leading-[1.8] font-light text-body">
          {t("hero.lead")}
        </p>
        <div className="mt-7.5 flex flex-wrap justify-center gap-3">
          <Button href={PUBLIC_PATHS.booking} iconRight={ArrowRight}>
            {t("hero.book")}
          </Button>
          <Button href={PUBLIC_PATHS.services} variant="outline">
            {t("hero.services")}
          </Button>
        </div>
      </Container>
      <Container className="mt-[clamp(34px,5vw,62px)]">
        <div className="relative h-[clamp(380px,61vw,690px)] max-h-172.5 overflow-hidden rounded-(--radius) bg-alt">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/media/hero-poster.jpg"
          >
            <source src="/media/hero.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="grid border-b border-line-hair py-7.5 sm:grid-cols-3">
          {facts.map(({ key, Icon }, index) => (
            <div
              key={key}
              className={`flex items-start gap-3.5 py-3.5 sm:px-[clamp(12px,3vw,32px)] ${index ? "sm:border-l sm:border-line-hair" : ""}`}
            >
              <Icon size={24} weight="thin" className="shrink-0 text-accent" />
              <div>
                <h2 className="font-sans text-[11px] font-semibold tracking-[.12em] text-ink uppercase">
                  {t(`facts.${key}.title`)}
                </h2>
                <p className="mt-1.5 text-label leading-[1.55] font-light text-body">
                  {t(`facts.${key}.body`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
