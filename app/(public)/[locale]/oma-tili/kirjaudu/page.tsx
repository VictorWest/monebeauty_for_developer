import { redirect } from "next/navigation";
import { AuthCard, AuthField, authButton } from "@/components/account/AuthCard";
import { AuthPasswordField } from "@/components/account/AuthPasswordField";
import { currentUser } from "@/lib/auth";
import { clientLoginAction } from "@/lib/client-account-actions";
import { accountHref } from "@/lib/account-routing";
import type { Locale } from "@/i18n/routing";

const copy = {
  fi: {
    eyebrow: "Asiakasportaali",
    title: "Kirjaudu asiakastilillesi",
    intro: "Näet tulevat ja aiemmat hoitosi turvallisesti.",
    email: "Sähköposti",
    password: "Salasana",
    submit: "Kirjaudu",
    invalid: "Sähköposti tai salasana on virheellinen.",
    register: "Luo tili",
    forgot: "Unohditko salasanan?",
    notice: "Tarkista sähköpostisi jatkaaksesi.",
  },
  en: {
    eyebrow: "Client portal",
    title: "Sign in to your client account",
    intro: "View your upcoming and previous treatments securely.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    invalid: "The email or password is incorrect.",
    register: "Create an account",
    forgot: "Forgot password?",
    notice: "Check your email to continue.",
  },
  ru: {
    eyebrow: "Личный кабинет клиента",
    title: "Вход в аккаунт клиента",
    intro: "Безопасно просматривайте будущие и прошлые процедуры.",
    email: "Эл. почта",
    password: "Пароль",
    submit: "Войти",
    invalid: "Неверный адрес или пароль.",
    register: "Создать аккаунт",
    forgot: "Забыли пароль?",
    notice: "Проверьте электронную почту.",
  },
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string; claim?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const user = await currentUser("client");
  if (user?.role === "CLIENT") redirect(accountHref(locale));
  const q = await searchParams;
  const t = copy[locale] ?? copy.fi;
  return (
    <AuthCard
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      error={q.error ? t.invalid : q.notice ? t.notice : null}
      links={[
        {
          href: `${accountHref(locale, "register")}${q.claim ? `?claim=${encodeURIComponent(q.claim)}` : ""}`,
          label: t.register,
        },
        { href: accountHref(locale, "forgot"), label: t.forgot },
      ]}
    >
      <form action={clientLoginAction} className="grid gap-[16px]">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="claim" value={q.claim ?? ""} />
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
