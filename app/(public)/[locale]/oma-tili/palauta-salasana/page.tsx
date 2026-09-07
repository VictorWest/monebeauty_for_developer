import { AuthCard, authButton } from "@/components/account/AuthCard";
import { AuthPasswordField } from "@/components/account/AuthPasswordField";
import { resetClientPasswordAction } from "@/lib/client-account-actions";
import type { Locale } from "@/i18n/routing";
const copy = {
  fi: {
    title: "Aseta uusi salasana",
    password: "Uusi salasana",
    confirm: "Vahvista salasana",
    submit: "Tallenna",
    error: "Linkki tai salasana ei kelpaa.",
  },
  en: {
    title: "Set a new password",
    password: "New password",
    confirm: "Confirm password",
    submit: "Save password",
    error: "The link or password is invalid.",
  },
  ru: {
    title: "Задать новый пароль",
    password: "Новый пароль",
    confirm: "Подтвердите пароль",
    submit: "Сохранить",
    error: "Ссылка или пароль недействительны.",
  },
} as const;
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const q = await searchParams;
  const t = copy[locale] ?? copy.fi;
  return (
    <AuthCard
      eyebrow="Mone Beauty Clinic"
      title={t.title}
      error={q.error || !q.token ? t.error : null}
    >
      {q.token ? (
        <form action={resetClientPasswordAction} className="grid gap-[16px]">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={q.token} />
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
          <button className={authButton}>{t.submit}</button>
        </form>
      ) : null}
    </AuthCard>
  );
}
