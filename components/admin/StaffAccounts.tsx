import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { adminHref } from "@/lib/admin-routing";
import type { Locale } from "@/i18n/routing";
import { AdminPasswordField } from "@/components/admin/AdminPasswordField";
import { StaffAccountActions } from "@/components/admin/StaffAccountActions";
import { EmployeeConfiguration } from "@/components/staff/EmployeeConfiguration";
import { createStaffAccountAction } from "@/lib/staff-account-actions";

const input =
  "min-h-[44px] w-full rounded-[4px] border border-line-btn bg-page px-[11px] font-sans text-[14px]";
const button =
  "min-h-[42px] rounded-[4px] border border-line-btn px-[13px] font-sans text-[12px] tracking-[.08em] uppercase hover:bg-btn-fill";
const primary = `${button} border-accent bg-accent text-page hover:brightness-95`;

const copy = {
  fi: {
    title: "Henkilöstötilit",
    intro:
      "Luo ja hallitse henkilöstön kirjautumistunnuksia. Työntekijän oma kalenteriprofiili luodaan automaattisesti.",
    create: "Luo henkilöstötili",
    name: "Nimi",
    email: "Sähköposti",
    temp: "Väliaikainen salasana",
    save: "Luo tili",
    active: "Aktiivinen",
    disabled: "Käyttöoikeus poistettu",
    reset: "Aseta uusi väliaikainen salasana",
    sessions: "Katkaise istunnot",
    disable: "Poista käyttöoikeus",
    enable: "Palauta käyttöoikeus",
    list: "Kaikki henkilöstötilit",
    none: "Henkilöstötilejä ei ole vielä luotu.",
    sessionCount: "aktiivista istuntoa",
    passwordChange: "salasanan vaihto vaaditaan",
    audit: "Näytä auditointitapahtumat",
    showPassword: "Näytä salasana",
    hidePassword: "Piilota salasana",
    delete: "Poista kirjautumistunnukset",
    deleteWarning:
      "Kirjautumistunnukset poistetaan pysyvästi. Kalenteri- ja ajanvaraushistoria säilytetään.",
    deleteConfirm: "Vahvista kirjoittamalla henkilöstön sähköpostiosoite",
    cancel: "Peruuta",
    configure: "Muokkaa työntekijää",
    employee: "Työntekijä",
    professionalTitle: "Ammattinimike",
    access: "Käyttöoikeus",
    sessionsHeading: "Istunnot",
    passwordHeading: "Salasanan vaihto",
    required: "Vaaditaan",
    notRequired: "Ei vaadita",
    actions: "Toiminnot",
    moreActions: "Lisää toimintoja",
    resetSubmit: "Aseta salasana",
    backToStaff: "Takaisin henkilöstötileihin",
  },
  en: {
    title: "Staff accounts",
    intro:
      "Create and manage staff sign-in credentials. A private calendar profile is created automatically for each staff member.",
    create: "Create staff account",
    name: "Name",
    email: "Email",
    temp: "Temporary password",
    save: "Create account",
    active: "Active",
    disabled: "Access revoked",
    reset: "Set new temporary password",
    sessions: "Revoke sessions",
    disable: "Revoke access",
    enable: "Restore access",
    list: "All staff accounts",
    none: "No staff accounts have been created yet.",
    sessionCount: "active sessions",
    passwordChange: "password change required",
    audit: "View audit events",
    showPassword: "Show password",
    hidePassword: "Hide password",
    delete: "Delete credentials",
    deleteWarning:
      "This permanently deletes the login credentials. Calendar and appointment history will be retained.",
    deleteConfirm: "Confirm by entering the staff email address",
    cancel: "Cancel",
    configure: "Configure employee",
    employee: "Employee",
    professionalTitle: "Professional title",
    access: "Access status",
    sessionsHeading: "Active sessions",
    passwordHeading: "Password change",
    required: "Required",
    notRequired: "Not required",
    actions: "Actions",
    moreActions: "More actions",
    resetSubmit: "Set password",
    backToStaff: "Back to staff accounts",
  },
  ru: {
    title: "Учётные записи сотрудников",
    intro:
      "Создавайте и управляйте данными входа сотрудников. Личный профиль календаря создаётся автоматически.",
    create: "Создать учётную запись",
    name: "Имя",
    email: "Эл. почта",
    temp: "Временный пароль",
    save: "Создать",
    active: "Активна",
    disabled: "Доступ отозван",
    reset: "Задать новый временный пароль",
    sessions: "Завершить сеансы",
    disable: "Отозвать доступ",
    enable: "Восстановить доступ",
    list: "Все учётные записи сотрудников",
    none: "Учётные записи сотрудников ещё не созданы.",
    sessionCount: "активных сеансов",
    passwordChange: "требуется смена пароля",
    audit: "Просмотреть события аудита",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    delete: "Удалить данные входа",
    deleteWarning:
      "Данные входа будут удалены навсегда. История календаря и записей сохранится.",
    deleteConfirm: "Для подтверждения введите эл. почту сотрудника",
    cancel: "Отмена",
    configure: "Настроить сотрудника",
    employee: "Сотрудник",
    professionalTitle: "Должность",
    access: "Статус доступа",
    sessionsHeading: "Активные сеансы",
    passwordHeading: "Смена пароля",
    required: "Требуется",
    notRequired: "Не требуется",
    actions: "Действия",
    moreActions: "Другие действия",
    resetSubmit: "Задать пароль",
    backToStaff: "Назад к учётным записям сотрудников",
  },
} as const;

