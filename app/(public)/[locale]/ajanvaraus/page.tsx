import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import {
  CalendarCheck,
  EnvelopeSimple,
  MapPin,
  Phone,
} from "@phosphor-icons/react/ssr";
import { Container } from "@/components/ui/Container";
import { Eyebrow } from "@/components/ui/Eyebrow";
import { ImageSlot } from "@/components/ui/ImageSlot";
import { BookingWizard } from "@/components/booking/BookingWizard";
import {
  getBookingContext,
  getBookingServiceOptions,
} from "@/lib/booking-context";
import { CONTACT } from "@/content/site";
import { localizedPath } from "@/lib/seo";
import { managedLocalizedMetadata } from "@/lib/site-media";
import type { Locale } from "@/i18n/routing";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { accountHref } from "@/lib/account-routing";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "@/content/cancellation-policy";
import { focalPosition, getSiteMedia } from "@/lib/site-media";
import {
  decryptSavedConsultation,
  loadConsultationForm,
  serializeConsultationForm,
} from "@/lib/consultation";
import { isSensitiveDataEncryptionConfigured } from "@/lib/sensitive-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Booking" });
  const media = await getSiteMedia("booking.hero", locale as Locale);
  return managedLocalizedMetadata({
    locale: locale as Locale,
    path: PUBLIC_PATHS.booking,
    title: t("metaTitle"),
    description: t("intro"),
    image: media.image,
    imageAlt: media.alt || t("heading"),
  });
}

