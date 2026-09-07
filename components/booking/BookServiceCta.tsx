import { getTranslations } from "next-intl/server";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { bookingKeyForContentSlug } from "@/content/booking-services";
import { PUBLIC_PATHS } from "@/lib/public-routes";

/**
 * Primary "Book this treatment" CTA for a content page. Renders nothing when the page has
 * no bookable service (e.g. [CLINIC TO PROVIDE] stubs or non-treatment pages).
 */
export async function BookServiceCta({ contentSlug }: { contentSlug: string }) {
  const key = bookingKeyForContentSlug(contentSlug);
  if (!key) return null;
  const t = await getTranslations("Common");
  return (
    <Container className="max-w-[880px] pb-[clamp(40px,6vw,80px)]">
      <Button
        href={{ pathname: PUBLIC_PATHS.booking, query: { service: key } }}
        variant="primary"
        iconRight={ArrowRight}
      >
        {t("bookThis")}
      </Button>
    </Container>
  );
}
