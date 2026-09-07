import { redirect } from "next/navigation";
import { AuthCard, AuthField, authButton } from "@/components/account/AuthCard";
import { AuthPasswordField } from "@/components/account/AuthPasswordField";
import { currentUser } from "@/lib/auth";
import { staffLoginAction } from "@/lib/staff-account-actions";
import type { Locale } from "@/i18n/routing";
import { sharedLoginDestination } from "@/lib/shared-login";

const copy = {
  fi: {
    eyebrow: "Henkilöstöportaali",
    title: "Kirjaudu henkilöstöportaaliin",
    intro: "Käytä ylläpitäjän sinulle luomia tunnuksia.",
    email: "Sähköposti",
    password: "Salasana",
    submit: "Kirjaudu",
    error: "Sähköposti tai salasana on virheellinen.",
  },
  en: {
    eyebrow: "Staff portal",
    title: "Sign in to the staff portal",
    intro: "Use the credentials created for you by the administrator.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    error: "The email or password is incorrect.",
  },
  ru: {
    eyebrow: "Портал для сотрудников",
    title: "Вход для сотрудников",
    intro: "Используйте данные, созданные администратором.",
    email: "Эл. почта",
    password: "Пароль",
    submit: "Войти",
    error: "Неверный адрес или пароль.",
  },
} as const;

export default async function StaffLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const user = await currentUser("backoffice");
  if (user) {
    const destination = sharedLoginDestination(locale, user);
    if (destination) redirect(destination);
  }
  const t = copy[locale] ?? copy.fi;
  const query = await searchParams;
  return (
    <AuthCard
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      error={query.error ? t.error : null}
    >
      <form action={staffLoginAction} className="grid gap-[16px]">
        <input type="hidden" name="locale" value={locale} />
        <AuthField
          label={t.email}
          name="email"
          type="email"
          autoComplete="username"
        />
        <AuthPasswordField
          locale={locale}
          label={t.password}
          name="password"
          autoComplete="current-password"
        />
        <button className={authButton}>{t.submit}</button>
      </form>
    </AuthCard>
  );
}