export default async function BookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    service?: string;
    option?: string;
    procedure?: string;
    specialist?: string;
  }>;
}) {
  const { locale } = await params;
  const { service, option, procedure, specialist } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("Booking");
  const appLocale = locale as Locale;
  const cancellationPolicy = CANCELLATION_POLICY[appLocale];

  const user = await currentUser("client");
  const [
    services,
    bookingContext,
    accountClient,
    bookingMedia,
    consultationForm,
  ] = await Promise.all([
    getBookingServiceOptions(appLocale),
    getBookingContext(appLocale, service, option, procedure),
    user?.role === "CLIENT"
      ? prisma.client.findUnique({
          where: { userId: user.id },
          select: {
            fullName: true,
            phone: true,
            email: true,
            consultationProfile: true,
          },
        })
      : null,
    getSiteMedia("booking.hero", appLocale),
    loadConsultationForm(),
  ]);
  const consultationConfig = consultationForm
    ? serializeConsultationForm(consultationForm, appLocale)
    : null;
  let savedConsultation = null;
  let consultationAvailable = Boolean(
    consultationConfig && isSensitiveDataEncryptionConfigured(),
  );
  if (accountClient?.consultationProfile && consultationAvailable) {
    try {
      savedConsultation = decryptSavedConsultation(
        accountClient.consultationProfile,
      );
    } catch {
      consultationAvailable = false;
    }
  }
  const selectedServiceMedia = bookingContext?.service.image
    ? {
        image: bookingContext.service.image,
        alt: bookingContext.service.imageAlt,
        focalX: bookingContext.service.imageFocalX,
        focalY: bookingContext.service.imageFocalY,
      }
    : bookingMedia;

  return (
    <section className="bg-page py-[clamp(52px,7vw,104px)]">
      <Container>
        <div className="grid gap-[clamp(28px,4vw,48px)] lg:grid-cols-[.82fr_1.18fr]">
          <aside className="overflow-hidden rounded-[var(--radius)] border border-line-card bg-card">
            <ImageSlot
              src={selectedServiceMedia.image}
              alt={selectedServiceMedia.alt || t("heading")}
              minHeight={280}
              rounded={false}
              priority
              imageStyle={{
                objectPosition: focalPosition(selectedServiceMedia),
              }}
            />
            <div className="p-[clamp(24px,3vw,34px)]">
              <Eyebrow className="mb-[16px]">{t("eyebrow")}</Eyebrow>
              <h1 className="font-display text-h2 leading-[1.06] font-medium text-ink">
                {t("heading")}
              </h1>
              <p className="mt-[16px] font-sans text-lead leading-[1.75] font-light text-body">
                {t("intro")}
              </p>
              <div className="mt-[28px] grid gap-[14px] border-t border-line-hair pt-[22px] font-sans text-[13.5px] font-light text-body">
                <a
                  href={CONTACT.phoneHref}
                  className="inline-flex items-center gap-[10px] transition-colors hover:text-accent"
                >
                  <Phone size={17} weight="thin" className="text-accent" />
                  {CONTACT.phone}
                </a>
                <a
                  href={CONTACT.emailHref}
                  className="inline-flex items-center gap-[10px] transition-colors hover:text-accent"
                >
                  <EnvelopeSimple
                    size={17}
                    weight="thin"
                    className="text-accent"
                  />
                  {CONTACT.email}
                </a>
                <p className="inline-flex items-start gap-[10px]">
                  <MapPin
                    size={17}
                    weight="thin"
                    className="mt-[2px] shrink-0 text-accent"
                  />
                  <span>
                    {CONTACT.address.street}, {CONTACT.address.postalCode}{" "}
                    {CONTACT.address.city}
                  </span>
                </p>
              </div>
            </div>
          </aside>

          <div className="rounded-[var(--radius)] border border-line-card bg-card p-[clamp(22px,3vw,38px)]">
            <div className="mb-[clamp(22px,3vw,34px)] flex items-center gap-[14px] border-b border-line-hair pb-[20px]">
              <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full bg-alt text-accent">
                <CalendarCheck size={24} weight="thin" />
              </span>
              <div>
                <Eyebrow className="mb-[6px]">{t("eyebrow")}</Eyebrow>
                <h2 className="font-display text-[clamp(26px,3vw,38px)] leading-[1.1] font-medium text-ink">
                  {t("heading")}
                </h2>
              </div>
            </div>
            <BookingWizard
              services={services}
              initialContext={bookingContext ?? undefined}
              initialSpecialistId={specialist}
              initialDetails={accountClient ?? undefined}
              verifiedEmail={Boolean(accountClient && user?.emailVerifiedAt)}
              clientSignedIn={Boolean(accountClient)}
              consultationCurrent={Boolean(
                accountClient &&
                consultationAvailable &&
                consultationForm &&
                accountClient.consultationProfile &&
                accountClient.consultationProfile.completedVersion >=
                  consultationForm.requiredVersion,
              )}
              consultationConfig={consultationConfig}
              savedConsultation={savedConsultation}
              consultationAvailable={consultationAvailable}
              profileHref={`${accountHref(appLocale)}?view=profile`}
              procedureConsent={{
                version: consultationForm?.procedureConsentVersion ?? 0,
                wording:
                  consultationForm &&
                  typeof consultationForm.procedureConsentWording ===
                    "object" &&
                  consultationForm.procedureConsentWording !== null &&
                  !Array.isArray(consultationForm.procedureConsentWording)
                    ? String(
                        (
                          consultationForm.procedureConsentWording as Record<
                            string,
                            unknown
                          >
                        )[appLocale] ?? "",
                      )
                    : "",
              }}
              offerLoginHref={accountHref(locale as Locale, "login")}
              offerRegisterHref={accountHref(locale as Locale, "register")}
              cancellationPolicy={{
                text: cancellationPolicyText(appLocale),
                linkLabel: cancellationPolicy.linkLabel,
                href: `${localizedPath(PUBLIC_PATHS.terms, appLocale)}#${CANCELLATION_POLICY_ANCHOR}`,
              }}
              fallback={{
                phone: CONTACT.phone,
                phoneHref: CONTACT.phoneHref,
                email: CONTACT.email,
                emailHref: CONTACT.emailHref,
              }}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}
