"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Plus, Trash } from "@phosphor-icons/react";
import { WeeklyScheduleEditor } from "@/components/calendar/WeeklyScheduleEditor";
import type { WeeklyIntervals } from "@/lib/staff-schedule";
import {
  clinicDateMinuteToInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

type Capability = { serviceId: string; roomId: string; deviceIds: string[] };
type Pool = {
  id: string;
  slug: string;
  name: string;
  requiresDevice: boolean;
  rooms: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string }>;
  options: Array<{ id: string; name: string; effectiveServiceId: string }>;
};
type Configuration = {
  version: number;
  account: { name: string; email: string; status: string };
  profile: {
    professionalTitle: string;
    calendarColor: string;
    active: boolean;
    displayOrder: number;
  };
  schedule: {
    weekly: { intervals: WeeklyIntervals };
    exceptions: Array<{
      date: string;
      slots: Array<{ start: string; end: string; status: string }>;
    }>;
  };
  capabilities: Capability[];
  qualifiedOptionIds: string[];
  resourcePools: Pool[];
};

const words = {
  en: {
    heading: "Employee configuration",
    account: "Account",
    security: "Access & security",
    profile: "Profile",
    schedule: "Schedule",
    capabilities: "Booking capabilities",
    qualifications: "Qualified procedures",
    name: "Name",
    email: "Login email",
    current: "Current password",
    password: "New password",
    title: "Professional title",
    color: "Calendar color",
    weekly: "Weekly working hours",
    exceptions: "Date exceptions",
    addException: "Add exception",
    date: "Date (YYYY-MM-DD)",
    start: "Start (HH:MM)",
    end: "End (HH:MM)",
    remove: "Remove",
    room: "Room",
    devices: "Permitted devices",
    save: "Save changes",
    saved: "Changes are active.",
    conflict: "This configuration changed elsewhere. Reload and try again.",
    future:
      "A future appointment depends on this setting. Reassign or cancel it first.",
    error: "Could not save configuration.",
    loading: "Loading configuration…",
    adminOnly:
      "Use Staff accounts to manage access, activation, and allocation order.",
  },
  fi: {
    heading: "Työntekijän asetukset",
    account: "Tili",
    security: "Käyttöoikeudet ja turvallisuus",
    profile: "Profiili",
    schedule: "Työajat",
    capabilities: "Ajanvarausoikeudet",
    qualifications: "Toimenpidepätevyydet",
    name: "Nimi",
    email: "Kirjautumissähköposti",
    current: "Nykyinen salasana",
    password: "Uusi salasana",
    title: "Ammattinimike",
    color: "Kalenteriväri",
    weekly: "Viikoittaiset työajat",
    exceptions: "Päiväkohtaiset poikkeukset",
    addException: "Lisää poikkeus",
    date: "Päivä (VVVV-KK-PP)",
    start: "Alkaa (TT:MM)",
    end: "Päättyy (TT:MM)",
    remove: "Poista",
    room: "Huone",
    devices: "Sallitut laitteet",
    save: "Tallenna muutokset",
    saved: "Muutokset ovat voimassa.",
    conflict: "Asetuksia muutettiin muualla. Lataa sivu ja yritä uudelleen.",
    future:
      "Tuleva ajanvaraus tarvitsee tätä asetusta. Siirrä tai peruuta varaus ensin.",
    error: "Asetuksia ei voitu tallentaa.",
    loading: "Asetuksia ladataan…",
    adminOnly:
      "Hallitse käyttöoikeutta, aktivointia ja varausjärjestystä Henkilöstötilit-osiossa.",
  },
  ru: {
    heading: "Настройки сотрудника",
    account: "Учётная запись",
    security: "Доступ и безопасность",
    profile: "Профиль",
    schedule: "Расписание",
    capabilities: "Возможности записи",
    qualifications: "Допуск к процедурам",
    name: "Имя",
    email: "Email для входа",
    current: "Текущий пароль",
    password: "Новый пароль",
    title: "Должность",
    color: "Цвет календаря",
    weekly: "Еженедельные часы",
    exceptions: "Исключения по датам",
    addException: "Добавить исключение",
    date: "Дата (ГГГГ-ММ-ДД)",
    start: "Начало (ЧЧ:ММ)",
    end: "Конец (ЧЧ:ММ)",
    remove: "Удалить",
    room: "Кабинет",
    devices: "Разрешённые аппараты",
    save: "Сохранить",
    saved: "Изменения вступили в силу.",
    conflict: "Настройки уже изменены. Перезагрузите страницу и повторите.",
    future:
      "Будущая запись зависит от этой настройки. Сначала переназначьте или отмените её.",
    error: "Не удалось сохранить настройки.",
    loading: "Загрузка настроек…",
    adminOnly:
      "Управляйте доступом, активацией и порядком распределения в разделе сотрудников.",
  },
} as const;

