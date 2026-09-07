import {
  AuthCard,
  AuthField,
  authButton,
  authInput,
} from "@/components/account/AuthCard";
import { AuthPasswordField } from "@/components/account/AuthPasswordField";
import { registerClientAction } from "@/lib/client-account-actions";
import { accountHref } from "@/lib/account-routing";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { prisma } from "@/lib/db";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { clinicTodayYmd } from "@/lib/clinic-date";
import { reusableClaimConsultation } from "@/lib/consultation";
const copy = {
  fi: {
    eyebrow: "Asiakasportaali",
    title: "Luo asiakastili",
    intro: "Vahvistamme sähköpostiosoitteesi ennen ensimmäistä kirjautumista.",
    firstName: "Etunimi",
    lastName: "Sukunimi",
    dateOfBirth: "Syntymäaika",
    dateOfBirthPlaceholder: "Valitse syntymäaika",
    phone: "Puhelin",
    email: "Sähköposti",
    password: "Salasana (vähintään 12 merkkiä)",
    confirm: "Vahvista salasana",
    consentPre: "Hyväksyn ",
    consentLink: "tietosuojaselosteen",
    consentPost: " ja asiakastilin tietojen käsittelyn.",
    submit: "Luo tili",
    error: "Tarkista kentät ja salasanavaatimukset.",
    consultationUnavailable:
      "Esitietolomake ei ole tilapäisesti käytettävissä. Yritä myöhemmin uudelleen.",
    login: "Minulla on jo tili",
    accountDetails: "Tili ja yhteystiedot",
    consultationDetails: "Esitiedot",
    consultationReuse:
      "Tämän ajanvarauksen ajantasaiset esitiedot siirretään turvallisesti tilillesi sähköpostin vahvistamisen jälkeen.",
  },
  en: {
    eyebrow: "Client portal",
    title: "Create a client account",
    intro: "We will verify your email before the first sign-in.",
    firstName: "First name",
    lastName: "Last name",
    dateOfBirth: "Date of birth",
    dateOfBirthPlaceholder: "Select date of birth",
    phone: "Phone",
    email: "Email",
    password: "Password (at least 12 characters)",
    confirm: "Confirm password",
    consentPre: "I accept the ",
    consentLink: "privacy notice",
    consentPost: " and processing required for my client account.",
    submit: "Create account",
    error: "Check the fields and password requirements.",
    consultationUnavailable:
      "The consultation form is temporarily unavailable. Please try again later.",
    login: "I already have an account",
    accountDetails: "Account and contact details",
    consultationDetails: "Consultation information",
    consultationReuse:
      "The current consultation information from this appointment will be securely transferred to your account after email verification.",
  },
  ru: {
    eyebrow: "Личный кабинет клиента",
    title: "Создать аккаунт клиента",
    intro: "Перед первым входом мы подтвердим электронную почту.",
    firstName: "Имя",
    lastName: "Фамилия",
    dateOfBirth: "Дата рождения",
    dateOfBirthPlaceholder: "Выберите дату рождения",
    phone: "Телефон",
    email: "Эл. почта",
    password: "Пароль (не менее 12 символов)",
    confirm: "Подтвердите пароль",
    consentPre: "Я принимаю ",
    consentLink: "политику конфиденциальности",
    consentPost: " и обработку данных для аккаунта.",
    submit: "Создать аккаунт",
    error: "Проверьте поля и требования к паролю.",
    consultationUnavailable:
      "Анкета временно недоступна. Пожалуйста, попробуйте ещё раз позже.",
    login: "У меня уже есть аккаунт",
    accountDetails: "Аккаунт и контактные данные",
    consultationDetails: "Сведения для консультации",
    consultationReuse:
      "Актуальные сведения из этой записи будут безопасно перенесены в аккаунт после подтверждения электронной почты.",
  },
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; claim?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const q = await searchParams;
  const t = copy[locale] ?? copy.fi;
  const [consultation, reusableClaim] = await Promise.all([
    prisma.consultationForm.findUnique({
      where: { id: "current" },
      include: {
        questions: {
          where: { active: true, archivedAt: null },
          orderBy: { displayOrder: "asc" },
          include: {
            contents: { where: { locale } },
            choices: {
              where: { active: true },
              orderBy: { displayOrder: "asc" },
              include: { contents: { where: { locale } } },
            },
          },
        },
      },
    }),
    q.claim ? reusableClaimConsultation(q.claim) : null,
  ]);
  const localized = (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? String((value as Record<string, unknown>)[locale] ?? "")
      : "";
  return (
    <AuthCard
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      error={
        q.error === "consultation_unavailable"
          ? t.consultationUnavailable
          : q.error
            ? t.error
            : null
      }
      links={[
        {
          href: `${accountHref(locale, "login")}${q.claim ? `?claim=${encodeURIComponent(q.claim)}` : ""}`,
          label: t.login,
        },
      ]}
    >
      <form action={registerClientAction} className="grid gap-[16px]">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="claim" value={q.claim ?? ""} />
        <fieldset className="grid gap-[16px] rounded-[8px] border border-line-hair p-4 sm:p-5">
          <legend className="px-2 font-display text-xl font-medium text-ink">
            {t.accountDetails}
          </legend>
          <div className="grid gap-[16px] sm:grid-cols-2">
            <AuthField
              label={t.firstName}
              name="firstName"
              autoComplete="given-name"
            />
            <AuthField
              label={t.lastName}
              name="lastName"
              autoComplete="family-name"
            />
          </div>
          <AuthField
            label={t.phone}
            name="phone"
            type="tel"
            autoComplete="tel"
          />
          {reusableClaim ? (
            <label className="block font-sans text-[13px] text-body">
              {t.email}
              <input
                className={authInput}
                name="email"
                type="email"
                autoComplete="email"
                value={reusableClaim.email}
                readOnly
                required
              />
            </label>
          ) : (
            <AuthField
              label={t.email}
              name="email"
              type="email"
              autoComplete="email"
            />
          )}
          <AuthPasswordField
            locale={locale}
            label={t.password}
            name="password"
            autoComplete="new-password"
          />
          <AuthPasswordField
            locale={locale}
            label={t.confirm}
            name="confirmPassword"
            autoComplete="new-password"
          />
          <label className="flex gap-[10px] font-sans text-[13px] leading-relaxed text-body">
            <input
              className="mt-[3px] h-[18px] w-[18px] accent-accent"
              type="checkbox"
              name="consentGdpr"
              required
            />
            <span>
              {t.consentPre}
              <Link
                href={PUBLIC_PATHS.privacy}
                target="_blank"
                className="underline underline-offset-4 hover:text-accent"
              >
                {t.consentLink}
              </Link>
              {t.consentPost}
            </span>
          </label>
        </fieldset>
        {reusableClaim ? (
          <aside className="rounded-[8px] border border-line-hair bg-alt p-4 font-sans text-[13px] leading-relaxed text-body">
            <strong className="block font-medium text-ink">
              {t.consultationDetails}
            </strong>
            <span className="mt-1 block">{t.consultationReuse}</span>
          </aside>
        ) : (
          <fieldset className="grid gap-[16px] rounded-[8px] border border-line-hair p-4 sm:p-5">
            <legend className="px-2 font-display text-xl font-medium text-ink">
              {t.consultationDetails}
            </legend>
            <p className="font-sans text-[13px] leading-relaxed text-body">
              {localized(consultation?.requiredInformationWording)}
            </p>
            <div className="block font-sans text-[13px] text-body">
              <span id="registration-date-of-birth-label">{t.dateOfBirth}</span>
              <DatePicker
                id="registration-date-of-birth"
                name="dateOfBirth"
                locale={locale}
                ariaLabel={t.dateOfBirthPlaceholder}
                placeholder={t.dateOfBirthPlaceholder}
                autoComplete="bday"
                max={clinicTodayYmd()}
                disableClosedDays={false}
                navigation="dateOfBirth"
                required
                className="mt-[6px]"
              />
            </div>
            {consultation?.questions.map((question) => {
              const prompt = question.contents[0]?.prompt;
              if (!prompt) return null;
              const name = `consultation_${question.key}`;
              if (question.type === "LONG_TEXT")
                return (
                  <label
                    key={question.id}
                    className="block font-sans text-[13px] text-body"
                  >
                    {prompt}
                    {question.required ? (
                      <span aria-hidden="true" className="text-accent">
                        {" "}
                        *
                      </span>
                    ) : null}
                    <textarea
                      className={`${authInput} min-h-28 py-3`}
                      name={name}
                      required={question.required}
                    />
                  </label>
                );
              if (question.type === "SHORT_TEXT")
                return (
                  <label
                    key={question.id}
                    className="block font-sans text-[13px] text-body"
                  >
                    {prompt}
                    <input
                      className={authInput}
                      name={name}
                      required={question.required}
                    />
                  </label>
                );
              const choices =
                question.type === "YES_NO"
                  ? [
                      {
                        key: "yes",
                        label:
                          locale === "fi"
                            ? "Kyllä"
                            : locale === "ru"
                              ? "Да"
                              : "Yes",
                      },
                      {
                        key: "no",
                        label:
                          locale === "fi"
                            ? "Ei"
                            : locale === "ru"
                              ? "Нет"
                              : "No",
                      },
                    ]
                  : question.choices.map((choice) => ({
                      key: choice.key,
                      label: choice.contents[0]?.label ?? choice.key,
                    }));
              if (question.type === "ACKNOWLEDGMENT")
                return (
                  <label
                    key={question.id}
                    className="flex gap-[10px] font-sans text-[13px] leading-relaxed text-body"
                  >
                    <input
                      className="mt-[3px] h-[18px] w-[18px] accent-accent"
                      type="checkbox"
                      name={name}
                      required={question.required}
                    />
                    {prompt}
                  </label>
                );
              return (
                <fieldset
                  key={question.id}
                  className="grid gap-2 font-sans text-[13px] text-body"
                >
                  <legend>{prompt}</legend>
                  {choices.map((choice) => (
                    <label key={choice.key} className="flex gap-2">
                      <input
                        type={
                          question.type === "MULTI_CHOICE"
                            ? "checkbox"
                            : "radio"
                        }
                        name={name}
                        value={choice.key}
                        required={
                          question.required && question.type !== "MULTI_CHOICE"
                        }
                        className="accent-accent"
                      />
                      {choice.label}
                    </label>
                  ))}
                </fieldset>
              );
            })}
            <label className="flex gap-[10px] font-sans text-[13px] leading-relaxed text-body">
              <input
                className="mt-[3px] h-[18px] w-[18px] accent-accent"
                type="checkbox"
                name="healthDataConsent"
                required
              />
              {localized(consultation?.healthConsentWording)}
            </label>
            <label className="flex gap-[10px] font-sans text-[13px] leading-relaxed text-body">
              <input
                className="mt-[3px] h-[18px] w-[18px] accent-accent"
                type="checkbox"
                name="accuracyAcknowledged"
                required
              />
              {localized(consultation?.accuracyWording)}
            </label>
          </fieldset>
        )}
        <button className={authButton}>{t.submit}</button>
      </form>
    </AuthCard>
  );
}
