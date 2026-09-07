import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { AppointmentStatus, OrderStatus, Prisma } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { adminHref } from "@/lib/admin-routing";
import { openPublicDates, openSlots } from "@/lib/booking";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import {
  redeemVoucherAction,
  refundOrderAction,
  retryCommunicationAction,
  updateAppointmentAction,
  updateOrderAction,
} from "@/lib/admin-actions";
import { CommunicationComposer } from "./CommunicationComposer";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { clinicTodayYmd } from "@/lib/clinic-date";
import { TimePicker } from "@/components/ui/TimePicker";
import { OperationsFilter } from "./OperationsFilter";
import {
  normalizeOperationsRange,
  operationsDateRange,
} from "@/lib/operations-filter";
import { reviewOrderCancellationRequestAction } from "@/lib/order-cancellation-actions";

type SearchParams = Record<string, string | string[] | undefined>;
const orderStatuses: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "READY_FOR_PICKUP",
  "SHIPPED",
  "FULFILLED",
  "CANCELLED",
];
const orderFilterStatuses = ["AWAITING_PAYMENT", ...orderStatuses] as const;
const orderFilterStatusesWithRequests = [
  "PENDING_REQUEST",
  ...orderFilterStatuses,
] as const;
const appointmentStatuses: AppointmentStatus[] = [
  "BOOKED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
];
const panel =
  "rounded-[var(--radius)] border border-line-card bg-card p-[clamp(18px,3vw,28px)]";
const input =
  "min-h-[44px] rounded-[4px] border border-line-btn bg-page px-[12px] font-sans text-[15px] text-ink";
const primary =
  "inline-flex min-h-[44px] items-center justify-center rounded-[4px] bg-ink px-[17px] font-sans text-[12px] font-medium tracking-[.08em] text-white uppercase";
const secondary =
  "inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-line-btn px-[17px] font-sans text-[12px] font-medium tracking-[.08em] text-ink uppercase";
const danger =
  "inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-red-300 px-[17px] font-sans text-[12px] font-medium tracking-[.08em] text-red-800 uppercase";

function scalar(params: SearchParams, key: string) {
  const raw = params[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function pageNumber(params: SearchParams) {
  return Math.max(1, Number.parseInt(scalar(params, "page"), 10) || 1);
}

function reference(id: string) {
  return id.slice(-8).toUpperCase();
}

function formatDate(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Helsinki",
  }).format(value);
}

function formatTime(value: Date, locale: Locale) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  }).format(value);
}

function money(value: unknown, currency: string, locale: Locale) {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    Number(value),
  );
}

function queryHref(
  base: string,
  params: Record<string, string | number | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(key, String(value));
  const suffix = query.toString();
  return suffix ? `${base}?${suffix}` : base;
}

function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header>
      <h1 className="font-display text-[clamp(38px,5vw,56px)] leading-[1.05] font-medium text-ink">
        {title}
      </h1>
      <p className="mt-[8px] max-w-[720px] font-sans text-[15px] leading-[1.6] text-body">
        {description}
      </p>
    </header>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const active =
    status === "PENDING" ||
    status === "AWAITING_PAYMENT" ||
    status === "BOOKED" ||
    status === "RESCHEDULED";
  const cancelled = status === "CANCELLED";
  return (
    <span
      className={`inline-flex rounded-full px-[10px] py-[5px] font-sans text-[12px] ${cancelled ? "bg-red-50 text-red-800" : active ? "bg-btn-fill text-ink" : "bg-[#edf3e9] text-[#3e6339]"}`}
    >
      {label}
    </span>
  );
}

function adminOrderStatus(order: {
  source: string;
  status: OrderStatus;
  paymentStatus: string;
}) {
  return order.source === "WEBSITE_STRIPE" &&
    order.status === "PENDING" &&
    ["UNPAID", "PROCESSING"].includes(order.paymentStatus)
    ? "AWAITING_PAYMENT"
    : order.status;
}

