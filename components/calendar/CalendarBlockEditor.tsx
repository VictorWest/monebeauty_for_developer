"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import {
  clinicDateFromInstant,
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
  clinicWeekday,
} from "@/lib/clinic-time";

export type CalendarBlockTemplate = {
  id: string;
  key: string;
  label: string;
  labels: { fi: string; en: string; ru: string };
  dragLabel: string;
  dragLabels: { fi: string; en: string; ru: string };
  defaultEnabled: boolean;
  defaultDurationMin: number;
  color: string;
  displayOrder: number;
};
export type CalendarBlock = {
  id: string;
  seriesId: string | null;
  version: number;
  start: string;
  end: string;
  notes: string | null;
  roomId: string | null;
  deviceId: string | null;
  practitionerIds: string[];
  items: Array<{
    templateId: string | null;
    durationMin: number;
    label: string;
  }>;
};
type Named = { id: string; name: string };
export type CalendarBlockRangeTarget = {
  date: string;
  practitionerIds: string[];
};

const text = {
  en: {
    title: "Booking info",
    service: "Service",
    additional: "Additional services",
    add: "Add service",
    employee: "User",
    date: "Date",
    start: "Start",
    end: "End",
    resource: "Resource",
    none: "No resource",
    notes: "Booking notes",
    notesPlaceholder: "Add your notes about the booking here…",
    repeat: "Repeat or add to others…",
    until: "End date",
    preview: "occurrences",
    selectedDates: "Selected dates",
    selectedEmployees: "Selected employees",
    save: "Save",
    cancel: "Close",
    cancelBlock: "Cancel block",
    current: "This occurrence",
    future: "This and future occurrences",
    conflict:
      "Nothing was saved. Resolve the highlighted employee/date/resource conflict.",
  },
  fi: {
    title: "Varauksen tiedot",
    service: "Palvelu",
    additional: "Lisäpalvelut",
    add: "Lisää palvelu",
    employee: "Käyttäjä",
    date: "Päivä",
    start: "Alkaa",
    end: "Päättyy",
    resource: "Resurssi",
    none: "Ei resurssia",
    notes: "Varauksen muistiinpanot",
    notesPlaceholder: "Lisää varausta koskevat muistiinpanot tähän…",
    repeat: "Toista tai lisää muille…",
    until: "Päättymispäivä",
    preview: "esiintymää",
    selectedDates: "Valitut päivät",
    selectedEmployees: "Valitut työntekijät",
    save: "Tallenna",
    cancel: "Sulje",
    cancelBlock: "Peru varaus",
    current: "Vain tämä",
    future: "Tämä ja tulevat",
    conflict:
      "Mitään ei tallennettu. Ratkaise työntekijä-/päivä-/resurssiristiriita.",
  },
  ru: {
    title: "Информация о бронировании",
    service: "Услуга",
    additional: "Дополнительные услуги",
    add: "Добавить услугу",
    employee: "Пользователь",
    date: "Дата",
    start: "Начало",
    end: "Окончание",
    resource: "Ресурс",
    none: "Без ресурса",
    notes: "Заметки",
    notesPlaceholder: "Добавьте заметки о бронировании…",
    repeat: "Повторить или добавить другим…",
    until: "Дата окончания",
    preview: "повторений",
    selectedDates: "Выбранные даты",
    selectedEmployees: "Выбранные сотрудники",
    save: "Сохранить",
    cancel: "Закрыть",
    cancelBlock: "Отменить блок",
    current: "Только этот",
    future: "Этот и будущие",
    conflict:
      "Ничего не сохранено. Устраните конфликт сотрудника, даты или ресурса.",
  },
} as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}
function ymd(value: Date) {
  return clinicDateFromInstant(value);
}
function hm(value: Date) {
  return clinicTimeFromInstant(value);
}
function iso(date: string, time: string) {
  return clinicDateTimeToInstant(date, time) ?? new Date(NaN);
}
const timeOptions = Array.from({ length: 96 }, (_, index) => {
  const minutes = index * 15;
  const value = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  return { value, label: value };
});

