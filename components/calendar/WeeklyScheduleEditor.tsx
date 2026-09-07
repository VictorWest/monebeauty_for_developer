"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { minuteLabel } from "@/lib/clinic-time";
import type { WeeklyIntervals, WorkingMinuteRange } from "@/lib/staff-schedule";

const copy = {
  en: { add: "Add interval", remove: "Remove interval", closed: "Closed" },
  fi: { add: "Lisää aikaväli", remove: "Poista aikaväli", closed: "Suljettu" },
  ru: {
    add: "Добавить интервал",
    remove: "Удалить интервал",
    closed: "Закрыто",
  },
} as const;

function options(from: number, through: number) {
  const values = [];
  for (let minute = from; minute <= through; minute += 15) {
    values.push({ value: String(minute), label: minuteLabel(minute) });
  }
  return values;
}

function weekdayLabel(locale: "en" | "fi" | "ru", weekday: number) {
  // Use a stable Monday-first reference week and UTC solely for weekday labels.
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 6, 5 + weekday)));
}

export function WeeklyScheduleEditor({
  locale,
  value,
  onChange,
}: {
  locale: "en" | "fi" | "ru";
  value: WeeklyIntervals;
  onChange: (next: WeeklyIntervals) => void;
}) {
  const t = copy[locale];
  function setDay(day: number, ranges: WorkingMinuteRange[]) {
    onChange({ ...value, [String(day)]: ranges });
  }
  return (
    <div className="grid gap-3">
      {[1, 2, 3, 4, 5, 6, 0].map((day) => {
        const ranges = value[String(day)] ?? [];
        return (
          <fieldset
            key={day}
            className="rounded-[6px] border border-line-card bg-page p-3"
          >
            <legend className="px-1 font-sans text-[12px] font-semibold text-ink capitalize">
              {weekdayLabel(locale, day)}
            </legend>
            {!ranges.length ? (
              <p className="font-sans text-[12px] text-muted">{t.closed}</p>
            ) : null}
            <div className="grid gap-2">
              {ranges.map((range, index) => (
                <div
                  key={`${range.startMinute}:${range.endMinute}:${index}`}
                  className="grid grid-cols-[1fr_auto_1fr_44px] items-center gap-2"
                >
                  <ThemedSelect
                    value={String(range.startMinute)}
                    onValueChange={(startMinute) =>
                      setDay(
                        day,
                        ranges.map((item, itemIndex) =>
                          itemIndex === index
                            ? {
                                startMinute: Number(startMinute),
                                endMinute: Math.max(
                                  item.endMinute,
                                  Number(startMinute) + 15,
                                ),
                              }
                            : item,
                        ),
                      )
                    }
                    options={options(0, range.endMinute - 15)}
                  />
                  <span aria-hidden className="text-muted">
                    –
                  </span>
                  <ThemedSelect
                    value={String(range.endMinute)}
                    onValueChange={(endMinute) =>
                      setDay(
                        day,
                        ranges.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, endMinute: Number(endMinute) }
                            : item,
                        ),
                      )
                    }
                    options={options(range.startMinute + 15, 1440)}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDay(
                        day,
                        ranges.filter((_, itemIndex) => itemIndex !== index),
                      )
                    }
                    aria-label={t.remove}
                    title={t.remove}
                    className="grid size-11 place-items-center rounded-[4px] border border-line-btn bg-card"
                  >
                    <Minus size={17} />
                  </button>
                </div>
              ))}
            </div>
            {ranges.length < 4 ? (
              <button
                type="button"
                onClick={() => {
                  const previous = ranges.at(-1);
                  const startMinute = previous
                    ? Math.min(previous.endMinute, 22 * 60)
                    : 9 * 60;
                  setDay(day, [
                    ...ranges,
                    {
                      startMinute,
                      endMinute: Math.min(startMinute + 8 * 60, 24 * 60),
                    },
                  ]);
                }}
                className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-line-btn bg-card px-3 font-sans text-[12px]"
              >
                <Plus size={16} />
                {t.add}
              </button>
            ) : null}
          </fieldset>
        );
      })}
    </div>
  );
}
