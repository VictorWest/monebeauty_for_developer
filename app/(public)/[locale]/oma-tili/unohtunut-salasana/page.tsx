import { AuthCard, AuthField, authButton } from "@/components/account/AuthCard";
import { requestClientPasswordResetAction } from "@/lib/client-account-actions";
import type { Locale } from "@/i18n/routing";
const copy = {
  fi: {
    title: "Palauta salasana",
    intro: "Lähetämme ohjeet, jos osoitteella on aktiivinen tili.",
    email: "Sähköposti",
    submit: "Lähetä palautuslinkki",
    sent: "Jos tili löytyi, palautuslinkki on lähetetty.",
  },
  en: {
    title: "Reset password",
    intro:
      "We will send instructions if an active account exists for the address.",
    email: "Email",
    submit: "Send reset link",
    sent: "If an account was found, a reset link has been sent.",
  },
  ru: {
    title: "Сбросить пароль",
    intro: "Мы отправим инструкции, если для адреса есть активный аккаунт.",
    email: "Эл. почта",
    submit: "Отправить ссылку",
    sent: "Если аккаунт найден, ссылка отправлена.",
  },
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const q = await searchParams;
  const t = copy[locale] ?? copy.fi;
  return (
    <AuthCard
      eyebrow="Mone Beauty Clinic"
      title={t.title}
      intro={t.intro}
      error={q.sent ? t.sent : null}
    >
      <form
        action={requestClientPasswordResetAction}
        className="grid gap-[16px]"
      >
        <input type="hidden" name="locale" value={locale} />
        <AuthField
          label={t.email}
          name="email"
          type="email"
          autoComplete="email"
        />
        <button className={authButton}>{t.submit}</button>
      </form>
    </AuthCard>
  );
}
