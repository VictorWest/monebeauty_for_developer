"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  ArrowClockwise,
  CaretLeft,
  CaretRight,
  GearSix,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  Minus,
  Plus,
} from "@phosphor-icons/react";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import { TimePicker } from "@/components/ui/TimePicker";
import { cn } from "@/lib/cn";
import {
  availabilityCovers,
  openSlotRange,
  parseWorkingHours,
  workingRangeForDate,
  type WeeklyIntervals,
} from "@/lib/staff-schedule";
import { WeeklyScheduleEditor } from "@/components/calendar/WeeklyScheduleEditor";
import {
  AppointmentForm,
  type AppointmentDetail as ManageAppointmentDetail,
} from "@/components/calendar/AppointmentForm";
import {
  CalendarBlockEditor,
  type CalendarBlock,
  type CalendarBlockTemplate,
} from "@/components/calendar/CalendarBlockEditor";
import { InternalServicePaletteEditor } from "@/components/calendar/InternalServicePaletteEditor";
import {
  calendarDropStart,
  normalizeEmployeeSelection,
  normalizeInternalPalette,
  type InternalPalettePreference,
} from "@/lib/calendar-preferences";
import {
  calendarRangeContains,
  calendarRangeStart,
  normalizeCalendarRange,
  type CalendarRangeCell,
  type CalendarRangeSelection,
} from "@/lib/calendar-range-selection";
import { clinicTodayYmd } from "@/lib/clinic-date";
import {
  CLINIC_TIME_ZONE,
  clinicDateFromInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

type View = "day" | "week" | "month";
const VIEW_STORAGE_KEYS = {
  admin: "mone-calendar-view:admin",
  staff: "mone-calendar-view:staff",
} as const;
type Practitioner = {
  id: string;
  name: string;
  role: string;
  calendarColor: string;
  workingHours: unknown;
};
type Resource = { id: string; name: string; active: boolean };
type Appointment = {
  id: string;
  version: number;
  practitionerId: string;
  start: string;
  end: string;
  reservedUntil: string | null;
  bufferMinutes: number;
  status: string;
  channel: string | null;
  channelLabel: string | null;
  clientName: string;
  procedure: string;
  room: Resource | null;
  device: Resource | null;
  roomId: string | null;
  deviceId: string | null;
  resourceWarning: string[];
  qualifiedPractitionerIds: string[];
  allowedRoomIds: string[];
  allowedDeviceIds: string[];
  capabilities: Array<{
    practitionerId: string;
    roomId: string;
    deviceIds: string[];
  }>;
  requiresDevice: boolean;
  editable: boolean;
  /** Set only when this appointment is one leg of a multi-procedure visit
   * (several appointments booked together, one specialist, back-to-back). */
  bookingGroupId: string | null;
  bookingGroupIndex: number | null;
  bookingGroupCount: number | null;
};
type Slot = { start: string; end: string; status: string };
type Payload = {
  viewerId: string;
  practitioners: Practitioner[];
  rooms: Resource[];
  devices: Resource[];
  ownPractitionerId: string | null;
  canManageAppointments: boolean;
  canEditAllAvailability: boolean;
  canEditOwnAvailability: boolean;
  canManageTemplates: boolean;
  availabilities: Array<{
    practitionerId: string;
    date: string;
    slots: Slot[];
  }>;
  appointments: Appointment[];
  templates: CalendarBlockTemplate[];
  blocks: CalendarBlock[];
};
type AppointmentDetail = {
  id: string;
  client: {
    fullName: string;
    email: string;
    phone: string;
    contraindications: string | null;
  };
  procedure: string;
  start: string;
  end: string;
  notes: string | null;
  room: string | null;
  device: string | null;
};

const ZOOM_HEIGHTS = { compact: 36, default: 48, expanded: 68 } as const;
const TIME_GRID_EDGE_PADDING = 12;
type Zoom = keyof typeof ZOOM_HEIGHTS;
type WorkdayEditor = {
  mode: "add" | "remove";
  practitionerId: string;
  date: string;
  startMinute: number;
  endMinute: number;
};

const copy = {
  en: {
    title: "Shared calendar",
    day: "Day",
    week: "Week",
    month: "Month",
    today: "Today",
    all: "All",
    refresh: "Refresh",
    setup: "Calendar setup",
    hours: "Working hours",
    addWorkday: "Add workday",
    removeWorkday: "Remove workday",
    add: "Add",
    remove: "Remove",
    date: "Date",
    workdayHours: "Working hours",
    workdayAdded: "Workday added.",
    workdayRemoved: "Workday removed.",
    workdayConflict:
      "Move or cancel the employee's appointments before changing this workday.",
    workdayInvalid: "The workday could not be saved. Check the date and hours.",
    applyHours: "Apply hours",
    startHour: "Start",
    endHour: "End",
    daysAhead: "Days ahead",
    loading: "Loading calendar…",
    empty: "No appointments",
    confirm: "Confirm calendar change",
    save: "Save and notify",
    cancel: "Cancel",
    employee: "Employee",
    room: "Room",
    device: "Device",
    time: "Time",
    conflict:
      "The appointment could not be moved. Refresh and try another time or resource.",
    saved: "Appointment updated.",
    create: "Create appointment",
    noWorkingHours: "No working hours",
    outsideHours: "Outside working hours",
    internal: "Internal services",
    editInternal: "Edit",
    working: "Working",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },
  fi: {
    title: "Yhteinen kalenteri",
    day: "Päivä",
    week: "Viikko",
    month: "Kuukausi",
    today: "Tänään",
    all: "Kaikki",
    refresh: "Päivitä",
    setup: "Kalenterin asetukset",
    hours: "Työajat",
    addWorkday: "Lisää työpäivä",
    removeWorkday: "Poista työpäivä",
    add: "Lisää",
    remove: "Poista",
    date: "Päivä",
    workdayHours: "Työaika",
    workdayAdded: "Työpäivä lisätty.",
    workdayRemoved: "Työpäivä poistettu.",
    workdayConflict:
      "Siirrä tai peru työntekijän ajanvaraukset ennen työpäivän muuttamista.",
    workdayInvalid: "Työpäivää ei voitu tallentaa. Tarkista päivä ja työaika.",
    applyHours: "Käytä työaikoja",
    startHour: "Alkaa",
    endHour: "Päättyy",
    daysAhead: "Päiviä",
    loading: "Kalenteria ladataan…",
    empty: "Ei ajanvarauksia",
    confirm: "Vahvista kalenterimuutos",
    save: "Tallenna ja ilmoita",
    cancel: "Peruuta",
    employee: "Työntekijä",
    room: "Huone",
    device: "Laite",
    time: "Aika",
    conflict:
      "Ajanvarausta ei voitu siirtää. Päivitä ja valitse toinen aika tai resurssi.",
    saved: "Ajanvaraus päivitetty.",
    create: "Luo ajanvaraus",
    noWorkingHours: "Ei työaikaa",
    outsideHours: "Työajan ulkopuolella",
    internal: "Sisäiset palvelut",
    editInternal: "Muokkaa",
    working: "Työssä",
    zoomIn: "Lähennä",
    zoomOut: "Loitonna",
  },
  ru: {
    title: "Общий календарь",
    day: "День",
    week: "Неделя",
    month: "Месяц",
    today: "Сегодня",
    all: "Все",
    refresh: "Обновить",
    setup: "Настройки календаря",
    hours: "Рабочее время",
    addWorkday: "Добавить рабочий день",
    removeWorkday: "Удалить рабочий день",
    add: "Добавить",
    remove: "Удалить",
    date: "Дата",
    workdayHours: "Рабочее время",
    workdayAdded: "Рабочий день добавлен.",
    workdayRemoved: "Рабочий день удалён.",
    workdayConflict:
      "Перенесите или отмените записи сотрудника перед изменением рабочего дня.",
    workdayInvalid:
      "Не удалось сохранить рабочий день. Проверьте дату и время.",
    applyHours: "Применить часы",
    startHour: "Начало",
    endHour: "Конец",
    daysAhead: "Дней",
    loading: "Загрузка календаря…",
    empty: "Нет записей",
    confirm: "Подтвердить изменение",
    save: "Сохранить и уведомить",
    cancel: "Отмена",
    employee: "Сотрудник",
    room: "Кабинет",
    device: "Аппарат",
    time: "Время",
    conflict:
      "Не удалось перенести запись. Обновите календарь и выберите другое время или ресурс.",
    saved: "Запись обновлена.",
    create: "Создать запись",
    noWorkingHours: "Нет рабочих часов",
    outsideHours: "Вне рабочего времени",
    internal: "Внутренние услуги",
    editInternal: "Изменить",
    working: "Работают",
    zoomIn: "Увеличить",
    zoomOut: "Уменьшить",
  },
} as const;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function ymd(date: Date) {
  return clinicDateFromInstant(date);
}

function clinicMinute(date: Date) {
  const label = clinicTimeFromInstant(date);
  return Number(label.slice(0, 2)) * 60 + Number(label.slice(3));
}

function today() {
  const now = new Date();
  return ymd(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
}

function dateFromYmd(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function addDays(value: string, amount: number) {
  const date = dateFromYmd(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return ymd(date);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function rangeFor(value: string, view: View) {
  const selected = dateFromYmd(value);
  if (view === "day")
    return { from: selected, to: new Date(selected.getTime() + 86400000) };
  if (view === "week") {
    const mondayOffset = (selected.getUTCDay() + 6) % 7;
    const from = new Date(selected);
    from.setUTCDate(from.getUTCDate() - mondayOffset);
    return { from, to: new Date(from.getTime() + 7 * 86400000) };
  }
  const from = new Date(
    Date.UTC(selected.getUTCFullYear(), selected.getUTCMonth(), 1),
  );
  const offset = (from.getUTCDay() + 6) % 7;
  from.setUTCDate(from.getUTCDate() - offset);
  return { from, to: new Date(from.getTime() + 42 * 86400000) };
}

function validView(value: string | null): value is View {
  return value === "day" || value === "week" || value === "month";
}

export function SharedCalendar({
  locale,
  setupHref,
}: {
  locale: "en" | "fi" | "ru";
  setupHref?: string;
}) {
  const t = copy[locale];
  const [date, setDate] = useState(today());
  const [view, setView] = useState<View>("day");
  const [viewReady, setViewReady] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palette, setPalette] = useState<InternalPalettePreference[]>(() =>
    normalizeInternalPalette(null),
  );
  const [blockEditing, setBlockEditing] = useState<{
    start: string;
    practitionerId: string;
    block?: CalendarBlock | null;
    durationMin?: number;
  } | null>(null);
  const [zoom, setZoom] = useState<Zoom>("default");
  const [pickerDates, setPickerDates] = useState<string[] | undefined>();
  const [editing, setEditing] = useState<{
    appointment: Appointment;
    start: string;
    practitionerId: string;
    roomId: string;
    deviceId: string;
  } | null>(null);
  const [hoursOpen, setHoursOpen] = useState(false);
  const [workdayEditor, setWorkdayEditor] = useState<WorkdayEditor | null>(
    null,
  );
  const [workdaySaving, setWorkdaySaving] = useState(false);
  const [detail, setDetail] = useState<AppointmentDetail | null>(null);
  const [managing, setManaging] = useState<{
    start: string;
    practitionerId: string;
    durationMin?: number;
    detail?: ManageAppointmentDetail | null;
  } | null>(null);
  const [rangeSelection, setRangeSelection] =
    useState<CalendarRangeSelection | null>(null);
  const [hours, setHours] = useState({
    practitionerId: "",
    daysAhead: 30,
    intervals: parseWorkingHours(undefined).intervals as WeeklyIntervals,
  });
  const selectionOwnerRef = useRef<string | null>(null);
  const paletteOwnerRef = useRef<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const viewStorageKey = setupHref
    ? VIEW_STORAGE_KEYS.admin
    : VIEW_STORAGE_KEYS.staff;
  const range = useMemo(() => rangeFor(date, view), [date, view]);

  const visibleTemplates = useMemo(
    () =>
      palette.flatMap((preference) => {
        if (!preference.enabled) return [];
        const template = data?.templates.find(
          (item) => item.key === preference.key,
        );
        return template
          ? [{ template, alias: preference.aliases[locale] }]
          : [];
      }),
    [data?.templates, locale, palette],
  );
  const paletteCatalog = useMemo(
    () =>
      data?.templates.map((template) => ({
        key: template.key,
        dragLabels: template.dragLabels,
        defaultEnabled: template.defaultEnabled,
      })) ?? [],
    [data?.templates],
  );
  const activeTemplate = visibleTemplates.find(
    ({ template }) => template.id === activeTemplateId,
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let stored: string | null = null;
      try {
        stored = window.localStorage.getItem(viewStorageKey);
      } catch {
        // Storage can be unavailable in hardened/private browser contexts.
      }
      setView(validView(stored) ? stored : "day");
      setViewReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [viewStorageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem("mone-calendar-zoom");
        if (
          stored === "compact" ||
          stored === "default" ||
          stored === "expanded"
        )
          setZoom(stored);
      } catch {
        // The default density remains available when storage is disabled.
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    const qs = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      locale,
    });
    try {
      const response = await fetch(`/api/calendar?${qs}`);
      if (!response.ok) throw new Error("calendar_load");
      const payload = (await response.json()) as Payload;
      setData(payload);
    } catch {
      setMessage(t.conflict);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to, locale, t.conflict]);

  useEffect(() => {
    if (!data) return;
    const owner = `${setupHref ? "admin" : "staff"}:${data.viewerId}`;
    const selectionKey = `mone-calendar-employees:${owner}`;
    const paletteKey = `mone-calendar-palette-v3:${owner}`;
    const legacyPaletteKey = `mone-calendar-palette-v2:${owner}`;
    if (selectionOwnerRef.current !== selectionKey) {
      let stored: unknown = null;
      try {
        stored = JSON.parse(
          window.localStorage.getItem(selectionKey) ?? "null",
        );
      } catch {
        stored = null;
      }
      setSelected(
        normalizeEmployeeSelection(
          stored,
          data.practitioners.map((item) => item.id),
          data.ownPractitionerId,
        ),
      );
      selectionOwnerRef.current = selectionKey;
    } else {
      setSelected((current) =>
        current.filter((id) =>
          data.practitioners.some((practitioner) => practitioner.id === id),
        ),
      );
    }
    if (paletteOwnerRef.current !== paletteKey) {
      let stored: unknown = null;
      let shouldMigrate = false;
      try {
        const current = window.localStorage.getItem(paletteKey);
        const legacy = window.localStorage.getItem(legacyPaletteKey);
        const saved = current ?? legacy;
        shouldMigrate = current === null && legacy !== null;
        stored = JSON.parse(saved ?? "null");
      } catch {
        stored = null;
      }
      const normalized = normalizeInternalPalette(stored, paletteCatalog);
      setPalette(normalized);
      if (shouldMigrate) {
        try {
          window.localStorage.setItem(paletteKey, JSON.stringify(normalized));
        } catch {}
      }
      paletteOwnerRef.current = paletteKey;
    } else {
      setPalette((current) =>
        normalizeInternalPalette(current, paletteCatalog),
      );
    }
  }, [data, paletteCatalog, setupHref]);

  function selectEmployees(next: string[]) {
    if (!data) return;
    const normalized = data.ownPractitionerId
      ? [data.ownPractitionerId]
      : [...new Set(next)].filter((id) =>
          data.practitioners.some((item) => item.id === id),
        );
    setSelected(normalized);
    try {
      window.localStorage.setItem(
        `mone-calendar-employees:${setupHref ? "admin" : "staff"}:${data.viewerId}`,
        JSON.stringify(normalized),
      );
    } catch {}
  }

  function savePalette(next: InternalPalettePreference[]) {
    const normalized = normalizeInternalPalette(next, paletteCatalog);
    setPalette(normalized);
    if (
      selectedTemplateId &&
      !normalized.some(
        (item) =>
          item.enabled &&
          data?.templates.some(
            (template) =>
              template.id === selectedTemplateId && template.key === item.key,
          ),
      )
    )
      setSelectedTemplateId(null);
    if (!data) return;
    try {
      window.localStorage.setItem(
        `mone-calendar-palette-v3:${setupHref ? "admin" : "staff"}:${data.viewerId}`,
        JSON.stringify(normalized),
      );
    } catch {}
  }

  useEffect(() => {
    if (!viewReady) return;
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load, viewReady]);

  const visiblePractitioners =
    data?.practitioners.filter((item) => selected.includes(item.id)) ?? [];

  const loadPickerDates = useCallback(
    async (from: string, to: string) => {
      const ids = selected.length
        ? selected
        : (data?.practitioners.map((item) => item.id) ?? []);
      if (!ids.length) return;
      try {
        const params = new URLSearchParams({
          from,
          to,
          practitionerIds: ids.join(","),
        });
        const response = await fetch(`/api/calendar/working-dates?${params}`);
        if (!response.ok) throw new Error("working_dates");
        const payload = (await response.json()) as { dates?: string[] };
        setPickerDates(
          Array.isArray(payload.dates) ? payload.dates : undefined,
        );
      } catch {
        setPickerDates(undefined);
      }
    },
    [data?.practitioners, selected],
  );

  function navigate(direction: -1 | 1) {
    setDate(
      addDays(
        date,
        direction * (view === "day" ? 1 : view === "week" ? 7 : 28),
      ),
    );
  }

  function changeView(next: View) {
    setView(next);
    try {
      window.localStorage.setItem(viewStorageKey, next);
    } catch {
      // The active view still works when persistence is unavailable.
    }
  }

  function openEditor(
    appointment: Appointment,
    start = appointment.start,
    practitionerId = appointment.practitionerId,
  ) {
    setEditing({
      appointment,
      start,
      practitionerId,
      roomId: appointment.roomId ?? appointment.allowedRoomIds[0] ?? "",
      deviceId: appointment.deviceId ?? appointment.allowedDeviceIds[0] ?? "",
    });
  }

  async function openAppointment(appointment: Appointment) {
    const response = await fetch(`/api/staff/appointments/${appointment.id}`);
    if (!response.ok) {
      setMessage(t.conflict);
      return;
    }
    const payload = (await response.json()) as ManageAppointmentDetail &
      AppointmentDetail;
    if (appointment.editable) {
      setManaging({
        start: appointment.start,
        practitionerId: appointment.practitionerId,
        detail: payload,
      });
    } else {
      setDetail(payload);
    }
  }

  function openCreate(start?: string, practitionerId?: string) {
    const resolvedPractitionerId =
      practitionerId ??
      data?.ownPractitionerId ??
      selected[0] ??
      data?.practitioners[0]?.id ??
      "";
    const firstOpen = data?.availabilities
      .find(
        (item) =>
          item.date === date && item.practitionerId === resolvedPractitionerId,
      )
      ?.slots.find((slot) => slot.status === "open")?.start;
    let fallback = new Date(
      firstOpen ?? calendarDropStart(date, 10 * 60) ?? new Date().toISOString(),
    );
    if (fallback.getTime() <= Date.now()) {
      const now = new Date();
      const minutes = Math.ceil(clinicMinute(now) / 15) * 15;
      fallback = new Date(
        calendarDropStart(date, Math.min(minutes, 23 * 60 + 45)) ??
          fallback.toISOString(),
      );
    }
    setManaging({
      start: start ?? fallback.toISOString(),
      practitionerId: resolvedPractitionerId,
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTemplateId(null);
    if (!event.over) return;
    const [targetKind, targetDate, practitionerId, targetMinuteRaw] = String(
      event.over.id,
    ).split(":");
    if (targetKind !== "cell" || !targetDate || !practitionerId) return;
    const targetStart = calendarDropStart(targetDate, Number(targetMinuteRaw));
    if (!targetStart) return;
    if (String(event.active.id).startsWith("template:")) {
      const templateId = String(event.active.id).slice("template:".length);
      if (!data?.templates.some((item) => item.id === templateId)) return;
      setSelectedTemplateId(templateId);
      setBlockEditing({ start: targetStart, practitionerId });
      return;
    }
    if (String(event.active.id).startsWith("block:")) {
      const block = data?.blocks.find(
        (item) => `block:${item.id}` === event.active.id,
      );
      if (!block) return;
      setBlockEditing({
        start: targetStart,
        practitionerId,
        block: {
          ...block,
          start: targetStart,
          practitionerIds: [practitionerId],
        },
      });
      return;
    }
    const appointment = data?.appointments.find(
      (item) => item.id === event.active.id,
    );
    if (!appointment?.editable) return;
    const original = new Date(appointment.start);
    const target = new Date(targetStart);
    const targetEnd = new Date(
      target.getTime() +
        (new Date(appointment.end).getTime() - original.getTime()),
    );
    const targetAvailability = data?.availabilities.find(
      (item) =>
        item.date === targetDate && item.practitionerId === practitionerId,
    );
    if (!availabilityCovers(targetAvailability?.slots, target, targetEnd)) {
      setMessage(t.conflict);
      return;
    }
    openEditor(appointment, target.toISOString(), practitionerId);
  }

  function handleDragStart(activeId: string) {
    if (!activeId.startsWith("template:")) return;
    const templateId = activeId.slice("template:".length);
    if (!data?.templates.some((template) => template.id === templateId)) return;
    setActiveTemplateId(templateId);
    setSelectedTemplateId(templateId);
  }

  function clearRangeSelection() {
    setRangeSelection(null);
  }

  function finishRangeSelection(selection: CalendarRangeSelection) {
    const first = selection.targets[0];
    const start = calendarRangeStart(first.date, selection.startMinute);
    if (!start) return;
    setManaging({
      start,
      practitionerId: first.practitionerId,
      durationMin: selection.endMinute - selection.startMinute,
    });
  }

  function changeZoom(direction: -1 | 1) {
    const levels: Zoom[] = ["compact", "default", "expanded"];
    const next =
      levels[
        Math.max(
          0,
          Math.min(levels.length - 1, levels.indexOf(zoom) + direction),
        )
      ];
    setZoom(next);
    try {
      window.localStorage.setItem("mone-calendar-zoom", next);
    } catch {}
  }

  async function saveEdit() {
    if (!editing) return;
    setMessage(null);
    const response = await fetch(
      `/api/calendar/appointments/${editing.appointment.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: editing.appointment.version,
          start: editing.start,
          practitionerId: editing.practitionerId,
          roomId: editing.roomId,
          deviceId: editing.deviceId || null,
        }),
      },
    );
    if (!response.ok) {
      setMessage(t.conflict);
      return;
    }
    setEditing(null);
    setMessage(t.saved);
    await load();
  }

  async function applyHours() {
    const response = await fetch("/api/staff/schedule", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: date, ...hours, stepMin: 15 }),
    });
    if (!response.ok) {
      setMessage(t.conflict);
      return;
    }
    setHoursOpen(false);
    setMessage(t.saved);
    await load();
  }

  function openWorkdayEditor(mode: "add" | "remove") {
    if (!data) return;
    const practitionerId = data.canEditAllAvailability
      ? (selected[0] ?? data.practitioners[0]?.id ?? "")
      : (data.ownPractitionerId ?? "");
    if (!practitionerId) return;
    const practitioner = data.practitioners.find(
      (item) => item.id === practitionerId,
    );
    const saved = practitioner?.workingHours
      ? parseWorkingHours(practitioner.workingHours)
      : { startHour: 9, endHour: 17 };
    setWorkdayEditor({
      mode,
      practitionerId,
      date: date < clinicTodayYmd() ? clinicTodayYmd() : date,
      startMinute: saved.startHour * 60,
      endMinute: saved.endHour * 60,
    });
  }

  async function saveWorkday() {
    if (!workdayEditor) return;
    setWorkdaySaving(true);
    setMessage(null);
    const response = await fetch("/api/staff/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: workdayEditor.mode === "add" ? "add_workday" : "remove_workday",
        practitionerId: workdayEditor.practitionerId,
        date: workdayEditor.date,
        ...(workdayEditor.mode === "add"
          ? {
              startMinute: workdayEditor.startMinute,
              endMinute: workdayEditor.endMinute,
            }
          : {}),
      }),
    });
    setWorkdaySaving(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage(
        payload?.error === "appointments_conflict"
          ? t.workdayConflict
          : t.workdayInvalid,
      );
      return;
    }
    const mode = workdayEditor.mode;
    setWorkdayEditor(null);
    setMessage(mode === "add" ? t.workdayAdded : t.workdayRemoved);
    await load();
  }

  const fmtDate = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: CLINIC_TIME_ZONE,
  });
  const fmtTime = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: CLINIC_TIME_ZONE,
  });

  return (
    <section className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <h1 className="font-display text-[clamp(34px,5vw,54px)] leading-none font-medium">
            {t.title}
          </h1>
          <p className="mt-[7px] font-sans text-[14px] text-muted">
            {fmtDate.format(dateFromYmd(date))}
          </p>
        </div>
        {setupHref ? (
          <Link
            href={setupHref}
            className="inline-flex min-h-[44px] items-center gap-[8px] rounded-[4px] border border-line-btn bg-card px-[14px] font-sans text-[12px] tracking-[.08em] uppercase"
          >
            {t.setup}
            <GearSix size={18} weight="regular" />
          </Link>
        ) : null}
      </div>

      <div className="sticky top-0 z-30 mt-[14px] rounded-[8px] border border-line-card bg-card/95 p-[10px] shadow-card backdrop-blur">
        <div className="flex flex-nowrap items-center gap-[8px] overflow-x-auto pb-[2px] md:flex-wrap md:overflow-visible md:pb-0 [&>*]:shrink-0">
          {(["day", "week", "month"] as View[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => changeView(item)}
              className={view === item ? activeButtonCls : buttonCls}
            >
              {t[item]}
            </button>
          ))}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={iconButtonCls}
            aria-label="Previous"
          >
            <CaretLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => setDate(today())}
            className={cn(buttonCls, "bg-btn-fill")}
          >
            {t.today}
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            className={iconButtonCls}
            aria-label="Next"
          >
            <CaretRight size={18} />
          </button>
          <DatePicker
            locale={locale}
            value={date}
            onValueChange={setDate}
            ariaLabel={t.today}
            className="w-[170px]"
            availableDates={pickerDates}
            onMonthChange={loadPickerDates}
          />
          <p className="min-w-[180px] text-center font-sans text-[13px] font-medium text-ink md:flex-1">
            {view === "day"
              ? fmtDate.format(range.from)
              : `${fmtDate.format(range.from)} – ${fmtDate.format(new Date(range.to.getTime() - 86400000))}`}
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className={iconButtonCls}
            aria-label={t.refresh}
          >
            <ArrowClockwise size={18} />
          </button>
          <TooltipIconButton
            label={t.zoomOut}
            onClick={() => changeZoom(-1)}
            disabled={zoom === "compact"}
          >
            <MagnifyingGlassMinus size={19} weight="regular" />
          </TooltipIconButton>
          <TooltipIconButton
            label={t.zoomIn}
            onClick={() => changeZoom(1)}
            disabled={zoom === "expanded"}
          >
            <MagnifyingGlassPlus size={19} weight="regular" />
          </TooltipIconButton>
          {data?.canManageAppointments ? (
            <button
              type="button"
              onClick={() => openCreate()}
              className={primaryButtonCls}
            >
              {t.create}
              <Plus size={18} weight="regular" />
            </button>
          ) : null}
          {data?.canEditAllAvailability || data?.canEditOwnAvailability ? (
            <>
              <TooltipIconButton
                label={t.addWorkday}
                onClick={() => openWorkdayEditor("add")}
              >
                <Plus size={18} weight="regular" />
              </TooltipIconButton>
              <TooltipIconButton
                label={t.removeWorkday}
                onClick={() => openWorkdayEditor("remove")}
              >
                <Minus size={18} weight="regular" />
              </TooltipIconButton>
              <button
                type="button"
                onClick={() => {
                  const practitionerId = data.canEditAllAvailability
                    ? (selected[0] ?? data.practitioners[0]?.id ?? "")
                    : (data.ownPractitionerId ?? "");
                  const practitioner = data.practitioners.find(
                    (item) => item.id === practitionerId,
                  );
                  const saved = parseWorkingHours(practitioner?.workingHours);
                  setHours((current) => ({
                    ...current,
                    practitionerId,
                    intervals: saved.intervals,
                  }));
                  setHoursOpen(true);
                }}
                className={buttonCls}
              >
                {t.hours}
              </button>
            </>
          ) : null}
        </div>
        <div className="mt-[10px] flex flex-nowrap gap-[7px] overflow-x-auto border-t border-line-hair pt-[10px] pb-[2px] md:flex-wrap md:overflow-visible md:pb-0 [&>*]:shrink-0">
          <button
            type="button"
            onClick={() =>
              selectEmployees(data?.practitioners.map((item) => item.id) ?? [])
            }
            className={buttonCls}
          >
            {t.all}
          </button>
          <button
            type="button"
            onClick={() =>
              selectEmployees(
                data?.practitioners
                  .filter((employee) =>
                    data.availabilities.some(
                      (item) =>
                        item.practitionerId === employee.id &&
                        item.date === date &&
                        item.slots.some((slot) => slot.status === "open"),
                    ),
                  )
                  .map((employee) => employee.id) ?? [],
              )
            }
            className={buttonCls}
          >
            {t.working}
          </button>
          {data?.practitioners.map((employee) => {
            const active = selected.includes(employee.id);
            return (
              <button
                key={employee.id}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  selectEmployees(
                    active
                      ? selected.filter((id) => id !== employee.id)
                      : [...selected, employee.id],
                  )
                }
                className={cn(employeeButtonCls, active && "text-ink")}
                style={{
                  borderColor: employee.calendarColor,
                  background: active
                    ? `${employee.calendarColor}33`
                    : undefined,
                }}
              >
                {employee.name}
              </button>
            );
          })}
        </div>
      </div>

      {message ? (
        <p
          role="status"
          className="mt-[12px] rounded-[5px] border border-line-btn bg-btn-fill px-[14px] py-[10px] font-sans text-[14px]"
        >
          {message}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-[24px] font-sans text-[14px] text-muted">
          {t.loading}
        </p>
      ) : null}
      {!loading && data ? (
        <DndContext
          sensors={sensors}
          onDragStart={(event) => handleDragStart(String(event.active.id))}
          onDragCancel={() => setActiveTemplateId(null)}
          onDragEnd={handleDragEnd}
        >
          <div className="mt-[10px] min-w-0 lg:grid lg:grid-cols-[128px_minmax(0,1fr)] lg:gap-[8px]">
            <aside
              className="min-w-0 rounded-[6px] border border-line-card bg-card p-[6px] lg:mt-[10px]"
              aria-label={t.internal}
            >
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="min-h-11 w-full rounded-[4px] border border-line-btn bg-page px-3 font-sans text-[12px] font-medium hover:bg-btn-fill"
              >
                {t.editInternal}
              </button>
              <div className="mt-[6px] flex min-w-0 gap-[6px] overflow-x-auto lg:grid lg:overflow-visible">
                {visibleTemplates.map(({ template, alias }) => (
                  <TemplateChip
                    key={template.id}
                    template={template}
                    label={alias}
                    selected={selectedTemplateId === template.id}
                    onSelect={() =>
                      setSelectedTemplateId((current) =>
                        current === template.id ? null : template.id,
                      )
                    }
                  />
                ))}
              </div>
            </aside>
            <div className="min-w-0">
              {view === "month" ? (
                <MonthView
                  range={range}
                  data={data}
                  selected={selected}
                  fmtDate={fmtDate}
                  fmtTime={fmtTime}
                  onOpenDay={(next) => {
                    setDate(next);
                    changeView("day");
                  }}
                  onOpenBlock={(block) =>
                    setBlockEditing({
                      start: block.start,
                      practitionerId: block.practitionerIds[0] ?? "",
                      block,
                    })
                  }
                />
              ) : (
                <TimeGrid
                  range={range}
                  view={view}
                  data={data}
                  practitioners={visiblePractitioners}
                  fmtDate={fmtDate}
                  fmtTime={fmtTime}
                  onOpen={(appointment) => void openAppointment(appointment)}
                  onOpenBlock={(block) =>
                    setBlockEditing({
                      start: block.start,
                      practitionerId: block.practitionerIds[0] ?? "",
                      block,
                    })
                  }
                  hourHeight={ZOOM_HEIGHTS[zoom]}
                  outsideHours={t.outsideHours}
                  selection={rangeSelection}
                  onSelectionChange={setRangeSelection}
                  onSelectionComplete={finishRangeSelection}
                />
              )}
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTemplate ? (
              <div
                className="min-h-[34px] min-w-[124px] rounded-[4px] border px-3 py-2 font-sans text-xs shadow-card"
                style={{
                  background: `${activeTemplate.template.color}EE`,
                  borderColor: activeTemplate.template.color,
                }}
              >
                {activeTemplate.alias}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}

      {paletteOpen && data ? (
        <InternalServicePaletteEditor
          locale={locale}
          templates={data.templates}
          value={palette}
          onChange={savePalette}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}

      {blockEditing && data ? (
        <CalendarBlockEditor
          locale={locale}
          initialStart={blockEditing.start}
          initialPractitionerId={blockEditing.practitionerId}
          initialDurationMin={blockEditing.durationMin}
          block={blockEditing.block}
          templates={[...data.templates].sort(
            (a, b) =>
              Number(b.id === selectedTemplateId) -
              Number(a.id === selectedTemplateId),
          )}
          practitioners={data.practitioners}
          rooms={data.rooms}
          devices={data.devices}
          canAssignMany={data.canEditAllAvailability}
          onClose={() => {
            setBlockEditing(null);
            clearRangeSelection();
          }}
          onSaved={async () => {
            clearRangeSelection();
            await load();
          }}
        />
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/35 p-[12px] sm:items-center"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[540px] rounded-[10px] border border-line-card bg-card p-[clamp(18px,3vw,28px)] shadow-card"
          >
            <h2 className="font-display text-[30px] font-medium">
              {detail.procedure}
            </h2>
            <p className="mt-2 font-sans text-sm text-body">
              {fmtTime.format(new Date(detail.start))}–
              {fmtTime.format(new Date(detail.end))} · {detail.room ?? "—"}
              {detail.device ? ` · ${detail.device}` : ""}
            </p>
            <dl className="mt-5 grid gap-3 font-sans text-sm">
              <div>
                <dt className="text-muted">Client</dt>
                <dd className="font-medium">{detail.client.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted">Contact</dt>
                <dd>
                  {detail.client.phone} · {detail.client.email}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Booking notes</dt>
                <dd>{detail.notes ?? "—"}</dd>
              </div>
              <div className="rounded-[5px] border border-[#c98383] bg-[#fff4f2] p-3">
                <dt className="font-medium">Contraindication warning</dt>
                <dd className="mt-1">
                  {detail.client.contraindications ??
                    "No contraindications recorded."}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="mt-5 min-h-[44px] w-full rounded border border-line-btn"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      ) : null}

      {managing ? (
        <AppointmentForm
          locale={locale}
          initialStart={managing.start}
          initialPractitionerId={managing.practitionerId}
          initialDurationMin={managing.durationMin}
          detail={managing.detail}
          onClose={() => {
            setManaging(null);
            clearRangeSelection();
          }}
          onSaved={async () => {
            clearRangeSelection();
            await load();
          }}
        />
      ) : null}

      {editing && data ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/35 p-[12px] sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setEditing(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-edit-title"
            className="w-full max-w-[560px] rounded-[10px] border border-line-card bg-card p-[clamp(18px,3vw,28px)] shadow-card"
          >
            <h2
              id="calendar-edit-title"
              className="font-display text-[30px] font-medium"
            >
              {t.confirm}
            </h2>
            <p className="mt-[4px] font-sans text-[14px] text-body">
              {editing.appointment.clientName} · {editing.appointment.procedure}
            </p>
            <div className="mt-[18px] grid gap-[13px] sm:grid-cols-2">
              <Field label={t.time}>
                <span className="block rounded-[4px] border border-line-card bg-page px-[12px] py-[11px] font-sans text-[14px]">
                  {fmtDate.format(new Date(editing.start))} ·{" "}
                  {fmtTime.format(new Date(editing.start))}
                </span>
              </Field>
              <Field label={t.employee}>
                <ThemedSelect
                  value={editing.practitionerId}
                  onValueChange={(practitionerId) => {
                    const capability = editing.appointment.capabilities.find(
                      (item) => item.practitionerId === practitionerId,
                    );
                    setEditing({
                      ...editing,
                      practitionerId,
                      roomId: capability?.roomId ?? "",
                      deviceId: capability?.deviceIds[0] ?? "",
                    });
                  }}
                  options={data.practitioners
                    .filter((item) =>
                      editing.appointment.qualifiedPractitionerIds.includes(
                        item.id,
                      ),
                    )
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
              <Field label={t.room}>
                <ThemedSelect
                  value={editing.roomId}
                  onValueChange={(roomId) => {
                    const capability = editing.appointment.capabilities.find(
                      (item) =>
                        item.practitionerId === editing.practitionerId &&
                        item.roomId === roomId,
                    );
                    setEditing({
                      ...editing,
                      roomId,
                      deviceId: capability?.deviceIds[0] ?? "",
                    });
                  }}
                  options={data.rooms
                    .filter((item) =>
                      editing.appointment.capabilities.some(
                        (capability) =>
                          capability.practitionerId ===
                            editing.practitionerId &&
                          capability.roomId === item.id,
                      ),
                    )
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
              {editing.appointment.requiresDevice ? (
                <Field label={t.device}>
                  <ThemedSelect
                    value={editing.deviceId}
                    onValueChange={(deviceId) =>
                      setEditing({ ...editing, deviceId })
                    }
                    options={data.devices
                      .filter((item) =>
                        editing.appointment.capabilities.some(
                          (capability) =>
                            capability.practitionerId ===
                              editing.practitionerId &&
                            capability.roomId === editing.roomId &&
                            capability.deviceIds.includes(item.id),
                        ),
                      )
                      .map((item) => ({ value: item.id, label: item.name }))}
                  />
                </Field>
              ) : null}
            </div>
            <div className="mt-[22px] flex flex-wrap justify-end gap-[9px]">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className={buttonCls}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveEdit()}
                className={primaryButtonCls}
              >
                {t.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {workdayEditor && data ? (
        <div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-ink/35 p-[12px] sm:items-center"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !workdaySaving)
              setWorkdayEditor(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="workday-editor-title"
            className="w-full max-w-[520px] rounded-[10px] border border-line-card bg-card p-[clamp(18px,3vw,28px)] shadow-card"
          >
            <h2
              id="workday-editor-title"
              className="font-display text-[30px] font-medium"
            >
              {workdayEditor.mode === "add" ? t.addWorkday : t.removeWorkday}
            </h2>
            <div className="mt-[18px] grid gap-[14px]">
              <Field label={t.employee}>
                <ThemedSelect
                  value={workdayEditor.practitionerId}
                  disabled={!data.canEditAllAvailability}
                  onValueChange={(practitionerId) => {
                    const practitioner = data.practitioners.find(
                      (item) => item.id === practitionerId,
                    );
                    const saved = practitioner?.workingHours
                      ? parseWorkingHours(practitioner.workingHours)
                      : { startHour: 9, endHour: 17 };
                    setWorkdayEditor({
                      ...workdayEditor,
                      practitionerId,
                      startMinute: saved.startHour * 60,
                      endMinute: saved.endHour * 60,
                    });
                  }}
                  options={data.practitioners
                    .filter(
                      (item) =>
                        data.canEditAllAvailability ||
                        item.id === data.ownPractitionerId,
                    )
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
              <Field label={t.date}>
                <DatePicker
                  locale={locale}
                  value={workdayEditor.date}
                  onValueChange={(nextDate) =>
                    setWorkdayEditor({ ...workdayEditor, date: nextDate })
                  }
                  ariaLabel={t.date}
                  min={clinicTodayYmd()}
                  disableClosedDays={false}
                />
              </Field>
              {workdayEditor.mode === "add" ? (
                <Field label={t.workdayHours}>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <TimePicker
                      value={String(workdayEditor.startMinute)}
                      onValueChange={(value) => {
                        const startMinute = Number(value);
                        setWorkdayEditor({
                          ...workdayEditor,
                          startMinute,
                          endMinute: Math.min(
                            24 * 60,
                            Math.max(workdayEditor.endMinute, startMinute + 15),
                          ),
                        });
                      }}
                      options={workdayTimeOptions(0, 24 * 60 - 15)}
                      ariaLabel={t.startHour}
                    />
                    <span aria-hidden className="text-muted">
                      –
                    </span>
                    <TimePicker
                      value={String(workdayEditor.endMinute)}
                      onValueChange={(value) =>
                        setWorkdayEditor({
                          ...workdayEditor,
                          endMinute: Number(value),
                        })
                      }
                      options={workdayTimeOptions(
                        workdayEditor.startMinute + 15,
                        24 * 60,
                      )}
                      ariaLabel={t.endHour}
                    />
                  </div>
                </Field>
              ) : null}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={workdaySaving}
                onClick={() => setWorkdayEditor(null)}
                className={buttonCls}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={workdaySaving}
                onClick={() => void saveWorkday()}
                className={cn(
                  primaryButtonCls,
                  workdayEditor.mode === "remove" &&
                    "border-[#b64d56] bg-[#b64d56]",
                )}
              >
                {workdayEditor.mode === "add" ? t.add : t.remove}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {hoursOpen && data ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-ink/35 p-[12px] sm:items-center"
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[520px] rounded-[10px] border border-line-card bg-card p-[clamp(18px,3vw,28px)] shadow-card"
          >
            <h2 className="font-display text-[30px] font-medium">{t.hours}</h2>
            <div className="mt-[16px] grid gap-[12px] sm:grid-cols-2">
              <Field label={t.employee}>
                <ThemedSelect
                  value={hours.practitionerId}
                  onValueChange={(practitionerId) => {
                    const practitioner = data.practitioners.find(
                      (item) => item.id === practitionerId,
                    );
                    setHours({
                      ...hours,
                      practitionerId,
                      intervals: parseWorkingHours(practitioner?.workingHours)
                        .intervals,
                    });
                  }}
                  disabled={!data.canEditAllAvailability}
                  options={data.practitioners
                    .filter(
                      (item) =>
                        data.canEditAllAvailability ||
                        item.id === data.ownPractitionerId,
                    )
                    .map((item) => ({ value: item.id, label: item.name }))}
                />
              </Field>
              <Field label={t.daysAhead}>
                <input
                  type="number"
                  min={1}
                  max={90}
                  value={hours.daysAhead}
                  onChange={(event) =>
                    setHours({
                      ...hours,
                      daysAhead: Number(event.target.value),
                    })
                  }
                  className="min-h-[44px] w-full rounded-[4px] border border-line-btn bg-page px-[11px] font-sans text-[14px]"
                />
              </Field>
            </div>
            <div className="mt-[14px] max-h-[58vh] overflow-y-auto pr-1">
              <WeeklyScheduleEditor
                locale={locale}
                value={hours.intervals}
                onChange={(intervals) => setHours({ ...hours, intervals })}
              />
            </div>
            <div className="mt-[20px] flex justify-end gap-[9px]">
              <button
                type="button"
                onClick={() => setHoursOpen(false)}
                className={buttonCls}
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={() => void applyHours()}
                className={primaryButtonCls}
              >
                {t.applyHours}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function TimeGrid({
  range,
  view,
  data,
  practitioners,
  fmtDate,
  fmtTime,
  onOpen,
  onOpenBlock,
  hourHeight,
  outsideHours,
  selection,
  onSelectionChange,
  onSelectionComplete,
}: {
  range: { from: Date; to: Date };
  view: View;
  data: Payload;
  practitioners: Practitioner[];
  fmtDate: Intl.DateTimeFormat;
  fmtTime: Intl.DateTimeFormat;
  onOpen: (appointment: Appointment) => void;
  onOpenBlock: (block: CalendarBlock) => void;
  hourHeight: number;
  outsideHours: string;
  selection: CalendarRangeSelection | null;
  onSelectionChange: (selection: CalendarRangeSelection) => void;
  onSelectionComplete: (selection: CalendarRangeSelection) => void;
}) {
  const days = Array.from(
    { length: view === "day" ? 1 : 7 },
    (_, index) => new Date(range.from.getTime() + index * 86400000),
  );
  const orderedColumns = days.flatMap((day) =>
    practitioners.map((practitioner) => ({ day, practitioner })),
  );
  const columns = orderedColumns.map((column, columnIndex) => ({
    ...column,
    separatorClass: calendarColumnSeparator(orderedColumns, columnIndex),
  }));
  const rangeColumns = columns.map(({ day, practitioner }) => ({
    date: ymd(day),
    practitionerId: practitioner.id,
  }));
  const rangeAnchorRef = useRef<CalendarRangeCell | null>(null);
  const currentSelectionRef = useRef<CalendarRangeSelection | null>(null);
  const selectingRef = useRef(false);

  function updateRange(focus: CalendarRangeCell) {
    const anchor = rangeAnchorRef.current;
    if (!anchor) return;
    const next = normalizeCalendarRange(anchor, focus, rangeColumns);
    if (next) {
      currentSelectionRef.current = next;
      onSelectionChange(next);
    }
  }

  function beginRange(cell: CalendarRangeCell) {
    rangeAnchorRef.current = cell;
    selectingRef.current = true;
    updateRange(cell);
  }

  function completeRange() {
    if (!selectingRef.current) return;
    const completed = currentSelectionRef.current;
    selectingRef.current = false;
    rangeAnchorRef.current = null;
    if (completed) onSelectionComplete(completed);
  }

  useEffect(() => {
    function finishPointerRange() {
      if (!selectingRef.current) return;
      const completed = currentSelectionRef.current;
      selectingRef.current = false;
      rangeAnchorRef.current = null;
      if (completed) onSelectionComplete(completed);
    }
    function cancelPointerRange() {
      selectingRef.current = false;
      rangeAnchorRef.current = null;
      currentSelectionRef.current = null;
    }
    window.addEventListener("pointerup", finishPointerRange);
    window.addEventListener("pointercancel", cancelPointerRange);
    return () => {
      window.removeEventListener("pointerup", finishPointerRange);
      window.removeEventListener("pointercancel", cancelPointerRange);
    };
  }, [onSelectionComplete]);
  const rangeBounds = calendarWorkingBounds(columns, data) ?? {
    startMinute: 10 * 60,
    endMinute: 19 * 60,
  };
  const visibleIds = new Set(practitioners.map((item) => item.id));
  const visibleDays = new Set(days.map(ymd));
  const outsideAppointments = data.appointments.filter((appointment) => {
    if (
      !visibleIds.has(appointment.practitionerId) ||
      !visibleDays.has(clinicDateFromInstant(new Date(appointment.start)))
    )
      return false;
    const start = new Date(appointment.start);
    const end = new Date(appointment.end);
    const startMinute = clinicMinute(start);
    const endMinute = clinicMinute(end);
    const appointmentDate = clinicDateFromInstant(start);
    const availability = data.availabilities.find(
      (item) =>
        item.date === appointmentDate &&
        item.practitionerId === appointment.practitionerId,
    );
    return (
      !rangeBounds ||
      !availabilityCovers(availability?.slots, start, end) ||
      startMinute < rangeBounds.startMinute ||
      endMinute > rangeBounds.endMinute
    );
  });
  const outsideBlocks = data.blocks.filter((block) => {
    if (
      !block.practitionerIds.some((id) => visibleIds.has(id)) ||
      !visibleDays.has(clinicDateFromInstant(new Date(block.start)))
    )
      return false;
    const start = new Date(block.start);
    const end = new Date(block.end);
    const startMinute = clinicMinute(start);
    const endMinute = clinicMinute(end);
    return (
      !rangeBounds ||
      startMinute < rangeBounds.startMinute ||
      endMinute > rangeBounds.endMinute
    );
  });
  return (
    <div className="mt-[10px]">
      {outsideAppointments.length || outsideBlocks.length ? (
        <div className="mb-[10px] rounded-[7px] border border-[#c98383] bg-[#fff4f2] p-[10px]">
          <p className="font-sans text-[11px] font-medium tracking-[.08em] text-[#8c3434] uppercase">
            {outsideHours}
          </p>
          <div className="mt-[7px] flex flex-wrap gap-[7px]">
            {outsideAppointments.map((appointment) => (
              <button
                key={appointment.id}
                type="button"
                onClick={() => onOpen(appointment)}
                className="rounded-[4px] border border-[#c98383] bg-card px-[9px] py-[6px] text-left font-sans text-[11px]"
              >
                {fmtDate.format(new Date(appointment.start))} ·{" "}
                {fmtTime.format(new Date(appointment.start))} ·{" "}
                {appointment.clientName}
              </button>
            ))}
            {outsideBlocks.map((block) => (
              <button
                key={block.id}
                type="button"
                onClick={() => onOpenBlock(block)}
                className="rounded-[4px] border border-[#c98383] bg-card px-[9px] py-[6px] text-left font-sans text-[11px]"
              >
                {fmtDate.format(new Date(block.start))} ·{" "}
                {fmtTime.format(new Date(block.start))} ·{" "}
                {block.items.map((item) => item.label).join(" + ")}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div className="overflow-x-auto overflow-y-hidden rounded-[8px] border border-line-card bg-card">
        <div
          className="calendar-time-grid grid"
          style={
            {
              "--calendar-column-count": Math.max(1, columns.length),
            } as CSSProperties
          }
        >
          <div className="sticky top-0 left-0 z-30 row-span-2 border-r-2 border-line-btn-hover bg-card md:hidden" />
          {days.map((day) => (
            <div
              key={`mobile-day:${ymd(day)}`}
              className={cn(
                "sticky top-0 z-20 border-r-2 border-line-btn-hover bg-card px-px py-[3px] text-center font-sans text-[10px] font-semibold whitespace-nowrap md:hidden",
                ymd(day) === today() && "bg-btn-fill",
              )}
              style={{
                gridColumn: `span ${Math.max(1, practitioners.length)}`,
              }}
            >
              {fmtDate.format(day)}
            </div>
          ))}
          {columns.map(({ day, practitioner, separatorClass }) => (
            <div
              key={`mobile-employee:${ymd(day)}:${practitioner.id}`}
              className={cn(
                "sticky top-[24px] z-20 min-w-0 bg-card px-px py-[3px] text-center md:hidden",
                separatorClass,
                ymd(day) === today() && "bg-btn-fill",
              )}
              title={practitioner.name}
            >
              <span
                className="mx-auto grid size-[18px] max-w-full place-items-center overflow-hidden rounded-full font-sans text-[8px] leading-none font-semibold text-ink"
                style={{ background: `${practitioner.calendarColor}66` }}
              >
                {initials(practitioner.name).slice(0, 1)}
              </span>
            </div>
          ))}
          <div className="sticky top-0 left-0 z-20 hidden border-r-2 border-line-btn-hover bg-card md:block" />
          {columns.map(({ day, practitioner, separatorClass }) => (
            <div
              key={`desktop:${ymd(day)}:${practitioner.id}`}
              className={cn(
                "sticky top-0 z-20 hidden bg-card px-[6px] py-[6px] text-center md:block",
                separatorClass,
              )}
            >
              <div className="font-sans text-[11px] text-muted">
                {fmtDate.format(day)}
              </div>
              <div
                className="mx-auto mt-[3px] max-w-[150px] truncate rounded-full px-[8px] py-[2px] font-sans text-[11px] font-medium"
                style={{ background: `${practitioner.calendarColor}55` }}
              >
                {view === "week" && practitioners.length > 2
                  ? initials(practitioner.name)
                  : practitioner.name}
              </div>
            </div>
          ))}
          <div className="sticky top-0 right-0 z-20 hidden border-l border-line-card bg-card md:block" />
          <TimeAxis range={rangeBounds} hourHeight={hourHeight} />
          {columns.map(({ day, practitioner, separatorClass }, columnIndex) => (
            <CalendarColumn
              key={`${ymd(day)}:${practitioner.id}`}
              day={ymd(day)}
              practitioner={practitioner}
              separatorClass={separatorClass}
              data={data}
              fmtTime={fmtTime}
              onOpen={onOpen}
              onOpenBlock={onOpenBlock}
              range={rangeBounds}
              hourHeight={hourHeight}
              compactWeek={view === "week"}
              columnIndex={columnIndex}
              selection={selection}
              onRangeStart={beginRange}
              onRangeMove={(cell) => {
                if (selectingRef.current) updateRange(cell);
              }}
              onRangeEnd={completeRange}
            />
          ))}
          <TimeAxis
            range={rangeBounds}
            hourHeight={hourHeight}
            right
            className="hidden md:block"
          />
        </div>
      </div>
    </div>
  );
}

function calendarColumnSeparator(
  columns: Array<{ day: Date }>,
  columnIndex: number,
) {
  const currentDay = columns[columnIndex]?.day;
  const nextDay = columns[columnIndex + 1]?.day;
  const endsDay = !nextDay || !currentDay || ymd(currentDay) !== ymd(nextDay);

  return endsDay
    ? "border-r-2 border-line-btn-hover"
    : "border-r border-line-btn";
}

function calendarWorkingBounds(
  columns: Array<{ day: Date; practitioner: Practitioner }>,
  data: Payload,
) {
  const ranges = columns.flatMap(({ day, practitioner }) => {
    const date = ymd(day);
    const availability = data.availabilities.find(
      (item) => item.date === date && item.practitionerId === practitioner.id,
    );
    const explicit = openSlotRange(availability?.slots);
    const fallback = workingRangeForDate(date, practitioner.workingHours);
    const resolved = availability ? explicit : fallback;
    return resolved ? [resolved] : [];
  });
  const visibleColumns = new Set(
    columns.map(({ day, practitioner }) => `${ymd(day)}:${practitioner.id}`),
  );
  const eventRanges = [
    ...data.appointments.flatMap((appointment) => {
      const start = new Date(appointment.start);
      const date = clinicDateFromInstant(start);
      if (!visibleColumns.has(`${date}:${appointment.practitionerId}`)) {
        return [];
      }
      const end = new Date(appointment.end);
      return [
        {
          startMinute: clinicMinute(start),
          endMinute:
            clinicDateFromInstant(end) === date ? clinicMinute(end) : 1440,
        },
      ];
    }),
    ...data.blocks.flatMap((block) => {
      const start = new Date(block.start);
      const date = clinicDateFromInstant(start);
      if (
        !block.practitionerIds.some((practitionerId) =>
          visibleColumns.has(`${date}:${practitionerId}`),
        )
      ) {
        return [];
      }
      const end = new Date(block.end);
      return [
        {
          startMinute: clinicMinute(start),
          endMinute:
            clinicDateFromInstant(end) === date ? clinicMinute(end) : 1440,
        },
      ];
    }),
  ];
  ranges.push(...eventRanges);
  if (!ranges.length) return null;
  return {
    startMinute:
      Math.floor(Math.min(...ranges.map((range) => range.startMinute)) / 60) *
      60,
    endMinute:
      Math.ceil(Math.max(...ranges.map((range) => range.endMinute)) / 60) * 60,
  };
}

function TimeAxis({
  range,
  hourHeight,
  right = false,
  className,
}: {
  range: { startMinute: number; endMinute: number };
  hourHeight: number;
  right?: boolean;
  className?: string;
}) {
  const timelineHeight =
    ((range.endMinute - range.startMinute) / 60) * hourHeight;
  return (
    <div
      className={cn(
        "sticky z-10 bg-card",
        right
          ? "right-0 border-l-2 border-line-btn-hover"
          : "left-0 border-r-2 border-line-btn-hover",
        className,
      )}
      style={{ height: timelineHeight + TIME_GRID_EDGE_PADDING * 2 }}
    >
      {Array.from(
        { length: (range.endMinute - range.startMinute) / 60 + 1 },
        (_, index) => (
          <span
            key={index}
            className={cn(
              "absolute -translate-y-1/2 font-sans text-[11px] text-muted",
              right ? "left-[8px]" : "right-[8px]",
            )}
            style={{ top: TIME_GRID_EDGE_PADDING + index * hourHeight }}
          >
            {pad(range.startMinute / 60 + index)}:00
          </span>
        ),
      )}
    </div>
  );
}

function CalendarColumn({
  day,
  practitioner,
  separatorClass,
  data,
  fmtTime,
  onOpen,
  onOpenBlock,
  range,
  hourHeight,
  compactWeek,
  columnIndex,
  selection,
  onRangeStart,
  onRangeMove,
  onRangeEnd,
}: {
  day: string;
  practitioner: Practitioner;
  separatorClass: string;
  data: Payload;
  fmtTime: Intl.DateTimeFormat;
  onOpen: (appointment: Appointment) => void;
  onOpenBlock: (block: CalendarBlock) => void;
  range: { startMinute: number; endMinute: number };
  hourHeight: number;
  compactWeek: boolean;
  columnIndex: number;
  selection: CalendarRangeSelection | null;
  onRangeStart: (cell: CalendarRangeCell) => void;
  onRangeMove: (cell: CalendarRangeCell) => void;
  onRangeEnd: () => void;
}) {
  const availability = data.availabilities.find(
    (item) => item.date === day && item.practitionerId === practitioner.id,
  );
  const appointments = data.appointments.filter(
    (item) =>
      item.practitionerId === practitioner.id &&
      clinicDateFromInstant(new Date(item.start)) === day,
  );
  const blocks = data.blocks.filter(
    (item) =>
      item.practitionerIds.includes(practitioner.id) &&
      clinicDateFromInstant(new Date(item.start)) === day,
  );
  const now = new Date();
  const nowMinutes = clinicMinute(now) - range.startMinute;
  const isToday = day === today();
  const dayHeight = ((range.endMinute - range.startMinute) / 60) * hourHeight;
  const selectedRange =
    selection?.startColumnIndex === columnIndex ? selection : null;
  return (
    <div
      className={cn("relative bg-card", separatorClass)}
      style={{ height: dayHeight + TIME_GRID_EDGE_PADDING * 2 }}
    >
      <div
        data-today={isToday}
        className="calendar-column-surface absolute inset-x-0 bg-[#eee9df]"
        style={{
          top: TIME_GRID_EDGE_PADDING,
          height: dayHeight,
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent ${hourHeight - 1}px, rgba(89,71,50,.16) ${hourHeight - 1}px, rgba(89,71,50,.16) ${hourHeight}px)`,
        }}
      >
        {Array.from(
          { length: Math.ceil((range.endMinute - range.startMinute) / 15) },
          (_, index) => range.startMinute + index * 15,
        ).map((minute) => {
          const startIso = calendarDropStart(day, minute)!;
          const start = new Date(startIso);
          const end = new Date(start.getTime() + 15 * 60_000);
          const open = availabilityCovers(availability?.slots, start, end);
          const past = start.getTime() <= now.getTime();
          return (
            <TimeCellDropTarget
              key={minute}
              day={day}
              minute={minute}
              practitioner={practitioner}
              start={startIso}
              top={((minute - range.startMinute) / 60) * hourHeight}
              height={hourHeight / 4}
              open={open}
              past={past}
              selected={calendarRangeContains(selection, columnIndex, minute)}
              columnIndex={columnIndex}
              fmtTime={fmtTime}
              onRangeStart={onRangeStart}
              onRangeMove={onRangeMove}
              onRangeEnd={onRangeEnd}
            />
          );
        })}
        {selectedRange ? (
          <div
            data-calendar-range-selection="true"
            className="pointer-events-none absolute inset-x-0 z-[2] border border-[#ad8f68] bg-[#ded4c7]"
            style={{
              top:
                ((selectedRange.startMinute - range.startMinute) / 60) *
                hourHeight,
              height:
                ((selectedRange.endMinute - selectedRange.startMinute) / 60) *
                hourHeight,
            }}
          />
        ) : null}
        {isToday &&
        nowMinutes >= 0 &&
        nowMinutes <= range.endMinute - range.startMinute ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-20 border-t border-[#d95f70]"
            style={{ top: (nowMinutes / 60) * hourHeight }}
          />
        ) : null}
        {appointments
          .filter((appointment) => {
            const start = new Date(appointment.start);
            const end = new Date(appointment.end);
            const startMinute = clinicMinute(start);
            const endMinute = clinicMinute(end);
            const displayEndMinute =
              clinicDateFromInstant(end) === day ? endMinute : 1440;
            return (
              startMinute >= range.startMinute &&
              displayEndMinute <= range.endMinute &&
              end.getTime() > start.getTime()
            );
          })
          .map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              color={practitioner.calendarColor}
              fmtTime={fmtTime}
              onOpen={onOpen}
              rangeStartMinute={range.startMinute}
              hourHeight={hourHeight}
              compactWeek={compactWeek}
            />
          ))}
        {blocks.map((block) => (
          <CalendarBlockCard
            key={block.id}
            block={block}
            templates={data.templates}
            fmtTime={fmtTime}
            onOpen={onOpenBlock}
            rangeStartMinute={range.startMinute}
            hourHeight={hourHeight}
            compactWeek={compactWeek}
          />
        ))}
      </div>
    </div>
  );
}

function TimeCellDropTarget({
  day,
  minute,
  practitioner,
  start,
  top,
  height,
  open,
  past,
  selected,
  columnIndex,
  fmtTime,
  onRangeStart,
  onRangeMove,
  onRangeEnd,
}: {
  day: string;
  minute: number;
  practitioner: Practitioner;
  start: string;
  top: number;
  height: number;
  open: boolean;
  past: boolean;
  selected: boolean;
  columnIndex: number;
  fmtTime: Intl.DateTimeFormat;
  onRangeStart: (cell: CalendarRangeCell) => void;
  onRangeMove: (cell: CalendarRangeCell) => void;
  onRangeEnd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell:${day}:${practitioner.id}:${minute}`,
    disabled: past,
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      aria-label={`${fmtTime.format(new Date(start))} · ${practitioner.name}`}
      aria-pressed={selected}
      data-calendar-range-cell="true"
      data-column-index={columnIndex}
      data-minute={minute}
      onPointerDown={(event) => {
        if (past || event.button !== 0) return;
        event.preventDefault();
        onRangeStart({
          date: day,
          practitionerId: practitioner.id,
          columnIndex,
          minute,
        });
      }}
      onPointerEnter={() =>
        onRangeMove({
          date: day,
          practitionerId: practitioner.id,
          columnIndex,
          minute,
        })
      }
      onPointerUp={onRangeEnd}
      onKeyDown={(event) => {
        if (past || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        onRangeStart({
          date: day,
          practitionerId: practitioner.id,
          columnIndex,
          minute,
        });
        onRangeEnd();
      }}
      disabled={past}
      className={cn(
        "absolute inset-x-0 z-[1] touch-none border-0 bg-transparent select-none focus:ring-2 focus:ring-accent focus:outline-none",
        open ? "hover:bg-card/65" : "hover:bg-btn-fill/55",
        isOver && "bg-accent/20 ring-2 ring-accent ring-inset",
        past && "pointer-events-none",
      )}
      style={{ top, height }}
    />
  );
}

function AppointmentCard({
  appointment,
  color,
  fmtTime,
  onOpen,
  rangeStartMinute,
  hourHeight,
  compactWeek,
}: {
  appointment: Appointment;
  color: string;
  fmtTime: Intl.DateTimeFormat;
  onOpen: (appointment: Appointment) => void;
  rangeStartMinute: number;
  hourHeight: number;
  compactWeek: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: appointment.id, disabled: !appointment.editable });
  const start = new Date(appointment.start);
  const end = new Date(appointment.end);
  const reservedUntil = appointment.reservedUntil
    ? new Date(appointment.reservedUntil)
    : end;
  const top = ((clinicMinute(start) - rangeStartMinute) / 60) * hourHeight;
  const height = Math.max(
    32,
    ((end.getTime() - start.getTime()) / 3600000) * hourHeight,
  );
  const bufferHeight = Math.max(
    0,
    ((reservedUntil.getTime() - end.getTime()) / 3600000) * hourHeight,
  );
  return (
    <>
      <button
        ref={setNodeRef}
        type="button"
        onClick={() => onOpen(appointment)}
        {...attributes}
        {...listeners}
        aria-label={`${fmtTime.format(start)}–${fmtTime.format(end)} · ${appointment.clientName} · ${appointment.procedure} · ${appointment.room?.name ?? "—"}${appointment.device ? ` · ${appointment.device.name}` : ""}`}
        className={cn(
          "absolute inset-x-[3px] z-10 overflow-hidden rounded-[4px] border px-[6px] py-[4px] text-left font-sans shadow-sm focus:ring-2 focus:ring-accent focus:outline-none",
          compactWeek &&
            "max-md:inset-x-px max-md:px-px max-md:py-[2px] max-md:text-center",
          !appointment.editable && "cursor-pointer",
          isDragging && "z-50 opacity-60",
          appointment.resourceWarning.length > 0 &&
            "border-line-btn-hover ring-2 ring-line-btn-hover ring-inset",
          // One leg of a multi-procedure visit — same specialist,
          // back-to-back appointments — reads as one visit via a shared
          // left accent, distinct from the ordinary border on every side.
          (appointment.bookingGroupCount ?? 0) > 1 &&
            "border-l-[3px] border-l-accent",
        )}
        style={{
          top,
          height,
          background: `${color}DD`,
          borderColor: color,
          transform: transform
            ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
            : undefined,
        }}
      >
        {compactWeek ? (
          <span
            className="mx-auto hidden max-h-full text-[8px] leading-none font-semibold whitespace-nowrap max-md:block"
            style={{ writingMode: "vertical-rl" }}
          >
            {fmtTime.format(start)} · {initials(appointment.clientName)}
          </span>
        ) : null}
        <span className={cn(compactWeek && "max-md:hidden")}>
          <span className="block text-[10px] font-medium">
            {fmtTime.format(start)}–{fmtTime.format(end)}
          </span>
          <strong className="block truncate text-[12px]">
            {appointment.clientName}
          </strong>
          <span className="block truncate text-[11px]">
            {appointment.procedure}
            {(appointment.bookingGroupCount ?? 0) > 1
              ? ` (${(appointment.bookingGroupIndex ?? 0) + 1}/${appointment.bookingGroupCount})`
              : ""}
          </span>
          {appointment.channelLabel ? (
            <span className="block truncate text-[9px] font-semibold tracking-[.06em] uppercase">
              {appointment.channelLabel}
            </span>
          ) : null}
          <span className="block truncate text-[10px] opacity-75">
            {appointment.room?.name ?? "—"}
            {appointment.device ? ` · ${appointment.device.name}` : ""}
          </span>
          {appointment.resourceWarning.length ? (
            <span className="block truncate text-[9px] font-semibold text-ink">
              {appointment.resourceWarning.join(", ")}
            </span>
          ) : null}
        </span>
      </button>
      {bufferHeight > 0 ? (
        <div
          aria-hidden="true"
          data-appointment-buffer={appointment.id}
          className="pointer-events-none absolute inset-x-[3px] z-[9] rounded-b-[4px] border-x border-b border-dashed border-line-btn bg-[repeating-linear-gradient(135deg,rgba(184,155,114,.2),rgba(184,155,114,.2)_4px,rgba(255,255,255,.7)_4px,rgba(255,255,255,.7)_8px)]"
          style={{ top: top + height, height: bufferHeight }}
        />
      ) : null}
    </>
  );
}

function TemplateChip({
  template,
  label,
  selected,
  onSelect,
}: {
  template: CalendarBlockTemplate;
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `template:${template.id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={onSelect}
      {...attributes}
      {...listeners}
      aria-pressed={selected}
      className={cn(
        "min-h-10 shrink-0 rounded-[4px] border px-3 text-left font-sans text-xs focus:ring-2 focus:ring-accent focus:outline-none lg:min-h-[34px] lg:w-full lg:px-2",
        selected && "ring-2 ring-accent",
        isDragging && "opacity-60",
      )}
      style={{
        background: `${template.color}88`,
        borderColor: template.color,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      {label}
    </button>
  );
}

function CalendarBlockCard({
  block,
  templates,
  fmtTime,
  onOpen,
  rangeStartMinute,
  hourHeight,
  compactWeek,
}: {
  block: CalendarBlock;
  templates: CalendarBlockTemplate[];
  fmtTime: Intl.DateTimeFormat;
  onOpen: (block: CalendarBlock) => void;
  rangeStartMinute: number;
  hourHeight: number;
  compactWeek: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: `block:${block.id}` });
  const start = new Date(block.start);
  const end = new Date(block.end);
  const top = ((clinicMinute(start) - rangeStartMinute) / 60) * hourHeight;
  const height = Math.max(
    28,
    ((end.getTime() - start.getTime()) / 3_600_000) * hourHeight,
  );
  const color =
    templates.find((template) => template.id === block.items[0]?.templateId)
      ?.color ?? "#B89B72";
  const label = block.items.map((item) => item.label).join(" + ");
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onOpen(block)}
      {...attributes}
      {...listeners}
      aria-label={`${fmtTime.format(start)}–${fmtTime.format(end)} · ${label}`}
      className={cn(
        "absolute inset-x-[3px] z-[11] overflow-hidden rounded-[4px] border border-dashed px-[6px] py-[3px] text-left font-sans shadow-sm focus:ring-2 focus:ring-accent focus:outline-none",
        compactWeek &&
          "max-md:inset-x-px max-md:px-px max-md:py-[2px] max-md:text-center",
        isDragging && "z-50 opacity-60",
      )}
      style={{
        top,
        height,
        background: `${color}E6`,
        borderColor: color,
        transform: transform
          ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
          : undefined,
      }}
    >
      {compactWeek ? (
        <span
          className="mx-auto hidden max-h-full text-[8px] leading-none font-semibold whitespace-nowrap max-md:block"
          style={{ writingMode: "vertical-rl" }}
        >
          {fmtTime.format(start)} · {initials(label)}
        </span>
      ) : null}
      <span className={cn(compactWeek && "max-md:hidden")}>
        <span className="block text-[10px] font-medium">
          {fmtTime.format(start)}–{fmtTime.format(end)}
        </span>
        <strong className="block truncate text-[11px]">{label}</strong>
      </span>
    </button>
  );
}

function MonthView({
  range,
  data,
  selected,
  fmtDate,
  fmtTime,
  onOpenDay,
  onOpenBlock,
}: {
  range: { from: Date; to: Date };
  data: Payload;
  selected: string[];
  fmtDate: Intl.DateTimeFormat;
  fmtTime: Intl.DateTimeFormat;
  onOpenDay: (date: string) => void;
  onOpenBlock: (block: CalendarBlock) => void;
}) {
  const days = Array.from(
    { length: 42 },
    (_, index) => new Date(range.from.getTime() + index * 86400000),
  );
  const colors = new Map(
    data.practitioners.map((item) => [item.id, item.calendarColor]),
  );
  return (
    <div className="mt-[16px] grid grid-cols-7 overflow-hidden rounded-[8px] border border-line-card bg-card">
      {days.map((day) => {
        const date = ymd(day);
        const appointments = data.appointments.filter(
          (item) =>
            clinicDateFromInstant(new Date(item.start)) === date &&
            selected.includes(item.practitionerId),
        );
        const blocks = data.blocks.filter(
          (item) =>
            clinicDateFromInstant(new Date(item.start)) === date &&
            item.practitionerIds.some((id) => selected.includes(id)),
        );
        const events = [
          ...appointments.map((appointment) => ({
            id: `a:${appointment.id}`,
            start: appointment.start,
            label: appointment.clientName,
            color: colors.get(appointment.practitionerId) ?? "#B89B72",
            block: null as CalendarBlock | null,
          })),
          ...blocks.map((block) => ({
            id: `b:${block.id}`,
            start: block.start,
            label: block.items.map((item) => item.label).join(" + "),
            color:
              data.templates.find(
                (template) => template.id === block.items[0]?.templateId,
              )?.color ?? "#B89B72",
            block,
          })),
        ].sort((a, b) => a.start.localeCompare(b.start));
        return (
          <button
            type="button"
            key={date}
            onClick={() => onOpenDay(date)}
            className="min-h-[120px] border-r border-b border-line-card p-[6px] text-left align-top hover:bg-page"
          >
            <span className="font-sans text-[11px] text-muted">
              {fmtDate.format(day)}
            </span>
            <span className="mt-[5px] grid gap-[3px]">
              {events.slice(0, 4).map((event) => (
                <span
                  key={event.id}
                  role={event.block ? "button" : undefined}
                  tabIndex={event.block ? 0 : undefined}
                  onClick={
                    event.block
                      ? (click) => {
                          click.stopPropagation();
                          onOpenBlock(event.block!);
                        }
                      : undefined
                  }
                  onKeyDown={
                    event.block
                      ? (key) => {
                          if (key.key === "Enter" || key.key === " ") {
                            key.preventDefault();
                            onOpenBlock(event.block!);
                          }
                        }
                      : undefined
                  }
                  className="block truncate rounded-[3px] px-[4px] py-[2px] font-sans text-[10px]"
                  style={{
                    background: `${event.color}55`,
                  }}
                >
                  {fmtTime.format(new Date(event.start))} {event.label}
                </span>
              ))}
              {events.length > 4 ? (
                <span className="font-sans text-[10px] text-muted">
                  +{events.length - 4} more
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
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
    <label className="block">
      <span className="mb-[6px] block font-sans text-[11px] tracking-[.08em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function workdayTimeOptions(fromMinute: number, throughMinute: number) {
  const first = Math.ceil(fromMinute / 15) * 15;
  const last = Math.floor(throughMinute / 15) * 15;
  if (first > last) return [];
  return Array.from(
    { length: Math.floor((last - first) / 15) + 1 },
    (_, index) => {
      const minute = first + index * 15;
      return {
        value: String(minute),
        label:
          minute === 24 * 60
            ? "24:00"
            : `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`,
      };
    },
  );
}

function TooltipIconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const tooltipId = useId();
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        aria-describedby={tooltipId}
        className={cn(
          iconButtonCls,
          "disabled:cursor-not-allowed disabled:opacity-35",
        )}
      >
        {children}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute top-[calc(100%+7px)] left-1/2 z-[150] -translate-x-1/2 rounded-[4px] bg-ink px-2 py-1 font-sans text-[11px] whitespace-nowrap text-page opacity-0 shadow-card transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  );
}

const buttonBaseCls =
  "inline-flex min-h-[40px] items-center justify-center rounded-[4px] border px-[12px] font-sans text-[12px]";
const buttonCls = cn(
  buttonBaseCls,
  "border-line-btn bg-card text-body hover:bg-btn-fill",
);
const employeeButtonCls =
  "inline-flex min-h-[34px] items-center justify-center rounded-[4px] border border-line-btn bg-card px-[10px] font-sans text-[11px] text-body hover:bg-btn-fill";
const activeButtonCls = cn(
  buttonBaseCls,
  "border-accent bg-btn-fill text-ink hover:bg-btn-fill",
);
const primaryButtonCls = cn(
  buttonBaseCls,
  "border-accent bg-accent text-page hover:brightness-95",
);
const iconButtonCls =
  "inline-flex size-11 items-center justify-center rounded-[4px] border border-line-btn bg-card text-ink hover:bg-btn-fill focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none";
