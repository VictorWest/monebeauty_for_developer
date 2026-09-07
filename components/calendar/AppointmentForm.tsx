"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  SpinnerGap,
} from "@phosphor-icons/react";
import { DatePicker } from "@/components/ui/CalendarPicker";
import { ThemedSelect, type SelectOption } from "@/components/ui/ThemedSelect";
import { TimePicker } from "@/components/ui/TimePicker";
import { availabilityCovers, type StaffSlot } from "@/lib/staff-schedule";
import { BUSINESS_HOURS } from "@/lib/booking-config";
import { clinicTodayYmd } from "@/lib/clinic-date";
import {
  clinicDateFromInstant,
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

type Locale = "en" | "fi" | "ru";
type Named = { id: string; name: string; workingHours?: unknown };
type Client = { id: string; fullName: string; phone: string; email: string };
type CalendarAssignment = {
  practitionerId: string;
  roomId: string;
  deviceId: string | null;
};
type Service = {
  id: string;
  title: string;
  durationMin: number;
  requiresDevice: boolean;
  qualifiedPractitionerIds: string[];
  roomIds: string[];
  deviceIds: string[];
  capabilities: Array<{
    practitionerId: string;
    roomId: string;
    deviceIds: string[];
  }>;
  procedures: Array<{
    key: string;
    index: number | null;
    title: string;
    price: string;
    durationMin: number | null;
  }>;
};
type Options = {
  services: Service[];
  practitioners: Named[];
  rooms: Named[];
  devices: Named[];
  clients: Client[];
};
export type AppointmentDetail = {
  id: string;
  version: number;
  status: string;
  client: Client & { contraindications: string | null };
  clientId: string;
  serviceId: string;
  procedureIndex: number | null;
  serviceOptionKey?: string | null;
  start: string;
  end: string;
  notes: string | null;
  practitionerId: string;
  practitionerName: string;
  roomId: string | null;
  deviceId: string | null;
  locale: Locale;
};

const copy = {
  en: {
    create: "Create appointment",
    edit: "Edit appointment",
    client: "Client",
    search: "Search clients",
    searchHint: "Enter at least 2 characters",
    searchLoading: "Searching clients…",
    searchEmpty: "No clients found",
    searchError: "Client search could not be loaded",
    addClient: "Add a new client",
    existingClient: "Choose an existing client",
    name: "Full name",
    phone: "Phone",
    email: "Email",
    service: "Service",
    procedure: "Procedure",
    employee: "Employee",
    room: "Room",
    device: "Device",
    date: "Date",
    time: "Time",
    duration: "Duration",
    notes: "Booking notes",
    language: "Notification language",
    consent: "The client has accepted the privacy notice for this booking.",
    save: "Save appointment",
    cancel: "Close",
    confirm: "Confirm",
    complete: "Complete",
    cancelAppointment: "Cancel appointment",
    reason: "Cancellation reason",
    required: "Complete the required fields and try again.",
    conflict:
      "The appointment could not be saved. Refresh and choose another time or resource.",
    unavailable: "unavailable at this time",
  },
  fi: {
    create: "Luo ajanvaraus",
    edit: "Muokkaa ajanvarausta",
    client: "Asiakas",
    search: "Hae asiakkaita",
    searchHint: "Kirjoita vähintään 2 merkkiä",
    searchLoading: "Haetaan asiakkaita…",
    searchEmpty: "Asiakkaita ei löytynyt",
    searchError: "Asiakashakua ei voitu ladata",
    addClient: "Lisää uusi asiakas",
    existingClient: "Valitse olemassa oleva asiakas",
    name: "Koko nimi",
    phone: "Puhelin",
    email: "Sähköposti",
    service: "Palvelu",
    procedure: "Toimenpide",
    employee: "Työntekijä",
    room: "Huone",
    device: "Laite",
    date: "Päivä",
    time: "Aika",
    duration: "Kesto",
    notes: "Varausmuistiinpanot",
    language: "Ilmoitusten kieli",
    consent: "Asiakas on hyväksynyt tämän varauksen tietosuojailmoituksen.",
    save: "Tallenna ajanvaraus",
    cancel: "Sulje",
    confirm: "Vahvista",
    complete: "Merkitse valmiiksi",
    cancelAppointment: "Peru ajanvaraus",
    reason: "Peruutuksen syy",
    required: "Täytä pakolliset kentät ja yritä uudelleen.",
    conflict:
      "Ajanvarausta ei voitu tallentaa. Päivitä ja valitse toinen aika tai resurssi.",
    unavailable: "ei saatavilla tähän aikaan",
  },
  ru: {
    create: "Создать запись",
    edit: "Изменить запись",
    client: "Клиент",
    search: "Поиск клиентов",
    searchHint: "Введите не менее 2 символов",
    searchLoading: "Поиск клиентов…",
    searchEmpty: "Клиенты не найдены",
    searchError: "Не удалось загрузить поиск клиентов",
    addClient: "Добавить нового клиента",
    existingClient: "Выбрать существующего клиента",
    name: "Полное имя",
    phone: "Телефон",
    email: "Эл. почта",
    service: "Услуга",
    procedure: "Процедура",
    employee: "Сотрудник",
    room: "Кабинет",
    device: "Аппарат",
    date: "Дата",
    time: "Время",
    duration: "Продолжительность",
    notes: "Примечания к записи",
    language: "Язык уведомлений",
    consent: "Клиент принял уведомление о конфиденциальности для этой записи.",
    save: "Сохранить запись",
    cancel: "Закрыть",
    confirm: "Подтвердить",
    complete: "Завершить",
    cancelAppointment: "Отменить запись",
    reason: "Причина отмены",
    required: "Заполните обязательные поля и повторите попытку.",
    conflict:
      "Не удалось сохранить запись. Обновите календарь и выберите другое время или ресурс.",
    unavailable: "недоступен в это время",
  },
} as const;

function ymd(value: string) {
  return clinicDateFromInstant(new Date(value));
}

function hm(value: string) {
  return clinicTimeFromInstant(new Date(value));
}

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function AppointmentForm({
  locale,
  initialStart,
  initialPractitionerId,
  initialDurationMin,
  detail,
  onClose,
  onSaved,
}: {
  locale: Locale;
  initialStart: string;
  initialPractitionerId: string;
  initialDurationMin?: number;
  detail?: AppointmentDetail | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = copy[locale];
  const [options, setOptions] = useState<Options | null>(null);
  const [clientId, setClientId] = useState(detail?.clientId ?? "");
  const [selectedClient, setSelectedClient] = useState<Client | null>(
    detail?.client ?? null,
  );
  const [client, setClient] = useState({
    fullName: detail?.client.fullName ?? "",
    phone: detail?.client.phone ?? "",
    email: detail?.client.email ?? "",
  });
  const [serviceId, setServiceId] = useState(detail?.serviceId ?? "");
  const [procedureIndex, setProcedureIndex] = useState(
    detail?.serviceOptionKey ?? "",
  );
  const [practitionerId, setPractitionerId] = useState(
    detail?.practitionerId ?? initialPractitionerId,
  );
  const [roomId, setRoomId] = useState(detail?.roomId ?? "");
  const [deviceId, setDeviceId] = useState(detail?.deviceId ?? "");
  const [date, setDate] = useState(ymd(detail?.start ?? initialStart));
  const [time, setTime] = useState(hm(detail?.start ?? initialStart));
  const [notificationLocale, setNotificationLocale] = useState<Locale>(
    detail?.locale ?? locale,
  );
  const [notes, setNotes] = useState(detail?.notes ?? "");
  const [consent, setConsent] = useState(Boolean(detail));
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const [availableDates, setAvailableDates] = useState<string[] | undefined>();
  const [scheduleSlots, setScheduleSlots] = useState<StaffSlot[]>([]);
  const [assignmentCandidates, setAssignmentCandidates] = useState<
    CalendarAssignment[] | null
  >(detail ? null : []);
  const [assignmentsLoading, setAssignmentsLoading] = useState(Boolean(detail));
  const roomIdRef = useRef(roomId);
  const deviceIdRef = useRef(deviceId);
  const practitionerIdRef = useRef(practitionerId);

  useEffect(() => {
    roomIdRef.current = roomId;
    deviceIdRef.current = deviceId;
    practitionerIdRef.current = practitionerId;
  }, [deviceId, practitionerId, roomId]);

  async function load(nextLocale = notificationLocale) {
    const params = new URLSearchParams({ locale: nextLocale });
    const response = await fetch(`/api/calendar/appointments?${params}`);
    if (!response.ok) throw new Error("load");
    setOptions((await response.json()) as Options);
  }

  useEffect(() => {
    const timer = window.setTimeout(
      () => void load().catch(() => setMessage(t.conflict)),
      0,
    );
    return () => window.clearTimeout(timer);
    // Initial option load only; searches and locale changes are explicit actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!practitionerId) return;
    const from = clinicTodayYmd();
    const to = addDays(from, BUSINESS_HOURS.daysAhead);
    let live = true;
    fetch(
      `/api/staff/schedule?from=${from}&to=${to}&practitionerId=${encodeURIComponent(practitionerId)}`,
    )
      .then((response) => response.json())
      .then((payload) => {
        if (live)
          setAvailableDates(
            Array.isArray(payload.dates) ? payload.dates : undefined,
          );
      })
      .catch(() => {
        if (live) setAvailableDates(undefined);
      });
    return () => {
      live = false;
    };
  }, [practitionerId]);

  useEffect(() => {
    if (!practitionerId || !date) return;
    let live = true;
    const params = new URLSearchParams({ date, practitionerId });
    if (detail?.id) params.set("excludeId", detail.id);
    fetch(`/api/staff/schedule?${params}`)
      .then((response) => response.json())
      .then((payload) => {
        if (live)
          setScheduleSlots(Array.isArray(payload.slots) ? payload.slots : []);
      })
      .catch(() => {
        if (live) setScheduleSlots([]);
      });
    return () => {
      live = false;
    };
  }, [date, detail?.id, practitionerId]);

  useEffect(() => {
    if (!detail) return;
    let live = true;
    const timer = window.setTimeout(() => {
      const start = clinicDateTimeToInstant(date, time);
      if (!serviceId || !start) {
        setAssignmentCandidates([]);
        setAssignmentsLoading(false);
        return;
      }
      const params = new URLSearchParams({
        serviceId,
        start: start.toISOString(),
        excludeAppointmentId: detail.id,
      });
      setAssignmentsLoading(true);
      setAssignmentCandidates(null);
      fetch(`/api/calendar/assignments?${params}`)
        .then(async (response) => {
          if (!response.ok) throw new Error("assignments");
          return (await response.json()) as {
            assignments?: CalendarAssignment[];
          };
        })
        .then((payload) => {
          if (!live) return;
          const assignments = Array.isArray(payload.assignments)
            ? payload.assignments
            : [];
          setAssignmentCandidates(assignments);
          const currentAssignments = assignments.filter(
            (assignment) =>
              assignment.practitionerId === practitionerIdRef.current,
          );
          const preserved = currentAssignments.find(
            (assignment) =>
              assignment.roomId === roomIdRef.current &&
              assignment.deviceId === (deviceIdRef.current || null),
          );
          const next = preserved ?? currentAssignments[0];
          if (next) {
            setRoomId(next.roomId);
            setDeviceId(next.deviceId ?? "");
          }
        })
        .catch(() => {
          if (live) setAssignmentCandidates([]);
        })
        .finally(() => {
          if (live) setAssignmentsLoading(false);
        });
    }, 0);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [date, detail, serviceId, time]);

  const selectedService = options?.services.find(
    (item) => item.id === serviceId,
  );
  const availableEmployeeIds = new Set(
    assignmentCandidates?.map((item) => item.practitionerId) ?? [],
  );
  const employees =
    options?.practitioners.filter((item) =>
      detail
        ? availableEmployeeIds.has(item.id)
        : selectedService?.qualifiedPractitionerIds.includes(item.id),
    ) ?? [];
  const employeeOptions: SelectOption[] = employees.map((item) => ({
    value: item.id,
    label: item.name,
  }));
  if (
    detail &&
    practitionerId === detail.practitionerId &&
    !availableEmployeeIds.has(detail.practitionerId)
  ) {
    employeeOptions.push({
      value: detail.practitionerId,
      label: `${detail.practitionerName} (${t.unavailable})`,
      disabled: true,
    });
  }
  const rooms =
    options?.rooms.filter((item) =>
      detail
        ? assignmentCandidates?.some(
            (assignment) =>
              assignment.practitionerId === practitionerId &&
              assignment.roomId === item.id,
          )
        : selectedService?.capabilities.some(
            (capability) =>
              capability.practitionerId === practitionerId &&
              capability.roomId === item.id,
          ),
    ) ?? [];
  const devices =
    options?.devices.filter((item) =>
      detail
        ? assignmentCandidates?.some(
            (assignment) =>
              assignment.practitionerId === practitionerId &&
              assignment.roomId === roomId &&
              assignment.deviceId === item.id,
          )
        : selectedService?.capabilities.some(
            (capability) =>
              capability.practitionerId === practitionerId &&
              capability.roomId === roomId &&
              capability.deviceIds.includes(item.id),
          ),
    ) ?? [];
  const selectedDuration = selectedService?.durationMin ?? 0;
  const appointmentDuration =
    !detail && initialDurationMin ? initialDurationMin : selectedDuration;
  const timeOptions = (() => {
    const duration = appointmentDuration;
    if (!duration) return [];
    return scheduleSlots
      .filter((slot) => slot.status === "open")
      .filter((slot) => {
        const start = new Date(slot.start);
        const end = new Date(start.getTime() + duration * 60000);
        return (
          start.getTime() > openedAt &&
          availabilityCovers(scheduleSlots, start, end)
        );
      })
      .map((slot) => {
        const value = hm(slot.start);
        return { value, label: value };
      });
  })();

  function pickService(value: string) {
    const next = options?.services.find((item) => item.id === value);
    setServiceId(value);
    setProcedureIndex("");
    setTime("");
    if (next && !next.qualifiedPractitionerIds.includes(practitionerId))
      setPractitionerId(next.qualifiedPractitionerIds[0] ?? "");
    const practitioner = next?.qualifiedPractitionerIds.includes(practitionerId)
      ? practitionerId
      : (next?.qualifiedPractitionerIds[0] ?? "");
    const capability = next?.capabilities.find(
      (item) => item.practitionerId === practitioner,
    );
    setRoomId(capability?.roomId ?? "");
    setDeviceId(capability?.deviceIds[0] ?? "");
  }

  function clearSelectedClient() {
    setSelectedClient(null);
    setClientId("");
    setClient({ fullName: "", phone: "", email: "" });
  }

  async function save() {
    if (
      !serviceId ||
      !practitionerId ||
      !roomId ||
      !timeOptions.some((option) => option.value === time) ||
      !client.fullName.trim() ||
      !client.phone.trim() ||
      !client.email.trim() ||
      (!detail && !consent)
    ) {
      setMessage(t.required);
      return;
    }
    setSaving(true);
    setMessage(null);
    const start = clinicDateTimeToInstant(date, time)?.toISOString();
    if (!start) {
      setSaving(false);
      setMessage(t.required);
      return;
    }
    const response = await fetch(
      detail
        ? `/api/calendar/appointments/${detail.id}`
        : "/api/calendar/appointments",
      {
        method: detail ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(detail ? { intent: "details", version: detail.version } : {}),
          clientId: clientId || undefined,
          contact: client,
          serviceId,
          option: procedureIndex || null,
          practitionerId,
          roomId,
          deviceId: deviceId || null,
          start,
          notes,
          locale: notificationLocale,
          consentGdpr: consent,
          ...(!detail && initialDurationMin
            ? { durationMin: initialDurationMin }
            : {}),
        }),
      },
    );
    setSaving(false);
    if (!response.ok) {
      setMessage(t.conflict);
      return;
    }
    await onSaved();
    onClose();
  }

  async function lifecycle(intent: "confirm" | "complete" | "cancel") {
    if (!detail) return;
    if (intent === "cancel" && reason.trim().length < 3) {
      setMessage(t.required);
      return;
    }
    setSaving(true);
    const response = await fetch(`/api/calendar/appointments/${detail.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intent, version: detail.version, reason }),
    });
    setSaving(false);
    if (!response.ok) {
      setMessage(t.conflict);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-ink/35 p-[10px] sm:items-center"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="appointment-form-title"
        className="max-h-[94vh] w-full max-w-[760px] overflow-y-auto rounded-[10px] border border-line-card bg-card p-[clamp(18px,3vw,28px)] shadow-card"
      >
        <h2
          id="appointment-form-title"
          className="font-display text-[32px] font-medium"
        >
          {detail ? t.edit : t.create}
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <span className="mb-1.5 block font-sans text-[11px] tracking-[.08em] text-muted uppercase">
              {t.client}
            </span>
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
              <ClientCombobox
                locale={notificationLocale}
                selected={selectedClient}
                initialClients={options?.clients ?? []}
                active={Boolean(selectedClient)}
                labels={{
                  trigger: t.existingClient,
                  search: t.search,
                  hint: t.searchHint,
                  loading: t.searchLoading,
                  empty: t.searchEmpty,
                  error: t.searchError,
                }}
                onSelect={(next) => {
                  setSelectedClient(next);
                  setClientId(next.id);
                  setClient({
                    fullName: next.fullName,
                    phone: next.phone,
                    email: next.email,
                  });
                }}
                onClear={clearSelectedClient}
              />
              {!detail ? (
                <button
                  type="button"
                  className={!selectedClient ? activeButton : button}
                  onClick={clearSelectedClient}
                >
                  {t.addClient}
                </button>
              ) : null}
            </div>
          </div>
          <Field label={t.name}>
            <input
              className={input}
              value={client.fullName}
              onChange={(event) =>
                setClient({ ...client, fullName: event.target.value })
              }
            />
          </Field>
          <Field label={t.phone}>
            <input
              className={input}
              value={client.phone}
              onChange={(event) =>
                setClient({ ...client, phone: event.target.value })
              }
            />
          </Field>
          <Field label={t.email} wide>
            <input
              className={input}
              type="email"
              value={client.email}
              onChange={(event) =>
                setClient({ ...client, email: event.target.value })
              }
            />
          </Field>
          <Field label={t.service}>
            <ThemedSelect
              value={serviceId}
              onValueChange={pickService}
              options={(options?.services ?? []).map((item) => ({
                value: item.id,
                label: item.title,
              }))}
            />
          </Field>
          <Field label={t.procedure}>
            <ThemedSelect
              value={procedureIndex}
              onValueChange={setProcedureIndex}
              options={[
                { value: "", label: "—" },
                ...(selectedService?.procedures ?? []).map((item) => ({
                  value: item.key,
                  label: `${item.title} · ${item.price}`,
                })),
              ]}
            />
          </Field>
          <Field label={t.employee}>
            <ThemedSelect
              value={practitionerId}
              onValueChange={(value) => {
                setPractitionerId(value);
                const candidates = assignmentCandidates?.filter(
                  (item) => item.practitionerId === value,
                );
                const preserved = candidates?.find(
                  (item) =>
                    item.roomId === roomId &&
                    item.deviceId === (deviceId || null),
                );
                const assignment = preserved ?? candidates?.[0];
                if (detail) {
                  setRoomId(assignment?.roomId ?? "");
                  setDeviceId(assignment?.deviceId ?? "");
                } else {
                  const capability = selectedService?.capabilities.find(
                    (item) => item.practitionerId === value,
                  );
                  setRoomId(capability?.roomId ?? "");
                  setDeviceId(capability?.deviceIds[0] ?? "");
                  setTime("");
                }
              }}
              options={employeeOptions}
              disabled={Boolean(detail && assignmentsLoading)}
            />
          </Field>
          <Field label={t.room}>
            <ThemedSelect
              value={roomId}
              onValueChange={(value) => {
                setRoomId(value);
                if (detail) {
                  const candidates = assignmentCandidates?.filter(
                    (item) =>
                      item.practitionerId === practitionerId &&
                      item.roomId === value,
                  );
                  const preserved = candidates?.find(
                    (item) => item.deviceId === (deviceId || null),
                  );
                  setDeviceId((preserved ?? candidates?.[0])?.deviceId ?? "");
                } else {
                  const capability = selectedService?.capabilities.find(
                    (item) =>
                      item.practitionerId === practitionerId &&
                      item.roomId === value,
                  );
                  setDeviceId(capability?.deviceIds[0] ?? "");
                }
              }}
              options={rooms.map((item) => ({
                value: item.id,
                label: item.name,
              }))}
            />
          </Field>
          {selectedService?.requiresDevice ? (
            <Field label={t.device}>
              <ThemedSelect
                value={deviceId}
                onValueChange={setDeviceId}
                options={devices.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Field>
          ) : null}
          <Field label={t.date}>
            <DatePicker
              locale={locale}
              value={date}
              onValueChange={(value) => {
                setDate(value);
                setTime("");
              }}
              ariaLabel={t.date}
              min={clinicTodayYmd()}
              max={addDays(clinicTodayYmd(), BUSINESS_HOURS.daysAhead)}
              availableDates={availableDates}
            />
          </Field>
          <Field label={t.time}>
            <TimePicker
              value={time}
              onValueChange={setTime}
              options={timeOptions}
              ariaLabel={t.time}
              disabled={
                !serviceId || !practitionerId || timeOptions.length === 0
              }
            />
          </Field>
          {initialDurationMin && !detail ? (
            <Field label={t.duration}>
              <div className={`${input} flex items-center`}>
                {initialDurationMin} min
              </div>
            </Field>
          ) : null}
          <Field label={t.language}>
            <ThemedSelect
              value={notificationLocale}
              onValueChange={(value) => {
                const next = value as Locale;
                setNotificationLocale(next);
                setServiceId("");
                setProcedureIndex("");
                void load(next).catch(() => setMessage(t.conflict));
              }}
              options={[
                { value: "fi", label: "Suomi" },
                { value: "en", label: "English" },
                { value: "ru", label: "Русский" },
              ]}
            />
          </Field>
          <Field label={t.notes} wide>
            <textarea
              className={`${input} min-h-[90px] py-2`}
              value={notes}
              maxLength={2000}
              onChange={(event) => setNotes(event.target.value)}
            />
          </Field>
          {!detail ? (
            <label className="flex items-start gap-3 sm:col-span-2">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-accent"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span className="font-sans text-sm text-body">{t.consent}</span>
            </label>
          ) : null}
        </div>
        {detail?.client.contraindications ? (
          <p className="mt-4 rounded border border-[#c98383] bg-[#fff4f2] p-3 font-sans text-sm">
            <strong>Contraindication warning:</strong>{" "}
            {detail.client.contraindications}
          </p>
        ) : null}
        {message ? (
          <p
            role="status"
            className="mt-4 rounded border border-line-btn bg-btn-fill p-3 font-sans text-sm"
          >
            {message}
          </p>
        ) : null}
        {detail ? (
          <div className="mt-5 border-t border-line-hair pt-4">
            <div className="flex flex-wrap gap-2">
              {["BOOKED", "RESCHEDULED"].includes(detail.status) ? (
                <button
                  type="button"
                  disabled={saving}
                  className={button}
                  onClick={() => void lifecycle("confirm")}
                >
                  {t.confirm}
                </button>
              ) : null}
              <button
                type="button"
                disabled={saving}
                className={button}
                onClick={() => void lifecycle("complete")}
              >
                {t.complete}
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className={input}
                value={reason}
                placeholder={t.reason}
                onChange={(event) => setReason(event.target.value)}
              />
              <button
                type="button"
                disabled={saving}
                className="min-h-[44px] rounded border border-[#a34f4f] px-3 font-sans text-xs text-[#8c3434]"
                onClick={() => void lifecycle("cancel")}
              >
                {t.cancelAppointment}
              </button>
            </div>
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className={button} onClick={onClose}>
            {t.cancel}
          </button>
          <button
            type="button"
            disabled={saving || assignmentsLoading}
            className={primaryButton}
            onClick={() => void save()}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}

function ClientCombobox({
  locale,
  selected,
  initialClients,
  active,
  labels,
  onSelect,
  onClear,
}: {
  locale: Locale;
  selected: Client | null;
  initialClients: Client[];
  active?: boolean;
  labels: {
    trigger: string;
    search: string;
    hint: string;
    loading: string;
    empty: string;
    error: string;
  };
  onSelect: (client: Client) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const showingInitial = query.trim().length < 2;
  const visibleResults = showingInitial ? initialClients : results;
  const visibleStatus = showingInitial ? "ready" : status;

  function close() {
    setOpen(false);
    setQuery("");
    setResults([]);
    setStatus("idle");
  }

  function openList() {
    setResults(initialClients);
    setStatus("ready");
    setOpen(true);
  }

  useEffect(() => {
    function dismiss(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        close();
    }
    document.addEventListener("mousedown", dismiss);
    return () => document.removeEventListener("mousedown", dismiss);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (!open || normalized.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const params = new URLSearchParams({ locale, q: normalized });
        const response = await fetch(`/api/calendar/appointments?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("client_search");
        const payload = (await response.json()) as { clients?: Client[] };
        setResults(Array.isArray(payload.clients) ? payload.clients : []);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResults([]);
        setStatus("error");
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, open, query]);

  function choose(client: Client) {
    onSelect(client);
    close();
    window.requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLButtonElement>("[data-client-trigger]")
        ?.focus(),
    );
  }

  function onOptionKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      window.requestAnimationFrame(() =>
        rootRef.current
          ?.querySelector<HTMLButtonElement>("[data-client-trigger]")
          ?.focus(),
      );
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next =
        (index + direction + visibleResults.length) % visibleResults.length;
      optionRefs.current[next]?.focus();
    }
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        data-client-trigger
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) close();
          else openList();
        }}
        onKeyDown={(event) => {
          if (
            (event.key === "Backspace" || event.key === "Delete") &&
            selected
          ) {
            event.preventDefault();
            onClear();
            return;
          }
          if (["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openList();
          }
        }}
        className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[4px] border bg-page px-3 text-left font-sans text-sm outline-none focus:border-accent ${active ? "border-accent bg-btn-fill" : "border-line-btn"}`}
      >
        <span className="min-w-0 truncate">
          {selected?.fullName ?? labels.trigger}
        </span>
        <CaretDown
          size={15}
          weight="regular"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-[120] w-full min-w-[300px] overflow-hidden rounded-[7px] border border-line-card bg-card shadow-card">
          <label className="flex items-center gap-2 border-b border-line-hair px-3">
            <MagnifyingGlass
              size={17}
              weight="regular"
              className="text-muted"
            />
            <input
              autoFocus
              type="search"
              value={query}
              aria-label={labels.search}
              placeholder={labels.search}
              onChange={(event) => {
                const next = event.target.value;
                setQuery(next);
                if (next.trim().length < 2) {
                  setResults(initialClients);
                  setStatus("ready");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Backspace" && !query && selected) {
                  event.preventDefault();
                  onClear();
                  setResults(initialClients);
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                }
                if (event.key === "ArrowDown" && visibleResults.length) {
                  event.preventDefault();
                  optionRefs.current[0]?.focus();
                }
              }}
              className="min-h-[44px] min-w-0 flex-1 bg-transparent font-sans text-sm text-ink outline-none placeholder:text-muted"
            />
          </label>
          <div
            role="listbox"
            aria-label={labels.trigger}
            className="max-h-[280px] overflow-y-auto p-1.5"
          >
            {visibleStatus === "loading" ? (
              <p
                role="status"
                className="flex items-center gap-2 px-3 py-3 font-sans text-sm text-muted"
              >
                <SpinnerGap size={16} className="animate-spin" />
                {labels.loading}
              </p>
            ) : null}
            {visibleStatus === "idle" ? (
              <p className="px-3 py-3 font-sans text-sm text-muted">
                {labels.hint}
              </p>
            ) : null}
            {visibleStatus === "error" ? (
              <p
                role="alert"
                className="px-3 py-3 font-sans text-sm text-[#8c3434]"
              >
                {labels.error}
              </p>
            ) : null}
            {visibleStatus === "ready" && !visibleResults.length ? (
              <p className="px-3 py-3 font-sans text-sm text-muted">
                {labels.empty}
              </p>
            ) : null}
            {visibleStatus === "ready"
              ? visibleResults.map((client, index) => {
                  const isSelected = selected?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      ref={(element) => {
                        optionRefs.current[index] = element;
                      }}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(client)}
                      onKeyDown={(event) => onOptionKeyDown(event, index)}
                      className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-[4px] px-3 py-2 text-left font-sans hover:bg-page focus:bg-page focus:outline-none ${isSelected ? "bg-btn-fill text-accent" : "text-body"}`}
                    >
                      <span className="min-w-0">
                        <strong className="block truncate text-sm font-medium text-ink">
                          {client.fullName}
                        </strong>
                        <span className="block truncate text-xs text-muted">
                          {[client.phone, client.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      {isSelected ? <Check size={15} weight="bold" /> : null}
                    </button>
                  );
                })
              : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "block sm:col-span-2" : "block"}>
      <span className="mb-1.5 block font-sans text-[11px] tracking-[.08em] text-muted uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

const input =
  "min-h-[44px] w-full rounded-[4px] border border-line-btn bg-page px-3 font-sans text-sm text-ink outline-none focus:border-accent";
const button =
  "inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-line-btn bg-card px-3 font-sans text-xs tracking-[.06em] uppercase";
const activeButton = `${button} border-accent bg-btn-fill`;
const primaryButton =
  "inline-flex min-h-[44px] items-center justify-center rounded-[4px] border border-accent bg-accent px-4 font-sans text-xs tracking-[.06em] text-page uppercase disabled:opacity-50";