const input =
  "min-h-11 w-full rounded-[4px] border border-line-btn bg-page px-3 font-sans text-[14px] outline-none focus:border-accent";
const panel =
  "rounded-[8px] border border-line-card bg-card p-[clamp(14px,3vw,22px)]";

function timeFromIso(value: string) {
  return clinicTimeFromInstant(new Date(value));
}

function exceptionSlots(date: string, start: string, end: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(start) ||
    !/^\d{2}:\d{2}$/.test(end)
  )
    return [];
  const startMinute = Number(start.slice(0, 2)) * 60 + Number(start.slice(3));
  const endMinute = Number(end.slice(0, 2)) * 60 + Number(end.slice(3));
  const from = clinicDateMinuteToInstant(date, startMinute);
  const until = clinicDateMinuteToInstant(date, endMinute);
  if (!from || !until || until <= from) return [];
  const slots = [];
  for (
    let cursor = from;
    cursor < until;
    cursor = new Date(cursor.getTime() + 15 * 60_000)
  ) {
    slots.push({
      start: cursor.toISOString(),
      end: new Date(cursor.getTime() + 15 * 60_000).toISOString(),
      status: "open",
    });
  }
  return slots;
}

export function EmployeeConfiguration({
  locale,
  endpoint,
  admin = false,
  securityContent,
  loginHref,
}: {
  locale: "en" | "fi" | "ru";
  endpoint: string;
  admin?: boolean;
  securityContent?: ReactNode;
  loginHref?: string;
}) {
  const t = words[locale];
  const [data, setData] = useState<Configuration | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const localizedEndpoint = `${endpoint}${endpoint.includes("?") ? "&" : "?"}locale=${locale}`;
  const load = useCallback(async () => {
    const response = await fetch(localizedEndpoint, { cache: "no-store" });
    if (response.ok) setData((await response.json()) as Configuration);
  }, [localizedEndpoint]);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!data)
    return <p className="font-sans text-[14px] text-muted">{t.loading}</p>;
  const updateCapability = (
    serviceId: string,
    roomId: string,
    checked: boolean,
  ) => {
    setData(
      (current) =>
        current && {
          ...current,
          capabilities: checked
            ? [...current.capabilities, { serviceId, roomId, deviceIds: [] }]
            : current.capabilities.filter(
                (item) =>
                  item.serviceId !== serviceId || item.roomId !== roomId,
              ),
        },
    );
  };

  async function save() {
    setSaving(true);
    setMessage("");
    const response = await fetch(localizedEndpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version: data!.version,
        account: {
          name: data!.account.name,
          email: data!.account.email,
          currentPassword,
          ...(newPassword ? { newPassword } : {}),
        },
        profile: {
          professionalTitle: data!.profile.professionalTitle,
          calendarColor: data!.profile.calendarColor,
          ...(admin
            ? {
                active: data!.profile.active,
                displayOrder: data!.profile.displayOrder,
              }
            : {}),
        },
        schedule: {
          weekly: { intervals: data!.schedule.weekly.intervals },
          exceptions: data!.schedule.exceptions,
        },
        capabilities: data!.capabilities,
        qualifiedOptionIds: data!.qualifiedOptionIds,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setMessage(
        payload.error === "version_conflict"
          ? t.conflict
          : payload.error === "future_appointments"
            ? `${t.future} (${payload.detail?.affected ?? 0})`
            : t.error,
      );
      return;
    }
    setData(payload as Configuration);
    setCurrentPassword("");
    setNewPassword("");
    setMessage(t.saved);
    if (payload.requiresLogin && !admin)
      window.location.assign(
        loginHref ??
          `${locale === "fi" ? "" : `/${locale}`}/henkilosto/kirjaudu`,
      );
  }

  return (
    <section
      className="grid gap-4"
      aria-labelledby="employee-configuration-heading"
    >
      <h2
        id="employee-configuration-heading"
        className="font-display text-[30px] font-medium"
      >
        {t.heading}
      </h2>
      <p className="font-sans text-[13px] text-muted">{t.adminOnly}</p>
      <div className={panel}>
        <h3 className="font-display text-[24px] font-medium">{t.account}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label={t.name}>
            <input
              className={input}
              value={data.account.name}
              onChange={(e) =>
                setData({
                  ...data,
                  account: { ...data.account, name: e.target.value },
                })
              }
            />
          </Field>
          <Field label={t.email}>
            <input
              className={input}
              type="email"
              value={data.account.email}
              onChange={(e) =>
                setData({
                  ...data,
                  account: { ...data.account, email: e.target.value },
                })
              }
            />
          </Field>
          {!admin ? (
            <>
              <Field label={t.current}>
                <input
                  className={input}
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </Field>
              <Field label={t.password}>
                <input
                  className={input}
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
            </>
          ) : null}
        </div>
      </div>
      {admin && securityContent ? (
        <div className={panel}>
          <h3 className="font-display text-[24px] font-medium">{t.security}</h3>
          {securityContent}
        </div>
      ) : null}
      <div className={panel}>
        <h3 className="font-display text-[24px] font-medium">{t.profile}</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_120px]">
          <Field label={t.title}>
            <input
              className={input}
              value={data.profile.professionalTitle}
              onChange={(e) =>
                setData({
                  ...data,
                  profile: {
                    ...data.profile,
                    professionalTitle: e.target.value,
                  },
                })
              }
            />
          </Field>
          <Field label={t.color}>
            <input
              className="h-11 w-full rounded border border-line-btn bg-page p-1"
              type="color"
              value={data.profile.calendarColor}
              onChange={(e) =>
                setData({
                  ...data,
                  profile: { ...data.profile, calendarColor: e.target.value },
                })
              }
            />
          </Field>
        </div>
        {admin ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Allocation / display order">
              <input
                className={input}
                type="number"
                value={data.profile.displayOrder}
                onChange={(e) =>
                  setData({
                    ...data,
                    profile: {
                      ...data.profile,
                      displayOrder: Number(e.target.value),
                    },
                  })
                }
              />
            </Field>
            <label className="flex min-h-11 items-center gap-2 self-end text-[13px]">
              <input
                type="checkbox"
                checked={data.profile.active}
                onChange={(e) =>
                  setData({
                    ...data,
                    profile: { ...data.profile, active: e.target.checked },
                  })
                }
              />
              Active calendar employee
            </label>
          </div>
        ) : null}
      </div>
      <div className={panel}>
        <h3 className="font-display text-[24px] font-medium">{t.schedule}</h3>
        <h4 className="my-3 font-sans text-[13px] font-semibold">{t.weekly}</h4>
        <WeeklyScheduleEditor
          locale={locale}
          value={data.schedule.weekly.intervals}
          onChange={(intervals) =>
            setData({
              ...data,
              schedule: {
                ...data.schedule,
                weekly: { ...data.schedule.weekly, intervals },
              },
            })
          }
        />
        <div className="mt-5 flex items-center justify-between">
          <h4 className="font-sans text-[13px] font-semibold">
            {t.exceptions}
          </h4>
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-2 rounded border border-line-btn px-3 text-[12px]"
            onClick={() =>
              setData({
                ...data,
                schedule: {
                  ...data.schedule,
                  exceptions: [
                    ...data.schedule.exceptions,
                    { date: "", slots: [] },
                  ],
                },
              })
            }
          >
            <Plus size={16} />
            {t.addException}
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {data.schedule.exceptions.map((item, index) => {
            const start = item.slots[0]
              ? timeFromIso(item.slots[0].start)
              : "09:00";
            const end = item.slots.at(-1)
              ? timeFromIso(item.slots.at(-1)!.end)
              : "17:00";
            const change = (date: string, from: string, until: string) =>
              setData({
                ...data,
                schedule: {
                  ...data.schedule,
                  exceptions: data.schedule.exceptions.map((row, i) =>
                    i === index
                      ? { date, slots: exceptionSlots(date, from, until) }
                      : row,
                  ),
                },
              });
            return (
              <div
                key={`${item.date}:${index}`}
                className="grid gap-2 rounded border border-line-card p-2 sm:grid-cols-[1fr_110px_110px_44px]"
              >
                <input
                  aria-label={t.date}
                  placeholder="2026-08-01"
                  className={input}
                  value={item.date}
                  onChange={(e) => change(e.target.value, start, end)}
                />
                <input
                  aria-label={t.start}
                  placeholder="09:00"
                  className={input}
                  value={start}
                  onChange={(e) => change(item.date, e.target.value, end)}
                />
                <input
                  aria-label={t.end}
                  placeholder="17:00"
                  className={input}
                  value={end}
                  onChange={(e) => change(item.date, start, e.target.value)}
                />
                <button
                  type="button"
                  aria-label={t.remove}
                  title={t.remove}
                  className="grid size-11 place-items-center rounded border border-line-btn"
                  onClick={() =>
                    setData({
                      ...data,
                      schedule: {
                        ...data.schedule,
                        exceptions: data.schedule.exceptions.filter(
                          (_, i) => i !== index,
                        ),
                      },
                    })
                  }
                >
                  <Trash size={17} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <div className={panel}>
        <h3 className="font-display text-[24px] font-medium">
          {t.capabilities}
        </h3>
        <div className="mt-3 grid gap-3">
          {data.resourcePools.map((service) => (
            <fieldset
              key={service.id}
              className="rounded border border-line-card p-3"
            >
              <legend className="px-1 font-sans text-[13px] font-semibold">
                {service.name}
              </legend>
              {service.rooms.map((room) => {
                const capability = data.capabilities.find(
                  (item) =>
                    item.serviceId === service.id && item.roomId === room.id,
                );
                return (
                  <div
                    key={room.id}
                    className="border-t border-line-card py-2 first:border-0"
                  >
                    <label className="flex min-h-11 items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        className="size-4 accent-accent"
                        checked={Boolean(capability)}
                        onChange={(event) =>
                          updateCapability(
                            service.id,
                            room.id,
                            event.target.checked,
                          )
                        }
                      />
                      {t.room}: {room.name}
                    </label>
                    {capability && service.devices.length ? (
                      <div className="ml-6 flex flex-wrap gap-x-4">
                        <span className="w-full text-[11px] text-muted">
                          {t.devices}
                        </span>
                        {service.devices.map((device) => (
                          <label
                            key={device.id}
                            className="flex min-h-10 items-center gap-2 text-[12px]"
                          >
                            <input
                              type="checkbox"
                              checked={capability.deviceIds.includes(device.id)}
                              onChange={(event) =>
                                setData({
                                  ...data,
                                  capabilities: data.capabilities.map((item) =>
                                    item !== capability
                                      ? item
                                      : {
                                          ...item,
                                          deviceIds: event.target.checked
                                            ? [...item.deviceIds, device.id]
                                            : item.deviceIds.filter(
                                                (id) => id !== device.id,
                                              ),
                                        },
                                  ),
                                })
                              }
                            />
                            {device.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {service.options.length ? (
                <div className="mt-3 border-t border-line-card pt-3">
                  <p className="text-[11px] font-semibold tracking-[.06em] text-muted uppercase">
                    {t.qualifications}
                  </p>
                  <div className="mt-1 grid gap-1 sm:grid-cols-2">
                    {service.options.map((option) => {
                      const hasCapability = data.capabilities.some(
                        (item) => item.serviceId === option.effectiveServiceId,
                      );
                      return (
                        <label
                          key={option.id}
                          className="flex min-h-10 items-center gap-2 text-[12px]"
                        >
                          <input
                            type="checkbox"
                            disabled={!hasCapability}
                            checked={data.qualifiedOptionIds.includes(
                              option.id,
                            )}
                            onChange={(event) =>
                              setData({
                                ...data,
                                qualifiedOptionIds: event.target.checked
                                  ? [...data.qualifiedOptionIds, option.id]
                                  : data.qualifiedOptionIds.filter(
                                      (id) => id !== option.id,
                                    ),
                              })
                            }
                            className="size-4 accent-accent disabled:opacity-40"
                          />
                          {option.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </fieldset>
          ))}
        </div>
      </div>
      {message ? (
        <p
          role="status"
          className="rounded border border-line-btn bg-btn-fill p-3 text-[13px]"
        >
          {message}
        </p>
      ) : null}
      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="min-h-12 rounded-[4px] bg-accent px-5 font-sans text-[12px] font-semibold tracking-[.08em] text-page uppercase disabled:opacity-50"
      >
        {t.save}
      </button>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block font-sans text-[12px] text-body">
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  );
}