export async function StaffAccounts({
  locale,
  id,
  canViewAudit = true,
}: {
  locale: Locale;
  id?: string;
  canViewAudit?: boolean;
}) {
  const t = copy[locale];
  const returnTo = adminHref(locale, "staff");
  const staff = await prisma.user.findMany({
    where: { role: "STAFF" },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: {
      sessions: { select: { id: true } },
      staff: {
        select: {
          practitioner: { select: { role: true } },
        },
      },
    },
  });
  if (id && !staff.some((item) => item.id === id)) notFound();
  const visible = id ? staff.filter((item) => item.id === id) : staff;
  const selected = id ? visible[0] : undefined;
  const detailReturnTo = id ? adminHref(locale, "staff", id) : returnTo;
  return (
    <div>
      {selected ? (
        <header>
          <a
            href={returnTo}
            className="inline-flex min-h-11 items-center font-sans text-[13px] text-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            ← {t.backToStaff}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-display text-[clamp(34px,5vw,54px)] font-medium">
              {selected.name ?? selected.email}
            </h1>
            <span className="inline-flex rounded-full bg-btn-fill px-[10px] py-[5px] font-sans text-[11px] uppercase">
              {selected.status === "ACTIVE" ? t.active : t.disabled}
            </span>
          </div>
          <p className="mt-1 font-sans text-[14px] text-muted">
            {selected.email} · {selected.staff?.practitioner?.role ?? "—"}
          </p>
        </header>
      ) : (
        <>
          <h1 className="font-display text-[clamp(34px,5vw,54px)] font-medium">
            {t.title}
          </h1>
          <p className="mt-[10px] max-w-[760px] font-sans text-[15px] text-body">
            {t.intro}
          </p>
        </>
      )}
      {!id ? (
        <section className="mt-[26px] rounded-[8px] border border-line-card bg-card p-[clamp(16px,3vw,26px)] shadow-card">
          <h2 className="font-display text-[28px] font-medium">{t.create}</h2>
          <form
            action={createStaffAccountAction}
            className="mt-[16px] grid gap-[12px] md:grid-cols-2"
          >
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <label className="font-sans text-[13px] text-body">
              {t.name}
              <input
                className={`${input} mt-[5px]`}
                name="name"
                autoComplete="name"
                required
              />
            </label>
            <label className="font-sans text-[13px] text-body">
              {t.email}
              <input
                className={`${input} mt-[5px]`}
                name="email"
                type="email"
                autoComplete="off"
                required
              />
            </label>
            <label className="font-sans text-[13px] text-body md:col-span-2">
              {t.temp}
              <AdminPasswordField
                className={input}
                wrapperClassName="mt-[5px]"
                name="temporaryPassword"
                showLabel={t.showPassword}
                hideLabel={t.hidePassword}
              />
            </label>
            <button className={`${primary} md:col-span-2`}>{t.save}</button>
          </form>
        </section>
      ) : null}
      {!id ? (
        <div className="mt-[26px] flex items-end justify-between gap-[12px]">
          <h2 className="font-display text-[28px] font-medium">{t.list}</h2>
          <span className="font-sans text-[13px] text-muted">
            {visible.length}
          </span>
        </div>
      ) : null}
      {!id && !visible.length ? (
        <p className="mt-[12px] rounded-[8px] border border-line-card bg-card p-[18px] font-sans text-[14px] text-muted">
          {t.none}
        </p>
      ) : null}
      {!id && visible.length ? (
        <div className="mt-[14px] overflow-x-auto rounded-[8px] border border-line-card bg-card shadow-card">
          <table className="w-full min-w-[980px] border-collapse text-left font-sans text-[13px]">
            <thead className="sticky top-0 z-10 bg-btn-fill text-muted">
              <tr>
                <th scope="col" className="p-3 font-medium">
                  {t.employee}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t.professionalTitle}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t.access}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t.sessionsHeading}
                </th>
                <th scope="col" className="p-3 font-medium">
                  {t.passwordHeading}
                </th>
                <th scope="col" className="p-3 text-right font-medium">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item) => (
                <tr
                  key={item.id}
                  className="group relative cursor-pointer border-t border-line-hair align-middle transition-colors focus-within:bg-btn-fill/45 hover:bg-btn-fill/45"
                >
                  <th scope="row" className="p-3 font-normal">
                    <a
                      aria-label={`${t.configure}: ${item.name ?? item.email}`}
                      href={adminHref(locale, "staff", item.id)}
                      className="after:absolute after:inset-0 after:z-[1] after:content-[''] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-accent focus-visible:after:ring-inset"
                    >
                      <span className="block font-medium text-ink">
                        {item.name ?? item.email}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-muted">
                        {item.email}
                      </span>
                    </a>
                  </th>
                  <td className="p-3 text-body">
                    {item.staff?.practitioner?.role ?? "—"}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex rounded-full bg-btn-fill px-[10px] py-[5px] text-[11px] uppercase">
                      {item.status === "ACTIVE" ? t.active : t.disabled}
                    </span>
                  </td>
                  <td className="p-3 text-body">{item.sessions.length}</td>
                  <td className="p-3 text-body">
                    {item.mustChangePassword ? t.required : t.notRequired}
                  </td>
                  <td className="relative z-[2] p-3">
                    <div className="flex min-h-11 items-center justify-end gap-2 whitespace-nowrap">
                      <StaffAccountActions
                        id={item.id}
                        email={item.email}
                        returnTo={returnTo}
                        auditHref={
                          canViewAudit
                            ? `${adminHref(locale, "audit")}?staff=${item.id}`
                            : undefined
                        }
                        nextStatus={
                          item.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                        }
                        labels={{
                          actions: `${t.moreActions}: ${item.name ?? item.email}`,
                          reset: t.reset,
                          resetSubmit: t.resetSubmit,
                          sessions: t.sessions,
                          status:
                            item.status === "ACTIVE" ? t.disable : t.enable,
                          audit: t.audit,
                          delete: t.delete,
                          deleteWarning: t.deleteWarning,
                          deleteConfirm: t.deleteConfirm,
                          cancel: t.cancel,
                          showPassword: t.showPassword,
                          hidePassword: t.hidePassword,
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {id && selected ? (
        <div className="mt-[26px]">
          <EmployeeConfiguration
            locale={locale}
            endpoint={`/api/admin/staff/${encodeURIComponent(id)}/configuration`}
            admin
            securityContent={
              <>
                <dl className="mt-3 grid gap-3 font-sans text-[13px] sm:grid-cols-3">
                  <div>
                    <dt className="text-muted">{t.access}</dt>
                    <dd className="mt-1 font-medium text-ink">
                      {selected.status === "ACTIVE" ? t.active : t.disabled}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t.sessionsHeading}</dt>
                    <dd className="mt-1 font-medium text-ink">
                      {selected.sessions.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t.passwordHeading}</dt>
                    <dd className="mt-1 font-medium text-ink">
                      {selected.mustChangePassword ? t.required : t.notRequired}
                    </dd>
                  </div>
                </dl>
                <StaffAccountActions
                  variant="panel"
                  id={selected.id}
                  email={selected.email}
                  returnTo={detailReturnTo}
                  deleteReturnTo={returnTo}
                  auditHref={
                    canViewAudit
                      ? `${adminHref(locale, "audit")}?staff=${selected.id}`
                      : undefined
                  }
                  nextStatus={
                    selected.status === "ACTIVE" ? "DISABLED" : "ACTIVE"
                  }
                  labels={{
                    actions: `${t.moreActions}: ${selected.name ?? selected.email}`,
                    reset: t.reset,
                    resetSubmit: t.resetSubmit,
                    sessions: t.sessions,
                    status: selected.status === "ACTIVE" ? t.disable : t.enable,
                    audit: t.audit,
                    delete: t.delete,
                    deleteWarning: t.deleteWarning,
                    deleteConfirm: t.deleteConfirm,
                    cancel: t.cancel,
                    showPassword: t.showPassword,
                    hidePassword: t.hidePassword,
                  }}
                />
              </>
            }
          />
        </div>
      ) : null}
    </div>
  );
}
