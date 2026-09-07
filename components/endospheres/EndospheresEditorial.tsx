import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ENDOSPHERES_EDITORIAL } from "@/content/endospheres";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n/routing";
import { focalPosition, getSiteMediaMap } from "@/lib/site-media";

const benefitHeading = {
  en: "Published benefits",
  fi: "Julkaistut hyödyt",
  ru: "Опубликованные преимущества",
} as const;

export async function EndospheresEditorial({ locale }: { locale: Locale }) {
  const content = ENDOSPHERES_EDITORIAL[locale];
  const media = await getSiteMediaMap(
    ["endospheres.editorial.1", "endospheres.editorial.2"],
    locale,
  );

  return (
    <section
      id="endospheres-editorial"
      className="scroll-mt-20 overflow-hidden py-[clamp(56px,8vw,104px)]"
    >
      <Container>
        <div className="mx-auto max-w-[1120px]">
          <Eyebrow>{content.eyebrow}</Eyebrow>
          <h2 className="mt-3 max-w-[18ch] font-display text-[clamp(34px,5vw,58px)] leading-[1.04] font-medium text-ink">
            {content.title}
          </h2>

          <div className="mt-[clamp(40px,7vw,80px)] divide-y divide-line-hair border-y border-line-hair">
            {content.sections.map((section, index) => {
              const image =
                index === 0
                  ? media["endospheres.editorial.1"]
                  : index === 2
                    ? media["endospheres.editorial.2"]
                    : null;
              const headingOnRight = Boolean(index % 2);
              // A tall image beside a single paragraph leaves the text stranded
              // at the top of an otherwise empty column. The image column sets
              // the row height, so centring only moves the text.
              const shortTextBesideImage =
                Boolean(image?.image) && section.paragraphs.length === 1;
              return (
                <section
                  key={section.title}
                  className={cn(
                    "grid gap-6 py-[clamp(32px,5vw,56px)] md:gap-12",
                    // The narrow track holds the heading and the wide track the
                    // paragraphs, whichever side the heading is on. Alternating
                    // with `order` alone moved the content between the tracks but
                    // left the widths behind, so on every other row the heading
                    // took the wide column and the paragraph was squeezed into a
                    // narrower measure than the rest of the page.
                    headingOnRight
                      ? "md:grid-cols-[minmax(0,1.18fr)_minmax(0,.82fr)]"
                      : "md:grid-cols-[minmax(0,.82fr)_minmax(0,1.18fr)]",
                    shortTextBesideImage
                      ? "items-start md:items-center"
                      : "items-start",
                  )}
                >
                  <div className={headingOnRight ? "md:order-2" : ""}>
                    <h3 className="font-display text-[clamp(27px,3vw,36px)] leading-[1.12] font-medium text-ink">
                      {section.title}
                    </h3>
                    {image?.image ? (
                      <div className="relative mt-7 aspect-[4/3] max-h-[420px] overflow-hidden rounded-[var(--radius)] shadow-[var(--shadow-card)]">
                        <Image
                          src={image.image}
                          alt={image.alt}
                          fill
                          className="object-cover"
                          /* The image sits in the narrow track: 0.41 of a
                             1120px column less a 48px gap, so ~440px on a wide
                             screen. Declaring 58vw made the browser fetch a
                             1200px file for a 440px slot. */
                          sizes="(min-width:1280px) 440px, (min-width:768px) 37vw, 90vw"
                          style={{ objectPosition: focalPosition(image) }}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "space-y-4 font-sans text-copy leading-[1.8] text-ink",
                      headingOnRight && "md:order-1",
                    )}
                  >
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="mt-[clamp(40px,6vw,72px)] rounded-[var(--radius)] bg-alt p-[clamp(24px,5vw,52px)]">
            <h3 className="font-display text-[clamp(28px,3.5vw,40px)] font-medium text-ink">
              {benefitHeading[locale]}
            </h3>
            <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              {content.benefits.map((benefit) => (
                <li
                  key={benefit}
                  className="border-t border-line-hair pt-3 font-sans text-copy text-body"
                >
                  {benefit}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Container>
    </section>
  );
}
