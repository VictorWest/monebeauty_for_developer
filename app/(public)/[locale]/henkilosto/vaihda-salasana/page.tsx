import { redirect } from "next/navigation";
import { AuthCard, authButton } from "@/components/account/AuthCard";
import { AuthPasswordField } from "@/components/account/AuthPasswordField";
import { currentUser } from "@/lib/auth";
import { changeStaffPasswordAction } from "@/lib/staff-account-actions";
import { staffHref } from "@/lib/account-routing";
import type { Locale } from "@/i18n/routing";

const copy = {
  fi: {
    eyebrow: "Tietoturva",
    title: "Vaihda väliaikainen salasana",
    intro: "Uuden salasanan on oltava vähintään 12 merkkiä.",
    current: "Väliaikainen salasana",
    password: "Uusi salasana",
    confirm: "Vahvista uusi salasana",
    submit: "Tallenna salasana",
    error:
      "Tarkista nykyinen salasana ja varmista, että uusi salasana täyttää vaatimukset.",
  },
  en: {
    eyebrow: "Security",
    title: "Replace your temporary password",
    intro: "Your new password must contain at least 12 characters.",
    current: "Temporary password",
    password: "New password",
    confirm: "Confirm new password",
    submit: "Save password",
    error:
      "Check the current password and make sure the new password meets the requirements.",
  },
  ru: {
    eyebrow: "Безопасность",
    title: "Смените временный пароль",
    intro: "Новый пароль должен содержать не менее 12 символов.",
    current: "Временный пароль",
    password: "Новый пароль",
    confirm: "Подтвердите пароль",
    submit: "Сохранить пароль",
    error: "Проверьте текущий пароль и требования к новому паролю.",
  },
} as const;

export default async function StaffPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: raw } = await params;
  const locale = raw as Locale;
  const user = await currentUser("backoffice");
  if (!user || user.role !== "STAFF") redirect(staffHref(locale, "login"));
  if (!user.mustChangePassword) redirect(staffHref(locale));
  const t = copy[locale] ?? copy.fi;
  const query = await searchParams;
  return (
    <AuthCard
      eyebrow={t.eyebrow}
      title={t.title}
      intro={t.intro}
      error={query.error ? t.error : null}
    >
      <form action={changeStaffPasswordAction} className="grid gap-[16px]">
        <input type="hidden" name="locale" value={locale} />
        <AuthPasswordField
          locale={locale}
          label={t.current}
          name="currentPassword"
          autoComplete="current-password"
        />
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
    </AuthCard>
  );
}
