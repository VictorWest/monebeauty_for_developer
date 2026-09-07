import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { focalPosition, getSiteMediaMap } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";

const PAIRS = [1, 2, 3] as const;

const copy = {
  en: {
    eyebrow: "Treatment results",
    title: "Before and after",
    before: "Before",
    after: "After",
    note: "Photographs of clients treated at Mone Beauty Clinic. Results vary between individuals.",
  },
  fi: {
    eyebrow: "Hoitotulokset",
    title: "Ennen ja jälkeen",
    before: "Ennen",
    after: "Jälkeen",
    note: "Valokuvat Mone Beauty Clinicin asiakkaista. Tulokset vaihtelevat yksilöllisesti.",
  },
  ru: {
    eyebrow: "Результаты процедур",
    title: "До и после",
    before: "До",
    after: "После",
    note: "Фотографии клиентов Mone Beauty Clinic. Результаты индивидуальны.",
  },
} as const;

/**
 * Endospheres before-and-after pairs, filled from admin-managed media slots.
 *
 * The clinic asked for at least three pairs but has not supplied any yet, and
 * none exist in the site archive. Rendering nothing until a pair is complete
 * keeps an unfinished gallery off the live page; the section appears on its own
 * as soon as the photographs are uploaded in the admin.
 */
export async function BeforeAfterGallery({ locale }: { locale: Locale }) {
  const t = copy[locale];
  const media = await getSiteMediaMap(
    PAIRS.flatMap((pair) => [
      `endospheres.beforeafter.${pair}.before`,
      `endospheres.beforeafter.${pair}.after`,
    ]),
    locale,
  );

  const pairs = PAIRS.map((pair) => ({
    pair,
    before: media[`endospheres.beforeafter.${pair}.before`],
    after: media[`endospheres.beforeafter.${pair}.after`],
  })).filter(({ before, after }) => before?.image && after?.image);

  if (!pairs.length) return null;

  return (
    <section
      className="border-t border-line-hair bg-alt py-[clamp(48px,7vw,88px)]"
      aria-labelledby="endospheres-before-after-heading"
    >
      <Container>
        <div className="mx-auto max-w-280">
          <Eyebrow>{t.eyebrow}</Eyebrow>
          <h2
            id="endospheres-before-after-heading"
            className="mt-3 font-display text-[clamp(30px,4vw,44px)] leading-[1.08] font-medium text-ink"
          >
            {t.title}
          </h2>
          <div className="mt-[clamp(28px,4vw,48px)] grid gap-[clamp(20px,3vw,32px)] md:grid-cols-2 xl:grid-cols-3">
            {pairs.map(({ pair, before, after }) => (
              <figure
                key={pair}
                className="overflow-hidden rounded-(--radius) border border-line-card bg-card shadow-(--shadow-card-soft)"
              >
                <div className="grid grid-cols-2">
                  {(
                    [
                      [t.before, before],
                      [t.after, after],
                    ] as const
                  ).map(([label, image]) => (
                    <div key={label} className="relative">
                      <div className="relative aspect-3/2 bg-page">
                        <Image
                          src={image.image as string}
                          alt={image.alt}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 50vw, (max-width: 1280px) 25vw, 17vw"
                          style={{ objectPosition: focalPosition(image) }}
                        />
                      </div>
                      <span className="absolute top-2 left-2 rounded-[3px] bg-[rgba(34,30,27,.72)] px-2 py-1 font-sans text-meta font-medium tracking-[.12em] text-cta-heading uppercase">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </figure>
            ))}
          </div>
          <p className="mt-6 font-sans text-compact leading-[1.7] text-body">
            {t.note}
          </p>
        </div>
      </Container>
    </section>
  );
}
