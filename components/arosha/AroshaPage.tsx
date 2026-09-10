import Image from "next/image";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { Container } from "@/components/ui/Container";
import { getLivePageContent } from "@/lib/live-content";
import { parseAroshaMarkdown } from "@/lib/arosha-layout";
import { plainText, sourceHeadingText } from "@/lib/technology-layout";
import { contentPagePath } from "@/lib/public-routes";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  excerpt,
  siteUrl,
  webPageJsonLd,
} from "@/lib/seo";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

/** Matches the reading scale used across the technology pages. */
const READING_SIZE =
  "[&_li]:text-[clamp(16px,1.15vw,18.5px)] [&_p]:text-[clamp(16px,1.15vw,18.5px)]";

function SourceCopy({
  blocks,
  className,
}: {
  blocks: string[];
  className?: string;
}) {
  if (!blocks.length) return null;
  return (
    <Markdown
      variant="technology"
      className={cn(
        "[&_li]:pl-1 [&_ol]:!pl-6 [&_ul]:!list-disc [&_ul]:!pl-6 [&_ul_li::marker]:text-accent",
        READING_SIZE,
        className,
      )}
    >
      {blocks.join("\n\n")}
    </Markdown>
  );
}

/**
 * The Arosha body-wrap page.
 *
 * It used to render through `ContentPage`: an `<h1>` and one column of raw
 * markdown: which ignored its hero image, left the spec table as alternating
 * loose paragraphs, and printed the old site's cart and form controls as body
 * text. Its content does not follow the technology grammar, so it gets its own
 * layout in the same design language.
 */
