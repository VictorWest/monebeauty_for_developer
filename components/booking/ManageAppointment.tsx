"use client";

import { useEffect, useState } from "react";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import {
  cancelAppointmentByTokenAction,
  rescheduleAppointmentByTokenAction,
} from "@/lib/appointment-manage-actions";
import type { Locale } from "@/i18n/routing";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import { clinicTodayYmd } from "@/lib/clinic-date";

type Slot = { start: string; end: string; label: string };

export type ManageCopy = {
  reschedule: string;
  cancel: string;
  confirmReschedule: string;
  confirmCancel: string;
  cancelWarning: string;
  reason: string;
  back: string;
  loading: string;
  none: string;
};

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ManageAppointment({
  token,
  serviceSlug,
  optionKey,
  locale,
  copy,
}: {
  token: string;
  serviceSlug: string;
  optionKey?: string | null;
  locale: Locale;
  copy: ManageCopy;
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

  if (!mode)
    return (
      <div className="mt-[18px] flex flex-wrap gap-[8px]">
        <button
          type="button"
          onClick={startReschedule}
          className="min-h-11 rounded bg-accent px-5 font-sans text-xs font-medium tracking-[.1em] text-page uppercase"
        >
          {copy.reschedule}
        </button>
        <button
          type="button"
          onClick={() => setMode("cancel")}
          className="min-h-11 rounded border border-line-btn px-4 font-sans text-sm"
        >
          {copy.cancel}
        </button>
      </div>
    );

  return (
    <form
      action={
        mode === "cancel"
          ? cancelAppointmentByTokenAction
          : rescheduleAppointmentByTokenAction
      }
      className="mt-[18px] rounded-[6px] border border-line-card bg-page p-[14px]"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {mode === "reschedule" ? (
        <>
          <input type="hidden" name="start" value={selected} />
          <BookingCalendar
            locale={locale}
            value={date}
            onSelect={pickDate}
            availableDates={availableDates}
          />
          <div className="mt-[12px] flex flex-wrap gap-[7px]">
            {loading ? (
              <span className="text-sm text-muted">{copy.loading}</span>
            ) : slots.length ? (
              slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  onClick={() => setSelected(slot.start)}
                  className={`min-h-[40px] rounded border px-3 text-sm ${selected === slot.start ? "border-accent bg-accent text-page" : "border-line-btn bg-card"}`}
                >
                  {slot.label}
                </button>
              ))
            ) : (
              <span className="text-sm text-muted">{copy.none}</span>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="font-sans text-sm text-body">{copy.cancelWarning}</p>
          <label className="mt-[12px] block font-sans text-sm text-body">
            {copy.reason}
            <textarea
              name="reason"
              maxLength={500}
              className="mt-1 min-h-[86px] w-full rounded border border-line-btn bg-card p-3"
            />
          </label>
        </>
      )}
      <div className="mt-[12px] flex flex-wrap gap-[8px]">
        <button
          disabled={mode === "reschedule" && !selected}
          className="min-h-11 rounded bg-accent px-5 font-sans text-xs font-medium tracking-[.1em] text-page uppercase disabled:opacity-50"
        >
          {mode === "cancel" ? copy.confirmCancel : copy.confirmReschedule}
        </button>
        <button
          type="button"
          onClick={() => setMode("")}
          className="min-h-11 rounded border border-line-btn px-4 font-sans text-sm"
        >
          {copy.back}
        </button>
      </div>
    </form>
  );
}
