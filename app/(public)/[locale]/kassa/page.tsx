import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { CheckoutForm } from "@/components/shop/CheckoutForm";
import { localeAlternates } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return {
    title: t("metaTitle"),
    alternates: localeAlternates(PUBLIC_PATHS.checkout, locale),
    robots: { index: false },
  };
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ payment?: string | string[] }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Checkout");
  const user = await currentUser("client");
  const accountClient = user?.role === "CLIENT"
    ? await prisma.client.findUnique({
        where: { userId: user.id },
        select: {
          fullName: true,
          phone: true,
          email: true,
          savedAddresses: {
            orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
            select: { id: true, label: true, recipientName: true, phone: true, line1: true, line2: true, postalCode: true, city: true, country: true, isDefault: true },
          },
        },
      })
    : null;
  const payment =
    typeof query.payment === "string" ? query.payment : query.payment?.[0];
  const notice =
    payment === "cancelled"
      ? { text: t("cancelled"), error: false }
      : payment === "cancel_error"
        ? { text: t("cancelError"), error: true }
        : null;

  return (
    <section className="bg-page py-[clamp(52px,7vw,104px)]">
      <Container>
        <Eyebrow className="mb-[14px]">{t("eyebrow")}</Eyebrow>
        <h1 className="font-display text-h2 leading-[1.06] font-medium text-ink">
          {t("heading")}
        </h1>
        <p className="mt-[16px] max-w-[620px] font-sans text-lead font-light text-body">
          {t("intro")}
        </p>
        {notice ? (
          <p
            role={notice.error ? "alert" : "status"}
            className={`mt-[18px] max-w-[720px] rounded-[4px] border px-[14px] py-[11px] font-sans text-[14px] ${notice.error ? "border-red-300 bg-red-50 text-red-800" : "border-line-btn bg-btn-fill text-ink"}`}
          >
            {notice.text}
          </p>
        ) : null}
        <div className="mt-[clamp(28px,4vw,48px)]">
          <CheckoutForm
            initialDetails={accountClient ? { fullName: accountClient.fullName, phone: accountClient.phone, email: accountClient.email } : undefined}
            addresses={accountClient?.savedAddresses ?? []}
            verifiedEmail={Boolean(accountClient && user?.emailVerifiedAt)}
          />
        </div>
      </Container>
    </section>
  );
}