export async function AroshaPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const content = await getLivePageContent(slug, locale);
  if (!content) notFound();
  const layout = parseAroshaMarkdown(content.body);
  const path = contentPagePath(slug);
  const canonical = absoluteLocalizedUrl(siteUrl(), path, locale);
  const hero = content.hero || layout.introImages[0];
  const [introHeading, ...introBody] = layout.intro;
  const supporting = layout.introImages.filter((src) => src !== hero);

  return (
    <article className="bg-page">
      <JsonLd
        data={[
          webPageJsonLd({
            name: content.title,
            description: content.seoDescription || excerpt(content.body),
            url: canonical,
            image: content.hero,
            locale,
          }),
          breadcrumbJsonLd([
            {
              name: "Mone Beauty Clinic",
              url: absoluteLocalizedUrl(siteUrl(), "/", locale),
            },
            { name: content.title, url: canonical },
          ]),
        ]}
      />

      <section className="relative isolate overflow-hidden">
        {hero ? (
          <>
            <Image
              src={hero}
              alt={content.imageAlt || content.title}
              fill
              priority
              className="object-cover"
              sizes="100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[rgba(34,30,27,.88)] via-[rgba(34,30,27,.42)] to-[rgba(34,30,27,.16)]" />
          </>
        ) : (
          <div className="absolute inset-0 bg-alt" />
        )}
        <Container className="relative z-10 flex min-h-[clamp(420px,58vh,640px)] items-end py-[clamp(32px,5vw,68px)]">
          <div>
            <h1
              className={`max-w-[19ch] font-display text-[clamp(36px,5vw,68px)] leading-[1.02] font-medium ${hero ? "text-cta-heading" : "text-ink"}`}
            >
              {content.title}
            </h1>
            {layout.lead ? (
              <p
                className={`mt-5 max-w-[62ch] font-sans text-[clamp(16px,1.35vw,19px)] leading-[1.68] font-normal ${hero ? "text-cta-heading [text-shadow:0_1px_10px_rgba(58,42,28,.72)]" : "text-body"}`}
              >
                {plainText(layout.lead)}
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="py-[clamp(52px,8vw,104px)]">
        <Container>
          <div className="mx-auto grid max-w-280 items-start gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)] lg:gap-16">
            <div className="min-w-0">
              {introHeading ? (
                <h2 className="font-display text-[clamp(30px,4vw,46px)] leading-[1.05] font-medium text-ink">
                  {sourceHeadingText(introHeading)}
                </h2>
              ) : null}
              <div className="mt-5">
                <SourceCopy blocks={introBody} />
              </div>
            </div>
            {supporting.length ? (
              <div className="grid gap-3 lg:sticky lg:top-28">
                {supporting.map((src) => (
                  <div
                    key={src}
                    className="relative aspect-[4/3] overflow-hidden rounded-(--radius) bg-card shadow-(--shadow-card-soft)"
                  >
                    <Image
                      src={src}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(min-width:1024px) 420px, 90vw"
                    />
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {layout.specs.length ? (
        <section className="border-y border-line-hair bg-alt py-[clamp(52px,8vw,96px)]">
          <Container>
            <div className="mx-auto max-w-280">
              {layout.specHeading ? (
                <h2 className="font-display text-[clamp(28px,3.6vw,44px)] leading-[1.06] font-medium text-ink">
                  {sourceHeadingText(layout.specHeading)}
                </h2>
              ) : null}
              {/* The scraper flattened this table into alternating label and
                  value paragraphs; pairing them back makes it a spec list. */}
              <dl className="mt-8 grid gap-x-14 border-t border-line-hair md:grid-cols-2">
                {layout.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="border-b border-line-hair py-5 md:grid md:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] md:gap-8"
                  >
                    <dt className="font-sans text-meta font-medium tracking-[.14em] text-accent uppercase">
                      {spec.label}
                    </dt>
                    <dd className="mt-2 font-sans text-[clamp(15px,1.02vw,17px)] leading-[1.65] text-body md:mt-0">
                      {plainText(spec.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Container>
        </section>
      ) : null}

      {layout.programs.length ? (
        <section className="py-[clamp(52px,8vw,104px)]">
          <Container>
            <div className="mx-auto max-w-280">
              {layout.programsHeading ? (
                <h2 className="font-display text-[clamp(30px,4vw,46px)] leading-[1.05] font-medium text-ink">
                  {sourceHeadingText(layout.programsHeading)}
                </h2>
              ) : null}
              <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {layout.programs.map((program) => (
                  <article
                    key={program.name}
                    className="flex flex-col rounded-(--radius) border border-line-card bg-card p-6 shadow-(--shadow-card-soft) transition-[border-color,box-shadow] hover:border-line-card-hover hover:shadow-(--shadow-card) motion-reduce:transition-none"
                  >
                    {program.price ? (
                      <p className="font-sans text-label font-medium tracking-[.14em] text-accent uppercase">
                        {program.price}
                      </p>
                    ) : null}
                    <h3 className="mt-3 font-display text-[clamp(21px,1.9vw,26px)] leading-[1.25] font-medium text-ink">
                      {program.name}
                    </h3>
                    <SourceCopy blocks={program.body} className="mt-3" />
                  </article>
                ))}
              </div>
            </div>
          </Container>
        </section>
      ) : null}

      {layout.closing.length ? (
        <section className="border-t border-line-hair bg-alt py-[clamp(52px,8vw,96px)]">
          <Container>
            <div className="mx-auto grid max-w-280 items-center gap-10 md:grid-cols-2 md:gap-16">
              <div className="min-w-0">
                {layout.closingHeading ? (
                  <h2 className="font-display text-[clamp(28px,3.6vw,44px)] leading-[1.06] font-medium text-ink">
                    {sourceHeadingText(layout.closingHeading)}
                  </h2>
                ) : null}
                <div className="mt-5">
                  <SourceCopy blocks={layout.closing} />
                </div>
              </div>
              {layout.closingImages[0] ? (
                <div className="relative aspect-[16/10] overflow-hidden rounded-(--radius) bg-card shadow-(--shadow-card-soft)">
                  <Image
                    src={layout.closingImages[0]}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="(min-width:768px) 46vw, 90vw"
                  />
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}
    </article>
  );
}
