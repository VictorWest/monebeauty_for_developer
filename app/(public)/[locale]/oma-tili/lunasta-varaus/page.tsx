import { AuthCard, authButton } from "@/components/account/AuthCard";
import { claimAppointmentAction } from "@/lib/client-account-actions";
import { currentUser } from "@/lib/auth";
import { accountHref } from "@/lib/account-routing";
import type { Locale } from "@/i18n/routing";
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
  const user = await currentUser("client");
  const token = q.token ?? "";
  const t =
    locale === "fi"
      ? {
          claim: "Liitä ajanvaraus tiliisi",
          intro:
            "Kirjaudu tai luo tili ajanvarauksessa käytetyllä sähköpostilla.",
          invalid: "Lunastuslinkki on virheellinen tai vanhentunut.",
          login: "Kirjaudu",
          register: "Luo tili",
          add: "Lisää ajanvaraus",
        }
      : locale === "ru"
        ? {
            claim: "Добавить запись в аккаунт",
            intro:
              "Войдите или создайте аккаунт с адресом, использованным при записи.",
            invalid: "Ссылка недействительна или устарела.",
            login: "Войти",
            register: "Создать аккаунт",
            add: "Добавить запись",
          }
        : {
            claim: "Add appointment to your account",
            intro: "Sign in or create an account using the booking email.",
            invalid: "The claim link is invalid or expired.",
            login: "Sign in",
            register: "Create account",
            add: "Add appointment",
          };
  if (!user || user.role !== "CLIENT")
    return (
      <AuthCard
        eyebrow="Mone Beauty Clinic"
        title={t.claim}
        intro={t.intro}
        error={q.error ? t.invalid : null}
        links={[
          {
            href: `${accountHref(locale, "login")}?claim=${encodeURIComponent(token)}`,
            label: t.login,
          },
          {
            href: `${accountHref(locale, "register")}?claim=${encodeURIComponent(token)}`,
            label: t.register,
          },
        ]}
      >
        <span />
      </AuthCard>
    );
  return (
    <AuthCard
      eyebrow="Mone Beauty Clinic"
      title={t.claim}
      error={q.error ? t.invalid : null}
    >
      <form action={claimAppointmentAction}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="token" value={token} />
        <button className={authButton}>{t.add}</button>
      </form>
    </AuthCard>
  );
}
