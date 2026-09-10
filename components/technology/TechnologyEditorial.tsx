import Image from "next/image";
import { CalendarBlank } from "@phosphor-icons/react/ssr";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import {
  parseTechnologyMarkdown,
  sourceHeadingText,
  type TechnologyChapter,
} from "@/lib/technology-layout";
import { cn } from "@/lib/cn";

/**
 * This page is long-form reading, and `--text-copy` is a flat 16px that never
 * grows. On a wide desktop that leaves the body noticeably undersized against
 * the fluid headings, so the copy here scales with the viewport instead.
 */
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

/** Illustrative photography from the source page; the copy carries the meaning. */
function SourceImage({
  src,
  className,
  sizes,
}: {
  src: string;
  className?: string;
  sizes: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-(--radius) bg-card shadow-(--shadow-card-soft)",
        className,
      )}
    >
      <Image src={src} alt="" fill className="object-cover" sizes={sizes} />
    </div>
  );
}

function ChapterHeading({
  chapter,
  className,
}: {
  chapter: TechnologyChapter;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "font-display text-[clamp(23px,2.6vw,31px)] leading-[1.12] font-medium text-ink",
        className,
      )}
    >
      {sourceHeadingText(chapter.heading)}
    </h3>
  );
}

export function TechnologyEditorial({
  body,
  serviceKey,
  closingCtaLabel,
  anchorId = "technology-about",
}: {
  body: string;
  serviceKey?: string;
  closingCtaLabel?: string;
  anchorId?: string;
}) {
  const layout = parseTechnologyMarkdown(body);
  const [introHeading] = layout.intro;
  const [overviewHeading, ...overviewBody] = layout.overview;
  const { introTitle, introGroups, introNarrative } = layout;
  const [leadImage, ...supportingImages] = layout.overviewImages;

  // The source link points at the previous site's booking URL. Keep its wording
  // and send it to the booking route this site serves, with the service chosen.
  const bookingHref =
    layout.bookingHref ??
    (serviceKey
      ? { pathname: PUBLIC_PATHS.booking, query: { service: serviceKey } }
      : PUBLIC_PATHS.booking);

  return (
    <>
      <section
        id={anchorId}
        className="scroll-mt-20 py-[clamp(52px,8vw,104px)]"
      >
        <Container>
          <div className="mx-auto max-w-280">
            {/* Heading and prose share the top row so neither column runs long,
                then the key points take the full width beneath them. */}
            <div className="grid items-start gap-[clamp(24px,4vw,48px)] lg:grid-cols-[minmax(0,.88fr)_minmax(0,1.12fr)] lg:gap-16">
              {introHeading ? (
                <h2 className="font-display text-[clamp(32px,4.4vw,50px)] leading-[1.04] font-medium text-balance text-ink">
                  {sourceHeadingText(introHeading)}
                </h2>
              ) : null}
              <div className="min-w-0">
                <SourceCopy blocks={introNarrative} />
              </div>
            </div>
            {introTitle || introGroups.length ? (
              <div className="mt-[clamp(32px,5vw,60px)] rounded-(--radius) border border-line-card bg-alt p-[clamp(24px,4vw,44px)] shadow-(--shadow-card-soft)">
                {introTitle ? (
                  <h3 className="font-display text-[clamp(24px,2.6vw,32px)] leading-[1.1] font-medium text-ink">
                    {sourceHeadingText(introTitle)}
                  </h3>
                ) : null}
                {/* Laser states two sets of claims, each with its own lead-in,
                    so the panel holds a run of groups rather than one list. */}
                <div className="grid gap-[clamp(20px,3vw,32px)]">
                  {introGroups.map((group, index) => (
                    <SourceCopy
                      key={group.leadIn}
                      blocks={[group.leadIn, ...group.items]}
                      // The items are short, so a single column left the panel
                      // half empty; flex has to give way for CSS columns, and
                      // the measure cap would strand both columns on the left.
                      // Paragraphs keep their cap: Finnish renders its list as
                      // prose, which would otherwise run the full panel width.
                      className={cn(
                        "[&_ul]:!block [&_ul]:!max-w-none [&_ul]:gap-x-16 [&_ul]:sm:columns-2 [&_ul_li]:mb-2.5 [&_ul_li]:break-inside-avoid",
                        index === 0 && introTitle && "mt-4",
                      )}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="border-y border-line-hair bg-alt py-[clamp(52px,8vw,96px)]">
        <Container>
          <div className="mx-auto grid max-w-280 items-center gap-10 md:grid-cols-[minmax(0,.95fr)_minmax(340px,1.05fr)] md:gap-16">
            <div>
              {overviewHeading ? (
                <h3 className="font-display text-[clamp(28px,3.6vw,42px)] leading-[1.06] font-medium text-ink">
                  {sourceHeadingText(overviewHeading)}
                </h3>
              ) : null}
              <div className="mt-4">
                <SourceCopy blocks={overviewBody} />
              </div>
            </div>
            {/* One image cluster rather than a lead shot with loose thumbnails
                beneath the copy: the wide frame leads, the pair supports it. */}
            {leadImage ? (
              <div className="grid gap-3">
                <SourceImage
                  src={leadImage}
                  className="aspect-[16/10]"
                  sizes="(min-width:1280px) 620px, (min-width:768px) 48vw, 90vw"
                />
                {supportingImages.length ? (
                  <div className="grid grid-cols-2 gap-3">
                    {supportingImages.map((src) => (
                      <SourceImage
                        key={src}
                        src={src}
                        className="aspect-[4/3]"
                        sizes="(min-width:1280px) 305px, (min-width:768px) 24vw, 45vw"
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {layout.benefits.length ? (
        <section className="py-[clamp(52px,8vw,104px)]">
          <Container>
            <div className="mx-auto max-w-280 border-t border-line-hair">
              {layout.benefits.map((chapter) => (
                <article
                  key={chapter.heading}
                  className="grid gap-3 border-b border-line-hair py-[clamp(28px,4vw,46px)] lg:grid-cols-[minmax(240px,.78fr)_minmax(0,1.22fr)] lg:gap-14"
                >
                  <div className="lg:pr-4">
                    <span
                      aria-hidden
                      className="mb-4 block h-px w-8 bg-accent"
                    />
                    <ChapterHeading chapter={chapter} className="text-balance" />
                  </div>
                  <SourceCopy blocks={chapter.body} className="min-w-0" />
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {layout.bookingLabel ? (
        <section className="border-y border-line-hair bg-cta py-[clamp(34px,5vw,56px)]">
          <Container>
            <div className="flex justify-center">
              <Button
                href={bookingHref}
                variant="primaryOnDark"
                iconRight={CalendarBlank}
              >
                {layout.bookingLabel}
              </Button>
            </div>
          </Container>
        </section>
      ) : null}

      {layout.safety.length ? (
        <section className="py-[clamp(52px,8vw,96px)]">
          <Container>
            <div className="mx-auto grid max-w-280 gap-5 md:grid-cols-2">
              {layout.safety.map((chapter, index) => (
                <section
                  key={chapter.heading}
                  className={cn(
                    "rounded-(--radius) border bg-card p-[clamp(24px,4vw,40px)] shadow-(--shadow-card-soft)",
                    index === 0
                      ? "border-line-card"
                      : "border-line-card-hover bg-alt",
                  )}
                >
                  <h2 className="font-display text-[clamp(26px,3vw,36px)] leading-[1.1] font-medium text-ink">
                    {sourceHeadingText(chapter.heading)}
                  </h2>
                  <div className="mt-5">
                    <SourceCopy blocks={chapter.body} />
                  </div>
                </section>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {layout.stages.length ? (
        <section className="border-y border-line-hair bg-alt py-[clamp(52px,8vw,104px)]">
          <Container>
            <div className="mx-auto max-w-280">
              {layout.stages.map((chapter, index) => (
                <article
                  key={chapter.heading}
                  // Equal columns: with uneven tracks, alternating the image's
                  // order handed it the wide column and squeezed its own copy.
                  className="grid items-center gap-6 border-b border-line-hair py-[clamp(26px,4vw,44px)] first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-2 md:gap-12"
                >
                  {layout.processImages[index] ? (
                    <SourceImage
                      src={layout.processImages[index]}
                      className={cn(
                        "aspect-[16/10]",
                        index % 2 === 1 && "md:order-2",
                      )}
                      sizes="(min-width:1280px) 610px, (min-width:768px) 46vw, 90vw"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <ChapterHeading chapter={chapter} />
                    <div className="mt-3">
                      {/* The measure cap would stop the copy short of the photo
                          it sits beside; here the column is the measure. */}
                      <SourceCopy
                        blocks={chapter.body}
                        className="[&_p]:max-w-none"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {layout.sensor ? (
        <section className="py-[clamp(52px,8vw,104px)]">
          <Container>
            <div className="mx-auto grid max-w-280 items-start gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)] md:gap-14">
              <div>
                <h2 className="max-w-[16ch] font-display text-[clamp(28px,3.6vw,44px)] leading-[1.06] font-medium text-ink">
                  {sourceHeadingText(layout.sensor.heading)}
                </h2>
                <div className="mt-5">
                  <SourceCopy blocks={layout.sensor.body} />
                </div>
                {/* Russian laser copy writes "On the face:" / "On the body:" as
                    headings where the other locales use bold text, so the
                    device section is three chapters there and one elsewhere. */}
                {layout.sensorChapters.slice(1).map((chapter) => (
                  <div key={chapter.heading} className="mt-8">
                    <ChapterHeading chapter={chapter} />
                    <div className="mt-3">
                      <SourceCopy blocks={chapter.body} />
                    </div>
                  </div>
                ))}
                {closingCtaLabel ? (
                  <Button
                    href={bookingHref}
                    iconRight={CalendarBlank}
                    className="mt-8"
                  >
                    {closingCtaLabel}
                  </Button>
                ) : null}
              </div>
              {layout.processImages[layout.stages.length] ? (
                <SourceImage
                  src={layout.processImages[layout.stages.length]}
                  className="aspect-[4/5] max-h-140"
                  sizes="(min-width:768px) 40vw, 90vw"
                />
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {layout.fallback.length ? (
        <section className="py-[clamp(40px,6vw,72px)]">
          <Container>
            <div className="mx-auto max-w-215">
              <SourceCopy blocks={layout.fallback} />
            </div>
          </Container>
        </section>
      ) : null}
    </>
  );
}
