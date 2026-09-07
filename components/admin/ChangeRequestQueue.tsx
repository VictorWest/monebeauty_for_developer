import { prisma } from "@/lib/db";
import { reviewAppointmentChangeRequestAction } from "@/lib/change-request-actions";
import type { Locale } from "@/i18n/routing";

export async function ChangeRequestQueue({ locale }: { locale: Locale }) {
  const t =
    locale === "fi"
      ? {
          title: "Asiakkaiden muutospyynnöt",
          current: "Nykyinen",
          requested: "Toivottu",
          note: "Päätöksen perustelu",
          approve: "Hyväksy",
          reject: "Hylkää",
        }
      : locale === "ru"
        ? {
            title: "Запросы клиентов",
            current: "Текущее время",
            requested: "Желаемое время",
            note: "Комментарий к решению",
            approve: "Одобрить",
            reject: "Отклонить",
          }
        : {
            title: "Client change requests",
            current: "Current",
            requested: "Requested",
            note: "Decision note",
            approve: "Approve",
            reject: "Reject",
          };
  const requests = await prisma.appointmentChangeRequest.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    include: {
      appointment: {
        include: {
          client: true,
          service: {
            include: {
              contents: {
                where: { locale, status: "PUBLISHED" },
                take: 1,
                select: { h1: true },
              },
            },
          },
        },
      },
    },
  });
  if (!requests.length) return null;
  const format = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return (
    <section className="mb-[22px] rounded-[8px] border border-[#c9b27a] bg-[#fffaf0] p-[clamp(16px,3vw,24px)]">
      <h2 className="font-display text-[28px] font-medium">{t.title}</h2>
      <div className="mt-[14px] grid gap-[12px]">
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-[6px] border border-line-card bg-card p-[15px]"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <strong className="font-sans text-[15px]">
                  {request.appointment.contactName}
                </strong>
                <p className="text-sm text-body">
                  {request.appointment.service.contents[0]?.h1 ??
                    request.appointment.service.slug}{" "}
                  · {request.type}
                </p>
                <p className="text-sm text-muted">
                  {t.current}: {format.format(request.appointment.start)}
                  {request.requestedStart
                    ? ` · ${t.requested}: ${format.format(request.requestedStart)}`
                    : ""}
                </p>
                {request.reason ? (
                  <p className="mt-2 text-sm text-body">{request.reason}</p>
                ) : null}
              </div>
              <span className="text-xs text-muted">
                {format.format(request.createdAt)}
              </span>
            </div>
            <form
              action={reviewAppointmentChangeRequestAction}
              className="mt-3 flex flex-wrap gap-2"
            >
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={request.id} />
              <input
                name="decisionReason"
                maxLength={500}
                placeholder={t.note}
                className="min-h-[42px] flex-1 rounded border border-line-btn bg-page px-3 text-sm"
              />
              <button
                name="decision"
                value="APPROVE"
                className="min-h-[42px] rounded bg-accent px-4 text-sm text-page"
              >
                {t.approve}
              </button>
              <button
                name="decision"
                value="REJECT"
                className="min-h-[42px] rounded border border-line-btn px-4 text-sm"
              >
                {t.reject}
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