export function CalendarBlockEditor({
  locale,
  initialStart,
  initialPractitionerId,
  initialDurationMin,
  initialRangeTargets,
  block,
  templates,
  practitioners,
  rooms,
  devices,
  canAssignMany,
  onClose,
  onSaved,
}: {
  locale: "fi" | "en" | "ru";
  initialStart: string;
  initialPractitionerId: string;
  initialDurationMin?: number;
  initialRangeTargets?: CalendarBlockRangeTarget[];
  block?: CalendarBlock | null;
  templates: CalendarBlockTemplate[];
  practitioners: Named[];
  rooms: Named[];
  devices: Named[];
  canAssignMany: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = text[locale];
  const initial = new Date(block?.start ?? initialStart);
  const initialTemplate = block?.items[0]?.templateId ?? templates[0]?.id ?? "";
  const rangeMode = Boolean(initialRangeTargets?.length);
  const [date, setDate] = useState(ymd(initial));
  const [startTime, setStartTime] = useState(hm(initial));
  const [items, setItems] = useState<
    Array<{ templateId: string; durationMin: number }>
  >(
    block?.items.map((item) => ({
      templateId: item.templateId ?? initialTemplate,
      durationMin: item.durationMin,
    })) ?? [
      {
        templateId: initialTemplate,
        durationMin:
          initialDurationMin ??
          templates.find((item) => item.id === initialTemplate)
            ?.defaultDurationMin ??
          60,
      },
    ],
  );
  const [participantIds, setParticipantIds] = useState(
    block?.practitionerIds ??
      (initialRangeTargets?.length
        ? [
            ...new Set(
              initialRangeTargets.flatMap((target) => target.practitionerIds),
            ),
          ]
        : [initialPractitionerId]),
  );
  const [resource, setResource] = useState(
    block?.roomId
      ? `room:${block.roomId}`
      : block?.deviceId
        ? `device:${block.deviceId}`
        : "",
  );
  const [notes, setNotes] = useState(block?.notes ?? "");
  const [repeat, setRepeat] = useState(false);
  const [weekdays, setWeekdays] = useState<number[]>([
    clinicWeekday(date) ?? 1,
  ]);
  const [recurrenceEnd, setRecurrenceEnd] = useState(date);
  const [scope, setScope] = useState<"occurrence" | "future">("occurrence");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const totalMinutes = items.reduce((sum, item) => sum + item.durationMin, 0);
  const computedEnd = new Date(
    iso(date, startTime).getTime() + totalMinutes * 60_000,
  );
  const preview = useMemo(() => {
    if (!repeat) return 1;
    let count = 0;
    const cursor = iso(date, startTime);
    const end = new Date(`${recurrenceEnd}T23:59:59.999Z`);
    while (cursor <= end && count <= 500) {
      if (weekdays.includes(cursor.getUTCDay())) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }, [date, startTime, recurrenceEnd, repeat, weekdays]);

  useEffect(() => {
    closeRef.current?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [onClose]);

  function setTemplate(index: number, templateId: string) {
    const durationMin =
      templates.find((template) => template.id === templateId)
        ?.defaultDurationMin ?? 60;
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { templateId, durationMin } : item,
      ),
    );
  }
  async function save() {
    setSaving(true);
    setError(null);
    const [kind, resourceId] = resource.split(":");
    const payload = {
      version: block?.version,
      scope,
      start: iso(date, startTime).toISOString(),
      items,
      practitionerIds: participantIds,
      roomId: kind === "room" ? resourceId : null,
      deviceId: kind === "device" ? resourceId : null,
      notes,
      weekdays: repeat ? weekdays : [],
      recurrenceEnd: repeat ? `${recurrenceEnd}T23:59:59.999Z` : null,
      ...(rangeMode ? { targets: initialRangeTargets } : {}),
    };
    const response = await fetch(
      block ? `/api/calendar/blocks/${block.id}` : "/api/calendar/blocks",
      {
        method: block ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        detail?: { date?: string; resource?: string };
      } | null;
      setError(
        body?.detail
          ? `${t.conflict} ${body.detail.date ?? ""} ${body.detail.resource ?? ""}`
          : t.conflict,
      );
      return;
    }
    await onSaved();
    onClose();
  }
  async function cancelBlock() {
    if (!block) return;
    setSaving(true);
    const response = await fetch(`/api/calendar/blocks/${block.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version: block.version, scope }),
    });
    setSaving(false);
    if (!response.ok) {
      setError(t.conflict);
      return;
    }
    await onSaved();
    onClose();
  }

  const templateOptions = templates.map((template) => ({
    value: template.id,
    label: template.labels.fi,
  }));
  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/40 p-[10px] sm:items-center"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="block-editor-title"
        className="max-h-[94vh] w-full max-w-[960px] overflow-y-auto rounded-[8px] border border-line-card bg-card shadow-card"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line-hair px-[16px] py-[13px]">
          <h2
            id="block-editor-title"
            className="font-sans text-[18px] font-medium"
          >
            {t.title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="size-11 rounded border border-transparent text-xl hover:border-line-btn"
          >
            ×
          </button>
        </div>
        {error ? (
          <p
            role="alert"
            className="mx-[16px] mt-3 rounded border border-[#c98383] bg-[#fff4f2] p-3 font-sans text-sm"
          >
            {error}
          </p>
        ) : null}
        <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
          <div className="border-b border-line-hair p-[16px] lg:border-r lg:border-b-0">
            {rangeMode ? (
              <div className="rounded border border-line-card bg-page p-3 font-sans text-xs text-body">
                <strong className="block font-medium">{t.selectedDates}</strong>
                <span>
                  {initialRangeTargets?.map((target) => target.date).join(", ")}
                </span>
              </div>
            ) : (
              <label className="font-sans text-xs font-medium text-body">
                {t.date}
                <DatePicker
                  locale={locale}
                  value={date}
                  onValueChange={setDate}
                  ariaLabel={t.date}
                  className="mt-1 w-full"
                />
              </label>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <label className="font-sans text-xs font-medium text-body">
                {t.start}
                <ThemedSelect
                  value={startTime}
                  onValueChange={setStartTime}
                  options={timeOptions}
                  className="mt-1"
                />
              </label>
              <label className="font-sans text-xs font-medium text-body">
                {t.end}
                <ThemedSelect
                  value={hm(computedEnd)}
                  onValueChange={(value) => {
                    const desired = iso(date, value);
                    if (desired <= iso(date, startTime))
                      desired.setUTCDate(desired.getUTCDate() + 1);
                    const prior = items
                      .slice(0, -1)
                      .reduce((sum, item) => sum + item.durationMin, 0);
                    const final =
                      Math.round(
                        (desired.getTime() - iso(date, startTime).getTime()) /
                          60_000,
                      ) - prior;
                    if (final >= 15)
                      setItems((current) =>
                        current.map((item, index) =>
                          index === current.length - 1
                            ? { ...item, durationMin: final }
                            : item,
                        ),
                      );
                  }}
                  options={timeOptions}
                  className="mt-1"
                />
              </label>
            </div>
            <label className="mt-4 block font-sans text-xs font-medium text-body">
              {t.service}
              <ThemedSelect
                value={items[0]?.templateId ?? ""}
                onValueChange={(value) => setTemplate(0, value)}
                options={templateOptions}
                className="mt-1"
              />
            </label>
            <fieldset className="mt-4">
              <legend className="font-sans text-xs font-medium text-body">
                {t.additional}
              </legend>
              <div className="mt-1 grid gap-2">
                {items.slice(1).map((item, offset) => (
                  <div key={offset} className="grid grid-cols-[1fr_40px] gap-2">
                    <ThemedSelect
                      value={item.templateId}
                      onValueChange={(value) => setTemplate(offset + 1, value)}
                      options={templateOptions}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((_, index) => index !== offset + 1),
                        )
                      }
                      className="min-h-11 rounded border border-line-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <ThemedSelect
                value=""
                placeholder={t.add}
                onValueChange={(value) => {
                  const template = templates.find(
                    (entry) => entry.id === value,
                  );
                  if (template)
                    setItems((current) => [
                      ...current,
                      {
                        templateId: template.id,
                        durationMin: template.defaultDurationMin,
                      },
                    ]);
                }}
                options={templateOptions}
                className="mt-2"
              />
            </fieldset>
            {rangeMode ? (
              <div className="mt-4 rounded border border-line-card bg-page p-3 font-sans text-xs text-body">
                <strong className="block font-medium">
                  {t.selectedEmployees}
                </strong>
                <span>
                  {practitioners
                    .filter((person) => participantIds.includes(person.id))
                    .map((person) => person.name)
                    .join(", ")}
                </span>
              </div>
            ) : (
              <label className="mt-4 block font-sans text-xs font-medium text-body">
                {t.employee}
                <ThemedSelect
                  value={participantIds[0] ?? ""}
                  disabled={!canAssignMany}
                  onValueChange={(value) =>
                    setParticipantIds((current) => [
                      value,
                      ...current.slice(1).filter((id) => id !== value),
                    ])
                  }
                  options={practitioners.map((person) => ({
                    value: person.id,
                    label: person.name,
                  }))}
                  className="mt-1"
                />
              </label>
            )}
            <label className="mt-4 block font-sans text-xs font-medium text-body">
              {t.resource}
              <ThemedSelect
                value={resource}
                onValueChange={setResource}
                className="mt-1"
                options={[
                  { value: "", label: t.none },
                  ...rooms.map((room) => ({
                    value: `room:${room.id}`,
                    label: room.name,
                  })),
                  ...devices.map((device) => ({
                    value: `device:${device.id}`,
                    label: device.name,
                  })),
                ]}
              />
            </label>
            {!block && !rangeMode ? (
              <fieldset className="mt-4 rounded border border-line-card bg-page p-3">
                <label className="flex min-h-10 items-center gap-2 font-sans text-sm">
                  <input
                    type="checkbox"
                    checked={repeat}
                    onChange={(event) => setRepeat(event.target.checked)}
                    className="size-4 accent-accent"
                  />
                  {t.repeat}
                </label>
                {repeat ? (
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                        <label
                          key={day}
                          className="flex items-center gap-1 text-sm"
                        >
                          <input
                            type="checkbox"
                            checked={weekdays.includes(day)}
                            onChange={() =>
                              setWeekdays((current) =>
                                current.includes(day)
                                  ? current.filter((value) => value !== day)
                                  : [...current, day],
                              )
                            }
                          />
                          {new Intl.DateTimeFormat(locale, {
                            weekday: "short",
                            timeZone: "UTC",
                          }).format(new Date(Date.UTC(2026, 6, 6 + day)))}
                        </label>
                      ))}
                    </div>
                    {canAssignMany ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {practitioners.map((person) => (
                          <label
                            key={person.id}
                            className="flex items-center gap-1 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={participantIds.includes(person.id)}
                              onChange={() =>
                                setParticipantIds((current) =>
                                  current.includes(person.id)
                                    ? current.filter((id) => id !== person.id)
                                    : [...current, person.id],
                                )
                              }
                            />
                            {person.name}
                          </label>
                        ))}
                      </div>
                    ) : null}
                    <label className="mt-3 block font-sans text-xs font-medium text-body">
                      {t.until}
                      <DatePicker
                        locale={locale}
                        value={recurrenceEnd}
                        onValueChange={setRecurrenceEnd}
                        ariaLabel={t.until}
                        className="mt-1 w-full"
                      />
                    </label>
                    <p className="mt-2 font-sans text-sm">
                      {preview} {t.preview}
                      {preview > 500 ? " · max 500" : ""}
                    </p>
                  </div>
                ) : null}
              </fieldset>
            ) : block?.seriesId ? (
              <div className="mt-4 flex gap-3">
                {(["occurrence", "future"] as const).map((value) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="radio"
                      checked={scope === value}
                      onChange={() => setScope(value)}
                    />
                    {value === "occurrence" ? t.current : t.future}
                  </label>
                ))}
              </div>
            ) : null}
          </div>
          <label className="block min-h-[300px] p-[16px] font-sans text-xs font-medium text-body">
            {t.notes}
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder={t.notesPlaceholder}
              rows={9}
              className="mt-2 w-full rounded border border-line-btn bg-page p-3 font-sans text-sm"
            />
          </label>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line-hair px-[16px] py-[13px]">
          {block ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void cancelBlock()}
              className="min-h-11 rounded border border-[#c98383] px-4 text-[#8c3434]"
            >
              {t.cancelBlock}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded border border-line-btn px-4"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={saving || !participantIds.length || preview > 500}
            onClick={() => void save()}
            className="min-h-11 rounded bg-accent px-5 text-page disabled:opacity-40"
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
