import { Container } from "@/components/ui/Container";
import { Markdown } from "@/components/Markdown";
import { getLivePageContent } from "@/lib/live-content";
import type { Locale } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import {
  absoluteLocalizedUrl,
  breadcrumbJsonLd,
  excerpt,
  siteUrl,
  webPageJsonLd,
} from "@/lib/seo";
import { contentPagePath } from "@/lib/public-routes";

/** Renders a real content page (title + markdown body) from scraped_content. */
export async function ContentPage({
  slug,
  locale,
}: {
  slug: string;
  locale: Locale;
}) {
  const content = await getLivePageContent(slug, locale);
  if (!content) notFound();
  const path = contentPagePath(slug);
  const canonical = absoluteLocalizedUrl(siteUrl(), path, locale);
  return (
    <article className="bg-page py-[clamp(40px,5vw,72px)]">
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
      <Container className="max-w-[880px]">
        <h1 className="font-display text-[clamp(32px,4.4vw,56px)] leading-[1.06] font-medium text-ink">
          {content.title}
        </h1>
        <div className="mt-[clamp(20px,2.5vw,36px)]">
          <Markdown>{content.body}</Markdown>
        </div>
      </Container>
    </article>
  );
}
