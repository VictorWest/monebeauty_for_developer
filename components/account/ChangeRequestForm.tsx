"use client";

import { useEffect, useState } from "react";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { createAppointmentChangeRequestAction } from "@/lib/change-request-actions";
import type { Locale } from "@/i18n/routing";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import { clinicTodayYmd } from "@/lib/clinic-date";

type Slot = { start: string; end: string; label: string };
function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}
function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ChangeRequestForm({
  appointmentId,
  serviceSlug,
  optionKey,
  locale,
}: {
  appointmentId: string;
  serviceSlug: string;
  optionKey?: string | null;
  locale: Locale;
}) {
  const [mode, setMode] = useState<"" | "cancel" | "reschedule">("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[] | undefined>();

  useEffect(() => {
    if (mode !== "reschedule" || !date) return;
    let live = true;
    fetch(
      `/api/booking/slots?date=${date}&service=${encodeURIComponent(serviceSlug)}${optionKey ? `&option=${encodeURIComponent(optionKey)}` : ""}&locale=${locale}`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (live) setSlots(Array.isArray(data.slots) ? data.slots : []);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [date, locale, mode, optionKey, serviceSlug]);

  function startReschedule() {
    setMode("reschedule");
    setDate(ymd(new Date(Date.now() + 86400000)));
    setSelected("");
    setSlots([]);
    setLoading(true);
    const from = clinicTodayYmd();
    const to = addDays(from, BUSINESS_HOURS.daysAhead);
    fetch(
      `/api/booking/availability?from=${from}&to=${to}&service=${encodeURIComponent(serviceSlug)}${optionKey ? `&option=${encodeURIComponent(optionKey)}` : ""}&locale=${locale}`,
    )
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        const dates =
          ok && !data.degraded && Array.isArray(data.dates)
            ? (data.dates as string[])
            : undefined;
        setAvailableDates(dates);
        if (dates?.length && !dates.includes(date)) {
          setDate(dates[0]);
          setLoading(true);
        }
      })
      .catch(() => setAvailableDates(undefined));
  }
  function pickDate(next: string) {
    setDate(next);
    setSelected("");
    setSlots([]);
    setLoading(true);
  }

  const label =
    locale === "fi"
      ? {
          cancel: "Peruuta aika",
          reschedule: "Pyydä uutta aikaa",
          reason: "Syy tai lisätieto",
          submit: "Lähetä pyyntö",
          close: "Sulje lomake",
          loading: "Haetaan aikoja…",
          none: "Ei vapaita aikoja.",
        }
      : locale === "ru"
        ? {
            cancel: "Отменить запись",
            reschedule: "Запросить другое время",
            reason: "Причина или комментарий",
            submit: "Отправить запрос",
            close: "Закрыть форму",
            loading: "Загрузка…",
            none: "Нет свободного времени.",
          }
        : {
            cancel: "Cancel appointment",
            reschedule: "Request another time",
            reason: "Reason or additional information",
            submit: "Submit request",
            close: "Close form",
            loading: "Loading times…",
            none: "No available times.",
          };

  if (!mode)
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={startReschedule}
          className="min-h-11 rounded border border-line-btn px-3 text-sm transition-colors hover:bg-btn-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {label.reschedule}
        </button>
        <button
          type="button"
          onClick={() => setMode("cancel")}
          className="min-h-11 rounded border border-line-btn px-3 text-sm transition-colors hover:bg-btn-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {label.cancel}
        </button>
      </div>
    );

  return (
    <form
      action={createAppointmentChangeRequestAction}
      className="mt-4 min-w-0 rounded-[6px] border border-line-card bg-page p-4"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input
        type="hidden"
        name="type"
        value={mode === "cancel" ? "CANCEL" : "RESCHEDULE"}
      />
      <input type="hidden" name="requestedStart" value={selected} />
      {mode === "reschedule" ? (
        <>
          <BookingCalendar
            locale={locale}
            value={date}
            onSelect={pickDate}
            availableDates={availableDates}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {loading ? (
              <span className="text-sm text-muted">{label.loading}</span>
            ) : slots.length ? (
              slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setSelected(slot.start)}
                  className={`min-h-11 rounded border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${selected === slot.start ? "border-accent bg-accent text-page" : "border-line-btn bg-card hover:bg-btn-fill"}`}
                >
                  {slot.label}
                </button>
              ))
            ) : (
              <span className="text-sm text-muted">{label.none}</span>
            )}
          </div>
        </>
      ) : null}
      <label className="mt-3 block text-sm text-body">
        {label.reason}
        <textarea
          name="reason"
          maxLength={500}
          className="mt-1 min-h-[86px] w-full rounded border border-line-btn bg-card p-3 outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          disabled={mode === "reschedule" && !selected}
          className="min-h-11 rounded bg-accent px-4 text-sm text-page focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
        >
          {label.submit}
        </button>
        <button
          type="button"
          onClick={() => setMode("")}
          aria-label={label.close}
          className="min-h-11 min-w-11 rounded border border-line-btn px-4 text-sm hover:bg-btn-fill focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ×
        </button>
      </div>
    </form>
  );
}
