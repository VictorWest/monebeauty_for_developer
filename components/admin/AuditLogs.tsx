import { prisma } from "@/lib/db";
import { adminHref } from "@/lib/admin-routing";
import type { Locale } from "@/i18n/routing";
import type { Prisma } from "@prisma/client";
import { AuditLogFilter } from "@/components/admin/AuditLogFilter";
import { auditFilterQuery, normalizeAuditFilters } from "@/lib/audit-filter";

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

const copy = {
  fi: {
    title: "Tapahtumaloki",
    intro:
      "Muuttumaton kirjautumis-, tietoturva-, arkaluonteisen käytön ja estettyjen toimintojen historia.",
    allStaff: "Koko henkilöstö",
    action: "Toiminto",
    outcomes: "Kaikki tulokset",
    filtering: "Suodatetaan…",
    automatic: "Suodattimet päivittyvät automaattisesti.",
    time: "Aika",
    actor: "Tekijä",
    outcome: "Tulos",
    target: "Kohde",
    empty: "Ei tapahtumia.",
    records: "tapahtumaa",
    previous: "Edellinen",
    next: "Seuraava",
  },
  en: {
    title: "Audit log",
    intro:
      "Immutable authentication, security, sensitive-access, and denied-action history.",
    allStaff: "All staff",
    action: "Action",
    outcomes: "All outcomes",
    filtering: "Filtering…",
    automatic: "Filters update automatically.",
    time: "Time",
    actor: "Actor",
    outcome: "Outcome",
    target: "Target",
    empty: "No audit records.",
    records: "records",
    previous: "Previous",
    next: "Next",
  },
  ru: {
    title: "Журнал аудита",
    intro:
      "Неизменяемая история входов, безопасности, доступа к чувствительным данным и запрещённых действий.",
    allStaff: "Все сотрудники",
    action: "Действие",
    outcomes: "Все результаты",
    filtering: "Фильтрация…",
    automatic: "Фильтры обновляются автоматически.",
    time: "Время",
    actor: "Пользователь",
    outcome: "Результат",
    target: "Объект",
    empty: "Записей нет.",
    records: "записей",
    previous: "Назад",
    next: "Далее",
  },
} as const;

export async function AuditLogs({
  locale,
  searchParams,
}: {
  locale: Locale;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const t = copy[locale];
  const filters = normalizeAuditFilters({
    staff: one(searchParams.staff),
    action: one(searchParams.action),
    outcome: one(searchParams.outcome),
  });
  const { staff: staffId, action, outcome } = filters;
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const take = 50;
  const where: Prisma.AuditLogWhereInput = {
    ...(staffId ? { actorUserId: staffId } : {}),
    ...(action
      ? { action: { contains: action, mode: "insensitive" as const } }
      : {}),
    ...(outcome ? { outcome } : {}),
  };
  const [rows, count, staff] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * take,
      take,
      include: { actorUser: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({
      where: { role: "STAFF" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    }),
  ]);
  const base = adminHref(locale, "audit");
  return (
    <div>
      <h1 className="font-display text-[clamp(34px,5vw,54px)] font-medium">
        {t.title}
      </h1>
      <p className="mt-[10px] font-sans text-[14px] text-body">{t.intro}</p>
      <AuditLogFilter
        key={`${filters.staff}:${filters.action}:${filters.outcome}`}
        initial={filters}
        staffOptions={[
          { value: "", label: t.allStaff },
          ...staff.map((item) => ({
            value: item.id,
            label: item.name ?? item.email,
          })),
        ]}
        labels={{
          allStaff: t.allStaff,
          action: t.action,
          outcomes: t.outcomes,
          filtering: t.filtering,
          automatic: t.automatic,
        }}
      />
      <div className="mt-[16px] overflow-x-auto rounded-[8px] border border-line-card bg-card">
        <table className="w-full min-w-[820px] text-left font-sans text-[13px]">
          <thead className="bg-btn-fill text-muted">
            <tr>
              <th className="p-3">{t.time}</th>
              <th className="p-3">{t.actor}</th>
              <th className="p-3">{t.action}</th>
              <th className="p-3">{t.outcome}</th>
              <th className="p-3">{t.target}</th>
              <th className="p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-line-hair">
                <td className="p-3 whitespace-nowrap">
                  {new Intl.DateTimeFormat(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(row.at)}
                </td>
                <td className="p-3">
                  {row.actorUser?.name ?? row.actor}
                  <span className="block text-[11px] text-muted">
                    {row.actorUser?.email}
                  </span>
                </td>
                <td className="p-3">{row.action}</td>
                <td className="p-3">{row.outcome}</td>
                <td className="p-3">
                  {row.entity}
                  {row.entityId ? ` · ${row.entityId.slice(-8)}` : ""}
                </td>
                <td className="p-3">{row.ipAddress ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-6 text-center text-muted">{t.empty}</p>
        ) : null}
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span>
          {count} {t.records}
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <a href={`${base}?${auditFilterQuery(filters, page - 1)}`}>
              {t.previous}
            </a>
          ) : (
            <span />
          )}
          {page * take < count ? (
            <a href={`${base}?${auditFilterQuery(filters, page + 1)}`}>
              {t.next}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