function Pagination({
  base,
  page,
  pages,
  params,
}: {
  base: string;
  page: number;
  pages: number;
  params: Record<string, string | undefined>;
}) {
  if (pages <= 1) return null;
  return (
    <nav
      className="mt-[18px] flex items-center justify-between font-sans text-[13px]"
      aria-label="Pagination"
    >
      {page > 1 ? (
        <Link
          className={secondary}
          href={queryHref(base, { ...params, page: page - 1 })}
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-muted">
        {page} / {pages}
      </span>
      {page < pages ? (
        <Link
          className={secondary}
          href={queryHref(base, { ...params, page: page + 1 })}
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

export async function OrdersAdmin({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id?: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "AdminOperations" });
  const base = adminHref(locale, "orders");
  if (id) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        client: true,
        items: { include: { vouchers: true } },
        payments: { orderBy: { createdAt: "desc" } },
        refunds: { orderBy: { createdAt: "desc" } },
        cancellationRequests: {
          orderBy: { createdAt: "desc" },
          include: { client: true, reviewedBy: true },
        },
        messages: {
          include: {
            attempts: {
              orderBy: { attemptedAt: "desc" },
              include: { externalApiAttempt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!order) notFound();
    return (
      <div>
        <Link
          href={base}
          className="font-sans text-[13px] text-muted underline"
        >
          ← {t("back")}
        </Link>
        <div className="mt-[14px] flex flex-wrap items-end justify-between gap-[16px]">
          <PageTitle
            title={`${t("orders")} ${reference(order.id)}`}
            description={`${order.client?.fullName ?? order.email} · ${formatDate(order.createdAt, locale)}`}
          />
          {(() => {
            const status = adminOrderStatus(order);
            return (
              <StatusBadge
                status={status}
                label={t(`statusLabels.${status}`)}
              />
            );
          })()}
        </div>
        <div className="mt-[22px] grid gap-[18px] xl:grid-cols-[1.25fr_.75fr]">
          <section className={panel}>
            <dl className="grid gap-[14px] font-sans text-[14px] sm:grid-cols-2">
              <Detail
                label={t("contact")}
                value={`${order.email}${order.phone ? ` · ${order.phone}` : ""}`}
              />
              <Detail label={t("locale")} value={order.locale.toUpperCase()} />
              <Detail
                label={t("submitted")}
                value={formatDate(order.createdAt, locale)}
              />
              <Detail
                label={t("total")}
                value={money(order.total, order.currency, locale)}
              />
              <Detail
                label={t("payment")}
                value={t(`paymentStatusLabels.${order.paymentStatus}`)}
              />
              <Detail
                label={t("fulfillment")}
                value={order.fulfillmentMethod ?? "—"}
              />
              {order.notes ? (
                <Detail label={t("notes")} value={order.notes} wide />
              ) : null}
              {order.cancellationReason ? (
                <Detail
                  label={t("reason")}
                  value={order.cancellationReason}
                  wide
                />
              ) : null}
            </dl>
            <div className="mt-[22px] overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse font-sans text-[14px]">
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-t border-line-hair">
                      <td className="py-[12px] pr-[14px]">
                        {item.qty} × {item.name}
                        {item.vouchers.map((voucher) => (
                          <span
                            key={voucher.id}
                            className="mt-[4px] block font-mono text-[12px] text-muted"
                          >
                            {voucher.code} · {voucher.status} ·{" "}
                            {money(
                              voucher.remainingValue,
                              voucher.currency,
                              locale,
                            )}
                          </span>
                        ))}
                      </td>
                      <td className="py-[12px] text-right">
                        {money(
                          Number(item.unitPrice) * item.qty,
                          order.currency,
                          locale,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className={`${panel} h-fit`}>
            <h2 className="font-display text-[26px] font-medium">
              {t("status")}
            </h2>
            <div className="mt-[14px] flex flex-wrap gap-[8px]">
              {order.status === "PENDING" ? (
                <ActionForm
                  action={updateOrderAction}
                  id={order.id}
                  returnTo={`${base}/${order.id}`}
                  intent="confirm"
                  label={t("confirm")}
                />
              ) : null}
              {order.status === "CONFIRMED" &&
              order.fulfillmentMethod === "PICKUP" ? (
                <ActionForm
                  action={updateOrderAction}
                  id={order.id}
                  returnTo={`${base}/${order.id}`}
                  intent="ready"
                  label={t("ready")}
                />
              ) : null}
              {order.status === "CONFIRMED" &&
              order.fulfillmentMethod === "SHIPPING" ? (
                <ActionForm
                  action={updateOrderAction}
                  id={order.id}
                  returnTo={`${base}/${order.id}`}
                  intent="ship"
                  label={t("ship")}
                />
              ) : null}
              {["READY_FOR_PICKUP", "SHIPPED"].includes(order.status) ? (
                <ActionForm
                  action={updateOrderAction}
                  id={order.id}
                  returnTo={`${base}/${order.id}`}
                  intent="fulfill"
                  label={t("fulfill")}
                />
              ) : null}
            </div>
            {order.status === "PENDING" && order.paymentStatus === "UNPAID" ? (
              <form
                action={updateOrderAction}
                className="mt-[18px] grid gap-[9px] border-t border-line-hair pt-[16px]"
              >
                <input type="hidden" name="id" value={order.id} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`${base}/${order.id}`}
                />
                <input type="hidden" name="intent" value="cancel" />
                <label className="font-sans text-[13px] text-muted">
                  {t("reason")}
                  <textarea
                    required
                    minLength={3}
                    maxLength={500}
                    name="reason"
                    rows={3}
                    className={`${input} mt-[6px] w-full py-[9px]`}
                  />
                </label>
                <button className={danger}>{t("cancel")}</button>
              </form>
            ) : null}
            {["PAID", "PARTIALLY_REFUNDED"].includes(order.paymentStatus) ? (
              <form
                action={refundOrderAction}
                className="mt-[18px] grid gap-[9px] border-t border-line-hair pt-[16px]"
              >
                <input type="hidden" name="id" value={order.id} />
                <input
                  type="hidden"
                  name="returnTo"
                  value={`${base}/${order.id}`}
                />
                <input type="hidden" name="target" value="order" />
                <label className="font-sans text-[13px] text-muted">
                  {t("refundAmount")}
                  <input
                    required
                    name="amount"
                    inputMode="decimal"
                    className={`${input} mt-[6px] w-full`}
                  />
                </label>
                <label className="font-sans text-[13px] text-muted">
                  {t("refundReason")}
                  <textarea
                    required
                    minLength={3}
                    maxLength={500}
                    name="reason"
                    rows={3}
                    className={`${input} mt-[6px] w-full py-[9px]`}
                  />
                </label>
                <button className={danger}>{t("refund")}</button>
              </form>
            ) : null}
            {order.items.some((item) => item.vouchers.length) ? (
              <form
                action={redeemVoucherAction}
                className="mt-[18px] grid gap-[9px] border-t border-line-hair pt-[16px]"
              >
                <input
                  type="hidden"
                  name="returnTo"
                  value={`${base}/${order.id}`}
                />
                <label className="font-sans text-[13px] text-muted">
                  {t("voucherCode")}
                  <input
                    required
                    name="code"
                    className={`${input} mt-[6px] w-full font-mono`}
                  />
                </label>
                <label className="font-sans text-[13px] text-muted">
                  {t("redemptionAmount")}
                  <input
                    name="amount"
                    inputMode="decimal"
                    className={`${input} mt-[6px] w-full`}
                  />
                </label>
                <label className="font-sans text-[13px] text-muted">
                  {t("notes")}
                  <input name="note" className={`${input} mt-[6px] w-full`} />
                </label>
                <button className={secondary}>{t("redeem")}</button>
              </form>
            ) : null}
            {order.cancellationRequests.length ? (
              <div className="mt-[18px] grid gap-[12px] border-t border-line-hair pt-[16px]">
                <h3 className="font-display text-[23px] font-medium">
                  {t("cancellationRequests")}
                </h3>
                {order.cancellationRequests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded border border-line-card bg-page p-[12px] font-sans text-[13px]"
                  >
                    <p className="font-medium text-ink">
                      {t(`requestStatusLabels.${request.status}`)} ·{" "}
                      {formatDate(request.createdAt, locale)}
                    </p>
                    <p className="mt-[6px] leading-[1.6] text-body">
                      {request.reason}
                    </p>
                    {request.decisionReason ? (
                      <p className="mt-[6px] text-muted">
                        {request.decisionReason}
                      </p>
                    ) : null}
                    {request.status === "PENDING" ? (
                      <div className="mt-[10px] grid gap-[10px]">
                        <form
                          action={reviewOrderCancellationRequestAction}
                          className="grid gap-[7px]"
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`${base}/${order.id}`}
                          />
                          <input type="hidden" name="intent" value="approve" />
                          <label className="text-muted">
                            {t("decisionReasonOptional")}
                            <textarea
                              name="decisionReason"
                              maxLength={500}
                              rows={2}
                              className={`${input} mt-[5px] w-full py-[8px]`}
                            />
                          </label>
                          <button className={primary}>
                            {t("approveRequest")}
                          </button>
                        </form>
                        <form
                          action={reviewOrderCancellationRequestAction}
                          className="grid gap-[7px]"
                        >
                          <input type="hidden" name="locale" value={locale} />
                          <input
                            type="hidden"
                            name="requestId"
                            value={request.id}
                          />
                          <input
                            type="hidden"
                            name="returnTo"
                            value={`${base}/${order.id}`}
                          />
                          <input type="hidden" name="intent" value="reject" />
                          <label className="text-muted">
                            {t("decisionReasonRequired")}
                            <textarea
                              required
                              minLength={3}
                              maxLength={500}
                              name="decisionReason"
                              rows={2}
                              className={`${input} mt-[5px] w-full py-[8px]`}
                            />
                          </label>
                          <button className={danger}>
                            {t("rejectRequest")}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
        <div className="mt-[18px]">
          <CommunicationHistory
            messages={order.messages}
            locale={locale}
            returnTo={`${base}/${order.id}`}
            t={t}
          />
        </div>
        <div className="mt-[18px]">
          <CommunicationComposer
            entity="Order"
            id={order.id}
            returnTo={`${base}/${order.id}`}
            email={order.email}
            phone={order.phone}
            labels={composerLabels(t)}
          />
        </div>
      </div>
    );
  }

  const q = scalar(searchParams, "q");
  const rawStatus = scalar(searchParams, "status");
  const { from, to } = normalizeOperationsRange(
    scalar(searchParams, "from"),
    scalar(searchParams, "to"),
  );
  const status = orderStatuses.includes(rawStatus as OrderStatus)
    ? (rawStatus as OrderStatus)
    : undefined;
  const awaitingPayment = rawStatus === "AWAITING_PAYMENT";
  const pendingRequest = rawStatus === "PENDING_REQUEST";
  const page = pageNumber(searchParams);
  const createdAt = operationsDateRange(from, to);
  const where: Prisma.OrderWhereInput = {
    ...(pendingRequest
      ? { cancellationRequests: { some: { status: "PENDING" } } }
      : awaitingPayment
        ? {
            source: "WEBSITE_STRIPE",
            status: "PENDING",
            paymentStatus: { in: ["UNPAID", "PROCESSING"] },
          }
        : status
          ? { status }
          : rawStatus === "ACTIVE"
            ? {
                status: {
                  in: ["PENDING", "CONFIRMED", "READY_FOR_PICKUP", "SHIPPED"],
                },
              }
            : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { client: { fullName: { contains: q, mode: "insensitive" } } },
            { items: { some: { name: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };
  const [orders, count] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        client: true,
        items: true,
        messages: {
          include: {
            attempts: {
              orderBy: { attemptedAt: "desc" },
              take: 1,
              include: { externalApiAttempt: true },
            },
          },
        },
        cancellationRequests: {
          where: { status: "PENDING" },
          select: { id: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 25,
      take: 25,
    }),
    prisma.order.count({ where }),
  ]);
  return (
    <div>
      <PageTitle title={t("orders")} description={t("orderDescription")} />
      <FilterForm
        locale={locale}
        q={q}
        status={
          pendingRequest
            ? "PENDING_REQUEST"
            : awaitingPayment
              ? "AWAITING_PAYMENT"
              : rawStatus === "ACTIVE"
                ? "ACTIVE"
                : (status ?? "")
        }
        statuses={orderFilterStatusesWithRequests}
        from={from}
        to={to}
        t={t}
      />
      <div className="mt-[18px] grid gap-[10px]">
        {orders.length ? (
          orders.map((order) => (
            <Link
              key={order.id}
              href={`${base}/${order.id}`}
              className="grid gap-[10px] rounded-[8px] border border-line-card bg-card p-[16px] transition-colors hover:bg-btn-fill md:grid-cols-[130px_1fr_150px_140px] md:items-center"
            >
              <strong className="font-mono text-[12px] tracking-[.05em]">
                {reference(order.id)}
              </strong>
              <span className="min-w-0 font-sans text-[14px]">
                <strong className="block text-ink">
                  {order.client?.fullName ?? order.email}
                </strong>
                <small className="block truncate text-[12px] text-muted">
                  {order.items
                    .map((item) => `${item.qty}× ${item.name}`)
                    .join(", ")}
                </small>
                {order.cancellationRequests.length ? (
                  <small className="mt-[3px] block text-[12px] font-medium text-red-800">
                    {t("pendingCancellationRequest")}
                  </small>
                ) : null}
              </span>
              <span className="font-sans text-[14px]">
                {money(order.total, order.currency, locale)}
              </span>
              {(() => {
                const status = adminOrderStatus(order);
                return (
                  <StatusBadge
                    status={status}
                    label={t(`statusLabels.${status}`)}
                  />
                );
              })()}
            </Link>
          ))
        ) : (
          <p className={`${panel} font-sans text-[14px] text-muted`}>
            {t("empty")}
          </p>
        )}
      </div>
      <Pagination
        base={base}
        page={page}
        pages={Math.ceil(count / 25)}
        params={{
          q,
          status: awaitingPayment
            ? "AWAITING_PAYMENT"
            : pendingRequest
              ? "PENDING_REQUEST"
              : rawStatus === "ACTIVE"
                ? "ACTIVE"
                : status,
          from,
          to,
        }}
      />
    </div>
  );
}

export async function AppointmentsAdmin({
  locale,
  id,
  searchParams,
}: {
  locale: Locale;
  id?: string;
  searchParams: SearchParams;
}) {
  const t = await getTranslations({ locale, namespace: "AdminOperations" });
  const base = adminHref(locale, "appointments");
  if (id) {
    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        client: true,
        service: {
          include: {
            contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
          },
        },
        events: { orderBy: { at: "desc" } },
        messages: {
          include: {
            attempts: {
              orderBy: { attemptedAt: "desc" },
              include: { externalApiAttempt: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!appointment) notFound();
    const selectedDate =
      scalar(searchParams, "date") ||
      appointment.start.toISOString().slice(0, 10);
    const slots = ["BOOKED", "CONFIRMED", "RESCHEDULED"].includes(
      appointment.status,
    )
      ? await openSlots({
          dateStr: selectedDate,
          serviceKey: appointment.service.slug,
        })
      : [];
    const bookingStart = clinicTodayYmd();
    const availableDates = await openPublicDates({
      fromDate: bookingStart,
      toDate: addDays(bookingStart, BUSINESS_HOURS.daysAhead),
      serviceKey: appointment.service.slug,
      locale,
    });
    const service =
      appointment.procedureTitle ??
      appointment.service.contents[0]?.h1 ??
      appointment.service.slug;
    return (
      <div>
        <Link
          href={base}
          className="font-sans text-[13px] text-muted underline"
        >
          ← {t("back")}
        </Link>
        <div className="mt-[14px] flex flex-wrap items-end justify-between gap-[16px]">
          <PageTitle
            title={`${t("appointments")} ${reference(appointment.id)}`}
            description={`${appointment.contactName} · ${formatDate(appointment.start, locale)}`}
          />
          <StatusBadge
            status={appointment.status}
            label={t(`statusLabels.${appointment.status}`)}
          />
        </div>
        <div className="mt-[22px] grid gap-[18px] xl:grid-cols-[1.25fr_.75fr]">
          <section className={panel}>
            <dl className="grid gap-[14px] font-sans text-[14px] sm:grid-cols-2">
              <Detail
                label={t("contact")}
                value={`${appointment.contactEmail} · ${appointment.contactPhone}`}
              />
              <Detail
                label={t("locale")}
                value={appointment.locale.toUpperCase()}
              />
              <Detail label={t("service")} value={service} />
              <Detail
                label={t("time")}
                value={formatDate(appointment.start, locale)}
              />
              {appointment.notes ? (
                <Detail label={t("notes")} value={appointment.notes} wide />
              ) : null}
              {appointment.cancellationReason ? (
                <Detail
                  label={t("reason")}
                  value={appointment.cancellationReason}
                  wide
                />
              ) : null}
            </dl>
            {appointment.events.length ? (
              <div className="mt-[22px] border-t border-line-hair pt-[18px]">
                <h2 className="font-display text-[24px] font-medium">
                  {t("history")}
                </h2>
                <div className="mt-[10px] grid gap-[8px] font-sans text-[13px]">
                  {appointment.events.map((event) => (
                    <div
                      key={event.id}
                      className="grid gap-[4px] rounded-[5px] bg-page p-[11px] sm:grid-cols-[150px_1fr]"
                    >
                      <span className="text-muted">
                        {formatDate(event.at, locale)}
                      </span>
                      <span>
                        {event.kind} · {event.actor}
                        {event.reason ? ` · ${event.reason}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
          <section className={`${panel} h-fit`}>
            <h2 className="font-display text-[26px] font-medium">
              {t("status")}
            </h2>
            <div className="mt-[14px] flex flex-wrap gap-[8px]">
              {["BOOKED", "RESCHEDULED"].includes(appointment.status) ? (
                <ActionForm
                  action={updateAppointmentAction}
                  id={appointment.id}
                  returnTo={`${base}/${appointment.id}`}
                  intent="confirm"
                  label={t("confirm")}
                />
              ) : null}
              {appointment.status === "CONFIRMED" &&
              appointment.end <= new Date() ? (
                <ActionForm
                  action={updateAppointmentAction}
                  id={appointment.id}
                  returnTo={`${base}/${appointment.id}`}
                  intent="complete"
                  label={t("complete")}
                />
              ) : null}
            </div>
            {["BOOKED", "CONFIRMED", "RESCHEDULED"].includes(
              appointment.status,
            ) ? (
              <>
                <form className="mt-[18px] grid gap-[9px] border-t border-line-hair pt-[16px]">
                  <label className="font-sans text-[13px] text-muted">
                    {t("chooseDate")}
                    <DatePicker
                      locale={locale}
                      name="date"
                      defaultValue={selectedDate}
                      min={clinicTodayYmd()}
                      disableClosedDays
                      availableDates={availableDates}
                      ariaLabel={t("chooseDate")}
                      placeholder={t("chooseDate")}
                      className="mt-[6px] w-full"
                    />
                  </label>
                  <button className={secondary}>{t("showTimes")}</button>
                </form>
                <form
                  action={updateAppointmentAction}
                  className="mt-[12px] grid gap-[9px]"
                >
                  <input type="hidden" name="id" value={appointment.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`${base}/${appointment.id}`}
                  />
                  <input type="hidden" name="intent" value="reschedule" />
                  <label className="font-sans text-[13px] text-muted">
                    {t("chooseTime")}
                    <TimePicker
                      name="start"
                      inline
                      ariaLabel={t("chooseTime")}
                      options={slots.map((slot) => ({
                        value: slot.start,
                        label: formatTime(new Date(slot.start), locale),
                      }))}
                      className="mt-[6px]"
                    />
                  </label>
                  <button className={secondary}>{t("reschedule")}</button>
                </form>
                <form
                  action={updateAppointmentAction}
                  className="mt-[18px] grid gap-[9px] border-t border-line-hair pt-[16px]"
                >
                  <input type="hidden" name="id" value={appointment.id} />
                  <input
                    type="hidden"
                    name="returnTo"
                    value={`${base}/${appointment.id}`}
                  />
                  <input type="hidden" name="intent" value="cancel" />
                  <label className="font-sans text-[13px] text-muted">
                    {t("reason")}
                    <textarea
                      required
                      minLength={3}
                      maxLength={500}
                      name="reason"
                      rows={3}
                      className={`${input} mt-[6px] w-full py-[9px]`}
                    />
                  </label>
                  <button className={danger}>{t("cancel")}</button>
                </form>
              </>
            ) : null}
          </section>
        </div>
        <div className="mt-[18px]">
          <CommunicationHistory
            messages={appointment.messages}
            locale={locale}
            returnTo={`${base}/${appointment.id}`}
            t={t}
          />
        </div>
        <div className="mt-[18px]">
          <CommunicationComposer
            entity="Appointment"
            id={appointment.id}
            returnTo={`${base}/${appointment.id}`}
            email={appointment.contactEmail}
            phone={appointment.contactPhone}
            labels={composerLabels(t)}
          />
        </div>
      </div>
    );
  }

  const q = scalar(searchParams, "q");
  const rawStatus = scalar(searchParams, "status");
  const { from, to } = normalizeOperationsRange(
    scalar(searchParams, "from"),
    scalar(searchParams, "to"),
  );
  const status = appointmentStatuses.includes(rawStatus as AppointmentStatus)
    ? (rawStatus as AppointmentStatus)
    : undefined;
  const page = pageNumber(searchParams);
  const start = operationsDateRange(from, to);
  const where: Prisma.AppointmentWhereInput = {
    ...(status
      ? { status }
      : rawStatus === "ACTIVE"
        ? { status: { in: ["BOOKED", "CONFIRMED", "RESCHEDULED"] } }
        : {}),
    ...(start ? { start } : {}),
    ...(q
      ? {
          OR: [
            { id: { contains: q, mode: "insensitive" } },
            { procedureTitle: { contains: q, mode: "insensitive" } },
            {
              client: {
                OR: [
                  { fullName: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                  { phone: { contains: q } },
                ],
              },
            },
            { service: { slug: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const [appointments, count] = await Promise.all([
    prisma.appointment.findMany({
      where,
      include: {
        client: true,
        service: {
          include: {
            contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
          },
        },
      },
      orderBy: [{ start: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 25,
      take: 25,
    }),
    prisma.appointment.count({ where }),
  ]);
  return (
    <div>
      <PageTitle
        title={t("appointments")}
        description={t("appointmentDescription")}
      />
      <FilterForm
        locale={locale}
        q={q}
        status={rawStatus === "ACTIVE" ? "ACTIVE" : (status ?? "")}
        statuses={appointmentStatuses}
        from={from}
        to={to}
        t={t}
      />
      <div className="mt-[18px] grid gap-[10px]">
        {appointments.length ? (
          appointments.map((appointment) => {
            const service =
              appointment.procedureTitle ??
              appointment.service.contents[0]?.h1 ??
              appointment.service.slug;
            return (
              <Link
                key={appointment.id}
                href={`${base}/${appointment.id}`}
                className="grid gap-[10px] rounded-[8px] border border-line-card bg-card p-[16px] transition-colors hover:bg-btn-fill md:grid-cols-[150px_1fr_150px] md:items-center"
              >
                <span className="font-sans text-[13px]">
                  {formatDate(appointment.start, locale)}
                </span>
                <span className="min-w-0 font-sans text-[14px]">
                  <strong className="block">{appointment.contactName}</strong>
                  <small className="block truncate text-[12px] text-muted">
                    {service}
                  </small>
                </span>
                <StatusBadge
                  status={appointment.status}
                  label={t(`statusLabels.${appointment.status}`)}
                />
              </Link>
            );
          })
        ) : (
          <p className={`${panel} font-sans text-[14px] text-muted`}>
            {t("empty")}
          </p>
        )}
      </div>
      <Pagination
        base={base}
        page={page}
        pages={Math.ceil(count / 25)}
        params={{
          q,
          status: rawStatus === "ACTIVE" ? "ACTIVE" : status,
          from,
          to,
        }}
      />
    </div>
  );
}

function Detail({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-[12px] tracking-[.08em] text-muted uppercase">
        {label}
      </dt>
      <dd className="mt-[4px] whitespace-pre-wrap text-ink">{value}</dd>
    </div>
  );
}

function ActionForm({
  action,
  id,
  returnTo,
  intent,
  label,
}: {
  action: (data: FormData) => void | Promise<void>;
  id: string;
  returnTo: string;
  intent: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="intent" value={intent} />
      <button className={primary}>{label}</button>
    </form>
  );
}

function FilterForm({
  locale,
  q,
  status,
  statuses,
  from = "",
  to = "",
  t,
}: {
  locale: Locale;
  q: string;
  status: string;
  statuses: readonly string[];
  from?: string;
  to?: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <OperationsFilter
      locale={locale}
      initial={{ q, status, from, to }}
      statusOptions={[
        { value: "", label: t("all") },
        { value: "ACTIVE", label: t("active") },
        ...statuses.map((item) => ({
          value: item,
          label: t(`statusLabels.${item}`),
        })),
      ]}
      labels={{
        search: t("search"),
        status: t("status"),
        from: t("from"),
        until: t("until"),
        filtering: t("filtering"),
        automatic: t("automatic"),
      }}
    />
  );
}

function CommunicationHistory({
  messages,
  locale,
  returnTo,
  t,
}: {
  messages: Array<{
    id: string;
    channel: string;
    kind: string;
    recipient: string;
    subject: string | null;
    body: string;
    actor: string;
    createdAt: Date;
    attempts: Array<{
      id: string;
      status: string;
      provider: string | null;
      providerMessageId: string | null;
      errorDetail: string | null;
      attemptedAt: Date;
      externalApiAttempt: {
        httpStatus: number | null;
        providerRequestId: string | null;
        durationMs: number | null;
        errorMessage: string | null;
      } | null;
    }>;
  }>;
  locale: Locale;
  returnTo: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className={panel}>
      <h2 className="font-display text-[26px] font-medium">
        {t("communications")}
      </h2>
      <div className="mt-[14px] grid gap-[10px]">
        {messages.length ? (
          messages.map((message) => {
            const latest = message.attempts[0];
            const accepted = message.attempts.some(
              (attempt) => attempt.status === "ACCEPTED",
            );
            return (
              <article
                key={message.id}
                className="rounded-[6px] border border-line-hair bg-page p-[13px]"
              >
                <div className="flex flex-wrap items-center justify-between gap-[8px] font-sans text-[12px]">
                  <strong>
                    {message.channel} · {message.kind}
                  </strong>
                  <span className="text-muted">
                    {formatDate(message.createdAt, locale)} · {message.actor}
                  </span>
                </div>
                <div className="mt-[6px] font-sans text-[13px] text-body">
                  {message.subject ? (
                    <strong className="mb-[3px] block text-ink">
                      {message.subject}
                    </strong>
                  ) : null}
                  <p className="line-clamp-3 whitespace-pre-wrap">
                    {message.body}
                  </p>
                </div>
                <div className="mt-[8px] flex flex-wrap items-center gap-[8px] font-sans text-[12px] text-muted">
                  <span>{message.recipient}</span>
                  <span>·</span>
                  <span>
                    {latest
                      ? `${t(latest.status.toLowerCase())}${latest.provider ? ` · ${latest.provider}` : ""}`
                      : t("skipped")}
                  </span>
                  <span>
                    · {message.attempts.length} {t("attempts")}
                  </span>
                  {!accepted ? (
                    <form action={retryCommunicationAction}>
                      <input
                        type="hidden"
                        name="messageId"
                        value={message.id}
                      />
                      <input type="hidden" name="returnTo" value={returnTo} />
                      <button className="underline">{t("retry")}</button>
                    </form>
                  ) : null}
                </div>
                {latest &&
                (latest.errorDetail ||
                  latest.externalApiAttempt?.errorMessage) ? (
                  <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 font-sans text-xs text-red-800">
                    {latest.externalApiAttempt?.httpStatus
                      ? `HTTP ${latest.externalApiAttempt.httpStatus} · `
                      : ""}
                    {latest.externalApiAttempt?.errorMessage ??
                      latest.errorDetail}
                    {latest.externalApiAttempt?.providerRequestId
                      ? ` · request ${latest.externalApiAttempt.providerRequestId}`
                      : ""}
                    {latest.externalApiAttempt?.durationMs != null
                      ? ` · ${latest.externalApiAttempt.durationMs} ms`
                      : ""}
                  </p>
                ) : null}
              </article>
            );
          })
        ) : (
          <p className="font-sans text-[14px] text-muted">
            {t("noCommunications")}
          </p>
        )}
      </div>
    </section>
  );
}

function composerLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    title: t("custom"),
    email: t("email"),
    sms: t("sms"),
    to: t("to"),
    subject: t("subject"),
    message: t("message"),
    send: t("send"),
    segments: t("segments"),
    transactional: t("transactional"),
  };
}
