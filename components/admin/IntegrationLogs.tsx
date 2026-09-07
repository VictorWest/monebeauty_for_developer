import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { adminHref } from "@/lib/admin-routing";
import type { Locale } from "@/i18n/routing";

function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] : value; }

const COPY = {
  en: { title: "Integration logs", intro: "Redacted provider request and response attempts retained for 30 days.", provider: "Provider", operation: "Operation", outcome: "Outcome", status: "HTTP", request: "Request ID", duration: "Duration", related: "Related", time: "Time", all: "All", empty: "No attempts found.", previous: "Previous", next: "Next", filter: "Filter" },
  fi: { title: "Integraatiolokit", intro: "Palveluntarjoajien suojatut pyyntö- ja vastausyritykset säilytetään 30 päivää.", provider: "Palvelu", operation: "Toiminto", outcome: "Tulos", status: "HTTP", request: "Pyyntötunnus", duration: "Kesto", related: "Kohde", time: "Aika", all: "Kaikki", empty: "Tapahtumia ei löytynyt.", previous: "Edellinen", next: "Seuraava", filter: "Suodata" },
  ru: { title: "Журнал интеграций", intro: "Защищённые данные запросов и ответов провайдеров хранятся 30 дней.", provider: "Провайдер", operation: "Операция", outcome: "Результат", status: "HTTP", request: "ID запроса", duration: "Время", related: "Объект", time: "Дата", all: "Все", empty: "Попыток не найдено.", previous: "Назад", next: "Далее", filter: "Фильтр" },
} as const;

export async function IntegrationLogs({ locale, searchParams }: { locale: Locale; searchParams: Record<string, string | string[] | undefined> }) {
  const t = COPY[locale];
  const provider = (one(searchParams.provider) ?? "").slice(0, 80);
  const operation = (one(searchParams.operation) ?? "").slice(0, 120);
  const outcome = one(searchParams.outcome) === "SUCCESS" || one(searchParams.outcome) === "FAILURE" ? one(searchParams.outcome)! : "";
  const page = Math.max(1, Number(one(searchParams.page)) || 1);
  const take = 50;
  const where: Prisma.ExternalApiAttemptWhereInput = {
    ...(provider ? { provider } : {}),
    ...(operation ? { operation: { contains: operation, mode: "insensitive" } } : {}),
    ...(outcome ? { outcome } : {}),
  };
  const [rows, count, providers] = await Promise.all([
    prisma.externalApiAttempt.findMany({ where, orderBy: { attemptedAt: "desc" }, skip: (page - 1) * take, take }),
    prisma.externalApiAttempt.count({ where }),
    prisma.externalApiAttempt.findMany({ distinct: ["provider"], select: { provider: true }, orderBy: { provider: "asc" } }),
  ]);
  const query = (next: number) => { const q = new URLSearchParams(); if (provider) q.set("provider", provider); if (operation) q.set("operation", operation); if (outcome) q.set("outcome", outcome); if (next > 1) q.set("page", String(next)); return q.toString(); };
  const base = adminHref(locale, "integrations");
  return <div><h1 className="font-display text-[clamp(34px,5vw,54px)] font-medium">{t.title}</h1><p className="mt-2 font-sans text-sm text-body">{t.intro}</p>
    <form className="mt-5 grid gap-3 rounded border border-line-card bg-card p-4 sm:grid-cols-4"><input name="provider" list="integration-providers" defaultValue={provider} placeholder={t.provider} className={input} /><datalist id="integration-providers">{providers.map((item) => <option key={item.provider} value={item.provider} />)}</datalist><input name="operation" defaultValue={operation} placeholder={t.operation} className={input} /><input name="outcome" list="integration-outcomes" defaultValue={outcome} placeholder={`${t.outcome}: SUCCESS / FAILURE`} className={input} /><datalist id="integration-outcomes"><option value="SUCCESS" /><option value="FAILURE" /></datalist><button className="rounded bg-accent px-4 font-sans text-sm text-page">{t.filter}</button></form>
    <div className="mt-4 overflow-x-auto rounded border border-line-card bg-card"><table className="w-full min-w-[1000px] text-left font-sans text-xs"><thead className="bg-btn-fill text-muted"><tr>{[t.time,t.provider,t.operation,t.outcome,t.status,t.request,t.duration,t.related].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-line-hair align-top"><td className="p-3 whitespace-nowrap">{new Intl.DateTimeFormat(locale,{dateStyle:"short",timeStyle:"medium"}).format(row.attemptedAt)}</td><td className="p-3">{row.provider}</td><td className="p-3">{row.operation}{row.errorMessage ? <span className="mt-1 block max-w-[300px] break-words text-red-700">{row.errorCode ? `${row.errorCode}: ` : ""}{row.errorMessage}</span> : null}</td><td className="p-3">{row.outcome}</td><td className="p-3">{row.httpStatus ?? "—"}</td><td className="p-3 break-all">{row.providerRequestId ?? row.providerMessageId ?? "—"}</td><td className="p-3">{row.durationMs == null ? "—" : `${row.durationMs} ms`}</td><td className="p-3">{row.appointmentId ? `Appointment ${row.appointmentId.slice(-8)}` : row.orderId ? `Order ${row.orderId.slice(-8)}` : row.messageId ? `Message ${row.messageId.slice(-8)}` : row.correlationId ?? "—"}</td></tr>)}</tbody></table>{!rows.length ? <p className="p-6 text-center font-sans text-sm text-muted">{t.empty}</p> : null}</div>
    <div className="mt-4 flex justify-between font-sans text-sm"><span>{count}</span><div className="flex gap-3">{page > 1 ? <a href={`${base}?${query(page - 1)}`}>{t.previous}</a> : null}{page * take < count ? <a href={`${base}?${query(page + 1)}`}>{t.next}</a> : null}</div></div>
  </div>;
}

const input = "min-h-11 rounded border border-line-btn bg-page px-3 font-sans text-sm";
