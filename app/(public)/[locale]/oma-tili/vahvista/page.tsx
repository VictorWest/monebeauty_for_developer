import { AuthCard, authButton } from "@/components/account/AuthCard";
import { verifyClientEmailAction } from "@/lib/client-account-actions";
import type { Locale } from "@/i18n/routing";
const copy = {
  fi: {
    title: "Vahvista sähköpostiosoite",
    intro: "Viimeistele asiakastilisi vahvistus.",
    submit: "Vahvista ja kirjaudu",
    error: "Vahvistuslinkki on virheellinen tai vanhentunut.",
  },
  en: {
    title: "Verify your email",
    intro: "Complete the verification of your client account.",
    submit: "Verify and sign in",
    error: "The verification link is invalid or has expired.",
  },
  ru: {
    title: "Подтвердите электронную почту",
    intro: "Завершите подтверждение аккаунта клиента.",
    submit: "Подтвердить и войти",
    error: "Ссылка недействительна или устарела.",
  },
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; claim?: string; error?: string }>;
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
      error={q.error || !q.token ? t.error : null}
    >
      {q.token ? (
        <form action={verifyClientEmailAction}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={q.token} />
          <input type="hidden" name="claim" value={q.claim ?? ""} />
          <button className={authButton}>{t.submit}</button>
        </form>
      ) : null}
    </AuthCard>
  );
}
