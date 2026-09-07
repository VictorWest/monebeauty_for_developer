"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowClockwise,
  CalendarBlank,
  Check,
  FloppyDisk,
} from "@phosphor-icons/react";
import { ButtonAction } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { TimePicker } from "@/components/ui/TimePicker";
import { cn } from "@/lib/cn";

type Slot = {
  start: string;
  end: string;
  status: "open" | "closed" | "booked";
};
type Appointment = {
  id: string;
  start: string;
  end: string;
  status: string;
  serviceSlug: string;
  procedureTitle: string | null;
  procedurePrice: string | null;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  notes: string | null;
};
type SchedulePayload = {
  date: string;
  slots: Slot[];
  appointments: Appointment[];
  workingHours?: {
    startHour: number;
    endHour: number;
    stepMin: number;
    openDays: number[];
  };
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function StaffSchedule() {
  const t = useTranslations("Staff");
  const locale = useLocale();
  const [date, setDate] = useState(todayYmd());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerDates, setPickerDates] = useState<string[] | undefined>();
  const [hours, setHours] = useState({
    startHour: 10,
    endHour: 19,
    stepMin: 30,
    daysAhead: 30,
    openDays: [1, 2, 3, 4, 5, 6],
  });

  const timeFmt = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }),
    [locale],
  );

  const load = useCallback(
    async (nextDate = date) => {
      setLoading(true);
      setMessage(null);
      const qs = new URLSearchParams({ date: nextDate });
      try {
        const res = await fetch(`/api/staff/schedule?${qs.toString()}`);
        const data = (await res.json()) as SchedulePayload;
        setDate(data.date ?? nextDate);
        setSlots(data.slots ?? []);
        setAppointments(data.appointments ?? []);
        if (data.workingHours)
          setHours((current) => ({ ...current, ...data.workingHours }));
      } catch {
        setMessage(t("errors.load"));
      } finally {
        setLoading(false);
      }
    },
    [date, t],
  );

  const loadWorkingDates = useCallback(async (from: string, to: string) => {
    try {
      const params = new URLSearchParams({ from, to });
      const response = await fetch(`/api/staff/schedule?${params}`);
      if (!response.ok) throw new Error("working_dates");
      const payload = (await response.json()) as { dates?: string[] };
      setPickerDates(Array.isArray(payload.dates) ? payload.dates : undefined);
    } catch {
      setPickerDates(undefined);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function setSlotStatus(index: number, status: Slot["status"]) {
    setSlots((current) =>
      current.map((slot, i) => (i === index ? { ...slot, status } : slot)),
    );
  }

  async function saveDay() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/staff/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, slots }),
      });
      if (!res.ok) throw new Error("save_failed");
      setMessage(t("saved"));
      await load(date);
    } catch {
      setMessage(t("errors.save"));
    } finally {
      setSaving(false);
    }
  }

  async function applyWorkingHours() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/staff/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromDate: date,
          ...hours,
        }),
      });
      if (!res.ok) throw new Error("apply_failed");
      setMessage(t("applied"));
      await load(date);
    } catch {
      setMessage(t("errors.apply"));
    } finally {
      setSaving(false);
    }
  }

  const appointmentByStart = new Map(appointments.map((a) => [a.start, a]));

  return (
    <div className="grid gap-[clamp(22px,3vw,34px)] lg:grid-cols-[320px_1fr]">
      <aside className="h-fit rounded-[var(--radius)] border border-line-card bg-card p-[clamp(18px,2vw,24px)]">
        <h2 className="font-display text-[26px] font-medium text-ink">
          {t("controls")}
        </h2>
        <div className="mt-[18px] grid gap-[14px]">
          <Field label={t("date")}>
            <DatePicker
              locale={locale}
              value={date}
              onValueChange={(next) => {
                setDate(next);
                void load(next);
              }}
              ariaLabel={t("date")}
              placeholder={t("date")}
              availableDates={pickerDates}
              onMonthChange={loadWorkingDates}
            />
          </Field>
        </div>

        <div className="mt-[24px] border-t border-line-hair pt-[20px]">
          <h3 className="font-sans text-label tracking-[.14em] text-muted uppercase">
            {t("workingHours")}
          </h3>
          <div className="mt-[14px] grid grid-cols-2 gap-[12px]">
            <Field label={t("startHour")}>
              <TimePicker
                value={String(hours.startHour)}
                onValueChange={(next) =>
                  setHours({ ...hours, startHour: Number(next) })
                }
                options={Array.from({ length: 23 }, (_, hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                ariaLabel={t("startHour")}
              />
            </Field>
            <Field label={t("endHour")}>
              <TimePicker
                value={String(hours.endHour)}
                onValueChange={(next) =>
                  setHours({ ...hours, endHour: Number(next) })
                }
                options={Array.from(
                  { length: 24 },
                  (_, index) => index + 1,
                ).map((hour) => ({
                  value: String(hour),
                  label: `${String(hour).padStart(2, "0")}:00`,
                }))}
                ariaLabel={t("endHour")}
              />
            </Field>
            <Field label={t("stepMin")}>
              <ThemedSelect
                value={String(hours.stepMin)}
                onValueChange={(next) =>
                  setHours({ ...hours, stepMin: Number(next) })
                }
                options={[15, 30, 45, 60, 90, 120].map((minutes) => ({
                  value: String(minutes),
                  label: String(minutes),
                }))}
              />
            </Field>
            <Field label={t("daysAhead")}>
              <input
                type="number"
                min={1}
                max={90}
                value={hours.daysAhead}
                onChange={(e) =>
                  setHours({ ...hours, daysAhead: Number(e.target.value) })
                }
                className={inputCls}
              />
            </Field>
          </div>
          <div className="mt-[14px] flex flex-wrap gap-[7px]">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => {
              const active = hours.openDays.includes(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() =>
                    setHours((current) => ({
                      ...current,
                      openDays: active
                        ? current.openDays.filter((d) => d !== day)
                        : [...current.openDays, day],
                    }))
                  }
                  className={cn(
                    "min-h-[40px] rounded-[4px] border px-[10px] font-sans text-label",
                    active
                      ? "border-accent bg-btn-fill text-ink"
                      : "border-line-btn text-muted",
                  )}
                >
                  {t(`days.${day}`)}
                </button>
              );
            })}
          </div>
          <ButtonAction
            type="button"
            onClick={() => void applyWorkingHours()}
            disabled={saving}
            iconRight={CalendarBlank}
            className="mt-[18px] w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("apply")}
          </ButtonAction>
        </div>
      </aside>

      <section className="rounded-[var(--radius)] border border-line-card bg-card p-[clamp(18px,3vw,30px)]">
        <div className="flex flex-wrap items-center justify-between gap-[14px] border-b border-line-hair pb-[18px]">
          <div>
            <h2 className="font-display text-[clamp(26px,3vw,36px)] font-medium text-ink">
              {t("schedule")}
            </h2>
            <p className="mt-[4px] font-sans text-[14px] text-muted">{date}</p>
          </div>
          <div className="flex flex-wrap gap-[10px]">
            <ButtonAction
              type="button"
              variant="outline"
              onClick={() => void load(date)}
              iconRight={ArrowClockwise}
            >
              {t("refresh")}
            </ButtonAction>
            <ButtonAction
              type="button"
              onClick={() => void saveDay()}
              disabled={saving}
              iconRight={FloppyDisk}
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? t("saving") : t("save")}
            </ButtonAction>
          </div>
        </div>

        {message ? (
          <p className="mt-[16px] rounded-[4px] border border-line-btn bg-btn-fill px-[14px] py-[10px] font-sans text-[14px] text-ink">
            {message}
          </p>
        ) : null}

        {loading ? (
          <p className="mt-[22px] font-sans text-[14px] text-muted">
            {t("loading")}
          </p>
        ) : (
          <div className="mt-[22px] grid gap-[10px]">
            {slots.length === 0 ? (
              <p className="font-sans text-[14px] text-muted">{t("noSlots")}</p>
            ) : (
              slots.map((slot, index) => {
                const appointment = appointmentByStart.get(slot.start);
                const booked = slot.status === "booked";
                return (
                  <div
                    key={slot.start}
                    className="grid gap-[12px] rounded-[8px] border border-line-card bg-page p-[14px] md:grid-cols-[120px_1fr_auto]"
                  >
                    <div className="font-sans text-[14px] font-medium text-ink">
                      {timeFmt.format(new Date(slot.start))}–
                      {timeFmt.format(new Date(slot.end))}
                    </div>
                    <div className="font-sans text-[14px] text-body">
                      {booked && appointment ? (
                        <div>
                          <div className="font-medium text-ink">
                            {appointment.clientName}
                          </div>
                          <div>
                            {appointment.procedureTitle ??
                              appointment.serviceSlug}
                            {appointment.procedurePrice
                              ? ` · ${appointment.procedurePrice}`
                              : ""}
                            {` · ${appointment.status}`}
                          </div>
                          <div className="text-muted">
                            {appointment.clientPhone} ·{" "}
                            {appointment.clientEmail}
                          </div>
                          {appointment.notes ? (
                            <div className="mt-[4px] text-muted">
                              {appointment.notes}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        t(`slotStatus.${slot.status}`)
                      )}
                    </div>
                    <div className="flex flex-wrap gap-[8px] md:justify-end">
                      {(["open", "closed"] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={booked}
                          onClick={() => setSlotStatus(index, status)}
                          className={cn(
                            "inline-flex min-h-[40px] items-center gap-[6px] rounded-[4px] border px-[12px] font-sans text-label tracking-[.08em] uppercase",
                            slot.status === status
                              ? "border-accent bg-btn-fill text-ink"
                              : "border-line-btn text-muted hover:border-line-btn-hover hover:text-ink",
                            booked && "cursor-not-allowed opacity-40",
                          )}
                        >
                          {slot.status === status ? (
                            <Check size={13} weight="thin" />
                          ) : null}
                          {t(`slotStatus.${status}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-line-btn bg-page px-[12px] py-[10px] font-sans text-compact text-ink outline-none focus:border-accent";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-sans text-label tracking-[.04em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
