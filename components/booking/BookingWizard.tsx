"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
  CheckCircle,
  Phone,
  EnvelopeSimple,
} from "@phosphor-icons/react";
import { ButtonAction } from "@/components/ui/Button";
import { BookingCalendar } from "@/components/booking/BookingCalendar";
import { BookingCartBar } from "@/components/booking/BookingCartBar";
import { TimePicker } from "@/components/ui/TimePicker";
import { cn } from "@/lib/cn";
import { Link, useRouter } from "@/i18n/navigation";
import {
  BOOKING_HANDOFF_KEY,
  isValidPreferredDate,
  parseBookingHandoff,
} from "@/lib/booking-handoff";
import type {
  BookingContext,
  BookingProcedureContext,
  BookingServiceOption,
} from "@/lib/booking-context";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import { BUSINESS_HOURS, MAX_GROUP_PROCEDURES } from "@/lib/booking-config";
import { clinicTodayYmd } from "@/lib/clinic-date";
import { DatePicker } from "@/components/ui/CalendarPicker";
import type {
  BookingConsultationConfig,
  ConsultationAnswer,
  SavedConsultationAnswers,
} from "@/lib/consultation-types";
import type { PublicManagedImage } from "@/lib/site-media";

type Slot = {
  start: string;
  label: string;
};
type Specialist = { id: string; name: string };
type Fallback = {
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
};
type CancellationPolicyNotice = {
  text: string;
  linkLabel: string;
  href: string;
};

type ConsultationState = {
  dateOfBirth: string;
  answers: Record<string, ConsultationAnswer>;
  healthConsent: boolean;
  accuracyAcknowledged: boolean;
};

/** Treatment -> Date -> Specialist -> Time -> You/Confirm. */
type Step = 1 | 2 | 3 | 4 | 5;

function addDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** `option=key` for a single procedure, `options=a,b,c` for a multi-procedure cart. */
function optionQueryPart(optionKeys: string[]) {
  return optionKeys.length > 1
    ? `options=${encodeURIComponent(optionKeys.join(","))}`
    : `option=${encodeURIComponent(optionKeys[0] ?? "")}`;
}

function optionUrlQuery(optionKeys: string[]) {
  return optionKeys.length > 1
    ? { options: optionKeys.join(",") }
    : { option: optionKeys[0] ?? "" };
}

export function BookingWizard({
  services,
  initialContext,
  initialSpecialistId,
  fallback,
  initialDetails,
  verifiedEmail,
  clientSignedIn,
  consultationCurrent,
  consultationConfig,
  savedConsultation,
  consultationAvailable,
  profileHref,
  procedureConsent,
  offerLoginHref,
  offerRegisterHref,
  cancellationPolicy,
  genderImages,
}: {
  services: BookingServiceOption[];
  initialContext?: BookingContext;
  initialSpecialistId?: string;
  fallback: Fallback;
  initialDetails?: { fullName: string; phone: string; email: string };
  verifiedEmail?: boolean;
  clientSignedIn: boolean;
  consultationCurrent: boolean;
  consultationConfig: BookingConsultationConfig | null;
  savedConsultation: SavedConsultationAnswers | null;
  consultationAvailable: boolean;
  profileHref: string;
  procedureConsent: { version: number; wording: string };
  offerLoginHref: string;
  offerRegisterHref: string;
  cancellationPolicy: CancellationPolicyNotice;
  genderImages: { women: PublicManagedImage; men: PublicManagedImage };
}) {
  const t = useTranslations("Booking");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialService = initialContext?.service.key;
  const initialOption = initialContext?.procedure ?? null;
  const initialMultiProcedure = Boolean(
    initialContext?.service.multiProcedureBooking,
  );
  // Whether the deep-linked service actually has anything else to choose —
  // a service with only one bookable option has nothing to pick between, so
  // a deep link into it still goes straight through to Date as before.
  const initialHasOptions = (initialContext?.service.options.length ?? 0) > 1;
  // A "Book now" deep link into one specific procedure of a service that
  // has other options lands on the options step with that procedure already
  // selected/highlighted, not straight on Date — into the cart for a
  // multi-procedure service (so more can be added), or just pre-highlighted
  // for an ordinary single-select service (so it can still be swapped for a
  // different option before moving on).
  const initialCart =
    initialOption && initialMultiProcedure && initialHasOptions
      ? [initialOption]
      : [];

  const [step, setStep] = useState<Step>(
    initialOption && !initialHasOptions ? 2 : 1,
  );
  const [service, setService] = useState<string | null>(initialService ?? null);
  // Mandatory first choice, before treatment selection — always asked here,
  // even when arriving via a "Book now" link that already preselects a
  // service/procedure, so every entry into booking (from any category page,
  // not only the main booking page) goes through it. The preselected
  // service/procedure/cart is unaffected and simply waits behind this step.
  const [gender, setGender] = useState<"WOMEN" | "MEN" | null>(null);
  const [procedure, setProcedure] = useState<BookingProcedureContext | null>(
    initialCart.length ? null : initialOption,
  );
  // A multi-procedure cart (several options from one service, one visit) —
  // only ever populated for services with multiProcedureBooking on. A cart
  // of exactly one item behaves identically to picking that one `procedure`
  // directly; only cart.length > 1 actually takes the group booking path.
  const [cart, setCart] =
    useState<BookingServiceOption["options"]>(initialCart);
  const [confirmedGroup, setConfirmedGroup] = useState<Array<{
    title: string;
    price: string | null;
    durationMin: number;
  }> | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  const [specialist, setSpecialist] = useState<Specialist | null>(null);
  const [specialistsLoading, setSpecialistsLoading] = useState(false);
  const [specialistsDegraded, setSpecialistsDegraded] = useState(false);

  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsDegraded, setSlotsDegraded] = useState(false);
  const [datesLoading, setDatesLoading] = useState(Boolean(initialService));
  const [datesDegraded, setDatesDegraded] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[] | undefined>();

  const [form, setForm] = useState({
    fullName: initialDetails?.fullName ?? "",
    phone: initialDetails?.phone ?? "",
    email: initialDetails?.email ?? "",
    notes: "",
  });
  const [consent, setConsent] = useState(false);
  const [procedureAcknowledged, setProcedureAcknowledged] = useState(false);
  const [consultation, setConsultation] = useState(() => ({
    dateOfBirth: savedConsultation?.dateOfBirth ?? "",
    answers: savedConsultation?.answers ?? {},
    healthConsent: false,
    accuracyAcknowledged: false,
  }));
  const [submitting, setSubmitting] = useState(false);
  const [resolvingSpecialist, setResolvingSpecialist] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    id: string;
    start: string;
    manageUrl?: string;
  } | null>(null);
  const slotsRequest = useRef<AbortController | null>(null);
  const datesRequest = useRef<AbortController | null>(null);
  const didSyncOnce = useRef(false);
  const procedureKey = procedure?.key;
  const specialistId = specialist?.id;
  const consultationRequired = !clientSignedIn || !consultationCurrent;
  const groupOptions = cart.length > 1 ? cart : null;
  const activeOptionKeys = groupOptions
    ? groupOptions.map((option) => option.key)
    : procedureKey
      ? [procedureKey]
      : [];
  const activeOptionKey = activeOptionKeys.join(",");
  const groupTotalDuration = groupOptions
    ? groupOptions.reduce((sum, option) => sum + option.durationMin, 0)
    : null;

  const dateTimeFmt = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Helsinki",
  });

  const loadSlots = useCallback(
    async (
      d: string,
      svc: string,
      optionKeys: string[],
      specialistId: string,
      background = false,
    ) => {
      slotsRequest.current?.abort();
      const controller = new AbortController();
      slotsRequest.current = controller;
      if (!background) {
        setSlotsLoading(true);
        setSlotsDegraded(false);
        setSlots([]);
      }
      try {
        const res = await fetch(
          `/api/booking/slots?date=${encodeURIComponent(d)}&service=${encodeURIComponent(svc)}&${optionQueryPart(optionKeys)}&specialist=${encodeURIComponent(specialistId)}&locale=${encodeURIComponent(locale)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!res.ok) throw new Error("slots_unavailable");
        const data = await res.json();
        const nextSlots = Array.isArray(data.slots)
          ? (data.slots as Slot[])
          : [];
        setSlots(nextSlots);
        setSlotsDegraded(Boolean(data.degraded));
        setSlot((current) => {
          if (
            current &&
            !nextSlots.some((candidate) => candidate.start === current.start)
          ) {
            setStep(4);
            setError(t("errors.slotTaken"));
            return null;
          }
          return current;
        });
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        setSlotsDegraded(true);
      } finally {
        if (slotsRequest.current === controller) {
          slotsRequest.current = null;
          setSlotsLoading(false);
        }
      }
    },
    [locale, t],
  );

  const loadAvailableDates = useCallback(
    async (
      svc: string,
      optionKeys: string[],
      specialistId: string,
      background = false,
    ) => {
      datesRequest.current?.abort();
      const controller = new AbortController();
      datesRequest.current = controller;
      if (!background) {
        setDatesLoading(true);
        setDatesDegraded(false);
        setAvailableDates(undefined);
      }
      const from = clinicTodayYmd();
      const to = addDays(from, BUSINESS_HOURS.daysAhead);
      try {
        const response = await fetch(
          `/api/booking/availability?from=${from}&to=${to}&service=${encodeURIComponent(svc)}&${optionQueryPart(optionKeys)}&specialist=${encodeURIComponent(specialistId)}&locale=${encodeURIComponent(locale)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok || payload.degraded || !Array.isArray(payload.dates)) {
          throw new Error("availability_unavailable");
        }
        const dates = payload.dates as string[];
        setAvailableDates(dates);
        setDatesDegraded(false);
        setDate((current) =>
          current && !dates.includes(current) ? null : current,
        );
        setSlot((current) =>
          current && !dates.includes(current.start.slice(0, 10))
            ? null
            : current,
        );
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === "AbortError")
          return;
        if (!background) {
          setAvailableDates(undefined);
          setDatesDegraded(true);
        }
      } finally {
        if (datesRequest.current === controller) {
          datesRequest.current = null;
          setDatesLoading(false);
        }
      }
    },
    [locale],
  );

  const loadSpecialistsForDate = useCallback(
    async (
      svc: string,
      optionKeys: string[],
      dateStr: string,
      preferredId?: string,
    ) => {
      setSpecialistsLoading(true);
      setSpecialistsDegraded(false);
      setSpecialists([]);
      setSpecialist(null);
      try {
        const response = await fetch(
          `/api/booking/specialists?service=${encodeURIComponent(svc)}&${optionQueryPart(optionKeys)}&date=${encodeURIComponent(dateStr)}&locale=${encodeURIComponent(locale)}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok || !Array.isArray(payload.specialists))
          throw new Error("specialists_unavailable");
        const available = payload.specialists as Specialist[];
        const withAny =
          available.length >= 2
            ? [{ id: "any", name: t("anySpecialist") }, ...available]
            : available;
        setSpecialists(withAny);
        const preferred = withAny.find((item) => item.id === preferredId);
        if (preferred || available.length === 1) {
          const selected = preferred ?? available[0];
          setSpecialist(selected);
          setStep(4);
          if (selected.id !== preferredId) {
            // Fills in the specialist the date pick already resolved to —
            // same history entry as the date pick, not a new back-stop.
            router.replace({
              pathname: PUBLIC_PATHS.booking,
              query: {
                service: svc,
                ...optionUrlQuery(optionKeys),
                date: dateStr,
                specialist: selected.id,
              },
            });
          }
          void loadSlots(dateStr, svc, optionKeys, selected.id);
        } else {
          setStep(3);
        }
      } catch {
        setSpecialistsDegraded(true);
        setStep(3);
      } finally {
        setSpecialistsLoading(false);
      }
    },
    [locale, router, t, loadSlots],
  );

  useEffect(
    () => () => {
      slotsRequest.current?.abort();
      datesRequest.current?.abort();
    },
    [],
  );

  // Keep the currently viewed time slot fresh while the client sits on the
  // Time or You/Confirm step, so a slot taken by someone else is caught
  // before submission.
  useEffect(() => {
    if (!service || !activeOptionKeys.length || !specialistId || !date || confirmation)
      return;
    const refresh = () => {
      if (document.hidden) return;
      void loadSlots(date, service, activeOptionKeys, specialistId, true);
    };
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.clearInterval(timer);
    };
    // activeOptionKey (joined string) stands in for activeOptionKeys so this
    // doesn't re-run on every render from a new array reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [confirmation, date, loadSlots, activeOptionKey, service, specialistId]);

  // The URL (service/option/date/specialist) is the single source of truth
  // for how far into the wizard the client is — this both resolves a fresh
  // deep link on first mount and, critically, resyncs the on-screen step
  // when the browser's Back/Forward buttons change the URL without going
  // through any of the pick* functions below. Those functions push a new
  // history entry and set state together, so when they run this effect sees
  // matching state and does nothing.
  useEffect(() => {
    const urlService = searchParams.get("service");
    const urlOption = searchParams.get("option");
    const urlOptionsParam = searchParams.get("options");
    const urlOptions = urlOptionsParam?.split(",").filter(Boolean);
    const urlDate = searchParams.get("date");
    const urlSpecialist = searchParams.get("specialist");
    const urlOptionKey =
      urlOptions && urlOptions.length > 1 ? urlOptions.join(",") : urlOption;

    // First run only: state was seeded from server-rendered initialContext,
    // which can already equal the URL without any client fetch having
    // happened yet (e.g. a deep link straight to a procedure) — so the
    // match check below must not short-circuit that case. On every later
    // run, a match means our own push/replace just fired this effect as an
    // echo, and there is genuinely nothing left to do.
    const isFirstRun = !didSyncOnce.current;
    didSyncOnce.current = true;
    if (
      !isFirstRun &&
      urlService === service &&
      urlOptionKey === (activeOptionKey || null) &&
      urlDate === date &&
      urlSpecialist === (specialistId ?? null)
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (!urlService) {
        setService(null);
        setProcedure(null);
        setCart([]);
        setDate(null);
        setSlot(null);
        setSlots([]);
        setSpecialist(null);
        setSpecialists([]);
        setStep(1);
        return;
      }

      const svc = services.find((item) => item.key === urlService);
      if (!svc) return;

      // A multi-procedure cart in the URL takes precedence over a single
      // `option` — the two are never both meaningfully present at once.
      const group =
        urlOptions && urlOptions.length > 1
          ? svc.options.filter((item) => urlOptions.includes(item.key))
          : null;
      if (group && group.length !== urlOptions!.length) return;
      const option =
        !group && urlOption
          ? svc.options.find((item) => item.key === urlOption)
          : undefined;
      if (!group && urlOption && !option) return;

      setService(urlService);
      setSlot(null);
      setSlots([]);

      if (!group && !option) {
        setProcedure(null);
        setCart([]);
        setDate(null);
        setSpecialist(null);
        setSpecialists([]);
        setStep(1);
        return;
      }

      const optionKeys = group ? group.map((item) => item.key) : [option!.key];

      // A fresh deep link ("Book now" on a treatment page) into one specific
      // procedure of a service that has other options stops at the options
      // step with that procedure already selected/highlighted, instead of
      // jumping straight to Date — into the cart when the service is
      // multi-procedure (so more can be added), otherwise just
      // pre-highlighted in the ordinary single-select list (so it can still
      // be swapped before moving on). A service with only one bookable
      // option has nothing to choose between, so it still goes straight
      // through as before. Once the client has moved past this step (any
      // urlDate present, or this is just an echo of our own push), the
      // normal handling below applies as usual.
      if (
        isFirstRun &&
        !group &&
        option &&
        !urlDate &&
        svc.options.length > 1
      ) {
        if (svc.multiProcedureBooking) {
          setCart([option]);
          setProcedure(null);
        } else {
          setCart([]);
          setProcedure({ ...option, description: "" });
        }
        setDate(null);
        setSpecialist(null);
        setSpecialists([]);
        setStep(1);
        return;
      }

      setCart(group ?? []);
      setProcedure(group ? null : { ...option!, description: "" });

      if (!urlDate) {
        setDate(null);
        setSpecialist(null);
        setSpecialists([]);
        setStep(2);
        void loadAvailableDates(urlService, optionKeys, "any");
        return;
      }

      setDate(urlDate);
      setStep(urlSpecialist ? 4 : 3);
      void loadSpecialistsForDate(
        urlService,
        optionKeys,
        urlDate,
        urlSpecialist ?? undefined,
      );
    }, 0);
    return () => window.clearTimeout(timer);
    // Only the URL drives this effect — our own pick* calls already update
    // state directly, and re-running on every state change would fight them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.sessionStorage.getItem(BOOKING_HANDOFF_KEY);
      window.sessionStorage.removeItem(BOOKING_HANDOFF_KEY);
    } catch {
      return;
    }
    const handoff = parseBookingHandoff(raw);
    if (!handoff) return;

    window.queueMicrotask(() => {
      const text = (value: unknown) =>
        typeof value === "string" ? value.slice(0, 2000) : "";
      setForm({
        fullName: text(handoff.fullName) || initialDetails?.fullName || "",
        phone: text(handoff.phone) || initialDetails?.phone || "",
        email: verifiedEmail
          ? (initialDetails?.email ?? "")
          : text(handoff.email) || initialDetails?.email || "",
        notes: text(handoff.notes),
      });

      const preferredDate = isValidPreferredDate(handoff.preferredDate)
        ? handoff.preferredDate!
        : null;
      if (preferredDate) setDate(preferredDate);

      const handoffService = services.find(
        (item) => item.key === handoff.service,
      )?.key;
      if (!initialService && handoffService) {
        setService(handoffService);
        setProcedure(null);
        setCart([]);
        setStep(1);
        router.replace({
          pathname: PUBLIC_PATHS.booking,
          query: { service: handoffService },
        });
      }
      // Setting `date` above (when valid) carries the wizard through the
      // Date -> Specialist -> Time chain via the normal reactive path; no
      // separate slot fetch is needed here.
    });
  }, [initialDetails, initialService, router, services, verifiedEmail]);

  function pickService(key: string) {
    const nextService = services.find((item) => item.key === key);
    setService(key);
    setProcedure(null);
    setCart([]);
    setSpecialist(null);
    setSpecialists([]);
    setSlot(null);
    setSlots([]);
    setDatesLoading(true);
    setDatesDegraded(false);
    setAvailableDates(undefined);
    setStep(1);
    // A single-option service falls straight through to pickOption below,
    // which pushes its own history entry — pushing here too would leave an
    // invisible back-stop the client never actually saw.
    if (nextService?.options.length === 1) {
      pickOption(key, nextService.options[0]);
      return;
    }
    router.push({ pathname: PUBLIC_PATHS.booking, query: { service: key } });
  }

  function pickOption(
    serviceKey: string,
    option: BookingServiceOption["options"][number],
  ) {
    setService(serviceKey);
    setProcedure({ ...option, description: "" });
    setCart([]);
    setSpecialist(null);
    setSpecialists([]);
    setDate(null);
    setSlot(null);
    setSlots([]);
    setStep(2);
    router.push({
      pathname: PUBLIC_PATHS.booking,
      query: { service: serviceKey, option: option.key },
    });
    void loadAvailableDates(serviceKey, [option.key], "any");
  }

  function toggleCartOption(option: BookingServiceOption["options"][number]) {
    setCart((current) =>
      current.some((item) => item.key === option.key)
        ? current.filter((item) => item.key !== option.key)
        : current.length >= MAX_GROUP_PROCEDURES
          ? current
          : [...current, option],
    );
  }

  function pickCart(serviceKey: string) {
    if (!cart.length) return;
    // A cart of one behaves exactly like picking that one procedure
    // directly — only two or more actually takes the group booking path.
    if (cart.length === 1) {
      const only = cart[0];
      setCart([]);
      pickOption(serviceKey, only);
      return;
    }
    setService(serviceKey);
    setProcedure(null);
    setSpecialist(null);
    setSpecialists([]);
    setDate(null);
    setSlot(null);
    setSlots([]);
    setStep(2);
    const keys = cart.map((option) => option.key);
    router.push({
      pathname: PUBLIC_PATHS.booking,
      query: { service: serviceKey, ...optionUrlQuery(keys) },
    });
    void loadAvailableDates(serviceKey, keys, "any");
  }

  function pickDate(value: string) {
    if (!service || !activeOptionKeys.length) return;
    setDate(value);
    setSlot(null);
    setSlots([]);
    setStep(3);
    router.push({
      pathname: PUBLIC_PATHS.booking,
      query: { service, ...optionUrlQuery(activeOptionKeys), date: value },
    });
    void loadSpecialistsForDate(
      service,
      activeOptionKeys,
      value,
      specialistId ?? initialSpecialistId,
    );
  }

  function pickSpecialist(next: Specialist) {
    if (!service || !activeOptionKeys.length || !date) return;
    setSpecialist(next);
    setSlot(null);
    setSlots([]);
    setStep(4);
    router.push({
      pathname: PUBLIC_PATHS.booking,
      query: {
        service,
        ...optionUrlQuery(activeOptionKeys),
        date,
        specialist: next.id,
      },
    });
    void loadSlots(date, service, activeOptionKeys, next.id);
  }

  async function pickSlot(s: Slot) {
    setSlot(s);
    setError(null);
    if (specialist?.id === "any") {
      if (!service || !activeOptionKeys.length) return;
      setResolvingSpecialist(true);
      try {
        const response = await fetch("/api/booking/resolve-specialist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            service,
            ...(groupOptions
              ? { options: activeOptionKeys }
              : { option: activeOptionKeys[0] }),
            start: s.start,
            locale,
          }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.specialist) {
          setError(
            response.status === 409
              ? t("errors.slotTaken")
              : t("errors.unavailable"),
          );
          setSlot(null);
          return;
        }
        // Swap the "Any specialist" placeholder for who was actually
        // assigned, so the confirm step shows their real name.
        setSpecialist(payload.specialist as Specialist);
      } catch {
        setError(t("errors.unavailable"));
        setSlot(null);
        return;
      } finally {
        setResolvingSpecialist(false);
      }
    }
    setStep(5);
  }

  async function submit() {
    if (!service || !slot || !specialist || !activeOptionKeys.length) return;
    setSubmitting(true);
    setError(null);
    setShowFallback(false);
    try {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service,
          start: slot.start,
          locale,
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          notes: form.notes,
          consentGdpr: consent,
          procedureConsent: procedureAcknowledged,
          procedureConsentVersion: procedureConsent.version,
          specialistId: specialist.id,
          ...(consultationRequired && consultationConfig
            ? {
                consultation: {
                  contentVersion: consultationConfig.contentVersion,
                  dateOfBirth: consultation.dateOfBirth,
                  answers: consultation.answers,
                  healthConsent: consultation.healthConsent,
                  accuracyAcknowledged: consultation.accuracyAcknowledged,
                },
              }
            : {}),
          ...(groupOptions
            ? { options: activeOptionKeys }
            : { option: activeOptionKeys[0] }),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.procedures) && data.procedures.length > 1) {
          setConfirmedGroup(
            data.procedures.map(
              (item: { title: string; price: string | null; durationMin: number }) => ({
                title: item.title,
                price: item.price,
                durationMin: item.durationMin,
              }),
            ),
          );
          setProcedure(null);
        } else {
          setConfirmedGroup(null);
          setProcedure(
            data.option
              ? {
                  key: data.option.key,
                  title: data.option.title,
                  price: data.option.price ?? "",
                  durationMin: data.option.durationMin,
                  durationLabel: procedure?.durationLabel ?? null,
                  group: procedure?.group ?? null,
                  offerRequiresAccount: procedure?.offerRequiresAccount ?? false,
                  description: procedure?.description ?? "",
                }
              : null,
          );
        }
        setConfirmation({
          id: data.id,
          start: data.start,
          manageUrl: data.manageUrl,
        });
        return;
      }
      if (res.status === 409) {
        if (data?.error === "offer_not_eligible") {
          const regular = services
            .find((item) => item.key === "endospheres")
            ?.options.find((item) => item.key === "75");
          if (regular) {
            setService("endospheres");
            setProcedure({ ...regular, description: "" });
            setCart([]);
            router.replace({
              pathname: PUBLIC_PATHS.booking,
              query: { service: "endospheres", option: regular.key },
            });
          }
          setError(t("errors.offerNotEligible"));
        } else {
          setError(t("errors.slotTaken"));
          setStep(4);
          if (date && service && activeOptionKeys.length)
            void loadSlots(date, service, activeOptionKeys, specialist.id);
        }
        return;
      }
      if (res.status === 401 && data?.error === "offer_account_required") {
        setError(t("errors.offerAccountRequired"));
        return;
      }
      if (data?.degraded) {
        setShowFallback(true);
        setError(t("errors.unavailable"));
        return;
      }
      if (
        typeof data?.error === "string" &&
        data.error.startsWith("consultation_")
      ) {
        const key =
          data.error === "consultation_stale"
            ? "errors.consultationStale"
            : data.error === "consultation_unavailable" ||
                data.error === "consultation_form_unavailable"
              ? "errors.consultationUnavailable"
              : data.error === "consultation_invalid"
                ? "errors.consultationInvalid"
                : "errors.consultationRequired";
        setError(t(key));
        if (data.error.includes("unavailable")) setShowFallback(true);
        return;
      }
      setError(t("errors.generic"));
    } catch {
      setShowFallback(true);
      setError(t("errors.unavailable"));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setConfirmation(null);
    setConfirmedGroup(null);
    setStep(1);
    setService(null);
    setProcedure(null);
    setCart([]);
    setSpecialist(null);
    setSpecialists([]);
    setDate(null);
    setSlot(null);
    setForm({ fullName: "", phone: "", email: "", notes: "" });
    setConsent(false);
    setProcedureAcknowledged(false);
    setConsultation({
      dateOfBirth: savedConsultation?.dateOfBirth ?? "",
      answers: savedConsultation?.answers ?? {},
      healthConsent: false,
      accuracyAcknowledged: false,
    });
    setError(null);
    setShowFallback(false);
    router.replace(PUBLIC_PATHS.booking);
  }

  if (confirmation) {
    const label =
      services.find((item) => item.key === service)?.name ??
      (initialContext?.service.key === service
        ? initialContext.service.name
        : "");
    return (
      <div className="mt-[clamp(28px,4vw,44px)] rounded-(--radius) border border-line-card bg-card p-[clamp(24px,4vw,44px)] text-center">
        <CheckCircle size={48} weight="thin" className="mx-auto text-accent" />
        <h2 className="mt-4 font-display text-[clamp(26px,3.4vw,40px)] leading-[1.1] font-medium text-ink">
          {t("confirmed.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-110 font-sans text-[14px] leading-[1.7] font-light text-body">
          {t("confirmed.body")}
        </p>
        <dl className="mx-auto mt-6 max-w-90 space-y-2.5 text-left font-sans text-[14px] text-ink">
          <SummaryRow label={t("summary.service")} value={label} />
          {confirmedGroup ? (
            <>
              {confirmedGroup.map((item, index) => (
                <SummaryRow
                  key={`${item.title}-${index}`}
                  label={`${t("summary.procedure")} ${index + 1}/${confirmedGroup.length}`}
                  value={item.price ? `${item.title} · ${item.price}` : item.title}
                />
              ))}
              <SummaryRow
                label={t("summary.totalDuration")}
                value={t("context.duration", {
                  minutes: confirmedGroup.reduce(
                    (sum, item) => sum + item.durationMin,
                    0,
                  ),
                })}
              />
            </>
          ) : procedure ? (
            <SummaryRow
              label={t("summary.procedure")}
              value={procedure.title}
            />
          ) : null}
          {specialist ? (
            <SummaryRow
              label={t("summary.specialist")}
              value={specialist.name}
            />
          ) : null}
          <SummaryRow
            label={t("summary.time")}
            value={dateTimeFmt.format(new Date(confirmation.start))}
          />
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{t("summary.reference")}</dt>
            <dd className="text-right font-mono text-meta tracking-[.06em] uppercase">
              {confirmation.id.slice(-8)}
            </dd>
          </div>
        </dl>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <ButtonAction variant="outline" onClick={reset}>
            {t("confirmed.again")}
          </ButtonAction>
          {confirmation.manageUrl ? (
            <a
              href={confirmation.manageUrl}
              className="min-h-11 rounded border border-line-btn px-4 py-3 font-sans text-label text-body hover:bg-btn-fill"
            >
              {t("confirmed.manage")}
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (!gender) {
    // Shown first on every entry into booking — including a "Book now" deep
    // link from inside a specific service/category page — not only when the
    // client starts from the general booking page. The preselected service
    // (and, for a multi-procedure service, the cart) is already resolved in
    // state above and simply renders on the step right after this one.
    //
    // Admin-managed photos (content/site-media.ts: "booking.gender.women"/
    // "men") — no fallback exists yet, so each choice renders as a plain
    // sized card until the clinic uploads one, then upgrades to a full
    // photo automatically. Never a bare, unstyled empty area either way.
    const choices: Array<{
      key: "WOMEN" | "MEN";
      label: string;
      image: PublicManagedImage;
    }> = [
      { key: "WOMEN", label: t("genderStep.women"), image: genderImages.women },
      { key: "MEN", label: t("genderStep.men"), image: genderImages.men },
    ];
    return (
      <div>
        <h2 className="font-display text-[26px] font-medium text-ink">
          {t("genderStep.title")}
        </h2>
        <div className="mt-4.5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
          {choices.map((choice) => (
            <button
              key={choice.key}
              type="button"
              onClick={() => setGender(choice.key)}
              className="group relative flex min-h-[220px] flex-col justify-end overflow-hidden rounded-(--radius) border border-line-card bg-card text-left transition-all hover:-translate-y-0.75 hover:border-line-card-hover hover:shadow-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {choice.image.image ? (
                <Image
                  src={choice.image.image}
                  alt={choice.image.alt}
                  fill
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                  sizes="(max-width: 640px) 100vw, 300px"
                  style={{
                    objectPosition: `${choice.image.focalX}% ${choice.image.focalY}%`,
                  }}
                />
              ) : null}
              <span
                className={cn(
                  "relative z-10 px-4 py-3.5 font-sans text-[15px] font-medium",
                  choice.image.image
                    ? "bg-gradient-to-t from-ink/70 via-ink/10 to-transparent pt-12 text-page"
                    : "text-ink",
                )}
              >
                {choice.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const visibleServices = gender
    ? services.filter(
        (item) => item.targetGender === "BOTH" || item.targetGender === gender,
      )
    : services;

  const stepLabels = [
    t("steps.service"),
    t("steps.date"),
    t("steps.specialist"),
    t("steps.time"),
    t("steps.you"),
  ];
  const selectedService =
    services.find((item) => item.key === service) ??
    (initialContext?.service.key === service
      ? initialContext.service
      : undefined);
  const offerAccountGate =
    Boolean(
      selectedService?.offerRequiresAccount ||
        procedure?.offerRequiresAccount ||
        groupOptions?.some((option) => option.offerRequiresAccount),
    ) && !clientSignedIn;
  const noAvailableDates =
    !datesLoading && !datesDegraded && availableDates?.length === 0;

  return (
    <div>
      {selectedService ? (
        <SelectedContext
          service={selectedService}
          procedure={procedure}
          groupOptions={groupOptions}
          groupTotalDuration={groupTotalDuration}
          locale={locale}
          t={t}
        />
      ) : null}
      <ol className="flex flex-wrap items-center gap-2 font-sans text-meta tracking-[.06em] uppercase">
        {stepLabels.map((label, i) => {
          const n = (i + 1) as Step;
          const done = n < step;
          const active = n === step;
          return (
            <li key={label} className="flex items-center gap-2">
              <button
                type="button"
                disabled={n >= step}
                onClick={() => setStep(n)}
                className={cn(
                  "flex min-h-9 items-center gap-2 rounded-[4px] px-2.5",
                  active
                    ? "text-ink"
                    : done
                      ? "text-accent hover:underline"
                      : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "grid h-6 w-6 place-items-center rounded-full border text-meta",
                    active
                      ? "border-accent bg-accent text-page"
                      : done
                        ? "border-accent text-accent"
                        : "border-line-btn text-muted",
                  )}
                >
                  {n}
                </span>
                {label}
              </button>
              {i < stepLabels.length - 1 && (
                <span className="text-line-btn">.</span>
              )}
            </li>
          );
        })}
      </ol>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-[4px] border border-line-btn bg-btn-fill px-3.5 py-2.5 font-sans text-[14px] text-ink"
        >
          {error}
        </p>
      )}

      {offerAccountGate ? (
        <div className="mt-5 rounded-(--radius) border border-line-card bg-alt p-[clamp(18px,3vw,28px)]">
          <h2 className="font-display text-[26px] font-medium text-ink">
            {t("offerAccount.title")}
          </h2>
          <p className="mt-2 max-w-[56ch] font-sans text-[14px] leading-[1.7] text-body">
            {t("offerAccount.body")}
          </p>
          <div className="mt-4.5 flex flex-wrap gap-2.5">
            <a
              href={offerLoginHref}
              className="inline-flex min-h-11 items-center rounded-[4px] bg-accent px-5 font-sans text-meta font-medium tracking-[.13em] text-page uppercase"
            >
              {t("offerAccount.signIn")}
            </a>
            <a
              href={offerRegisterHref}
              className="inline-flex min-h-11 items-center rounded-[4px] border border-line-btn px-5 font-sans text-meta font-medium tracking-[.13em] text-ink uppercase"
            >
              {t("offerAccount.create")}
            </a>
          </div>
        </div>
      ) : null}

      {step === 1 && (
        <div className="mt-[clamp(20px,3vw,32px)]">
          {selectedService && selectedService.options.length > 1 ? (
            <fieldset className="grid gap-3 pb-20">
              <legend className="mb-3 font-display text-[26px] font-medium text-ink">
                {selectedService.name}
              </legend>
              {selectedService.multiProcedureBooking
                ? selectedService.options.map((option) => {
                    const selected = cart.some(
                      (item) => item.key === option.key,
                    );
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => toggleCartOption(option)}
                        aria-pressed={selected}
                        className={cn(
                          "flex min-h-16 items-center gap-4 rounded-(--radius) border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          selected
                            ? "border-accent bg-alt"
                            : "border-line-card bg-card hover:border-line-card-hover",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-[15px] font-medium",
                            selected
                              ? "border-accent bg-accent text-page"
                              : "border-line-btn text-muted",
                          )}
                        >
                          {selected ? "✓" : "+"}
                        </span>
                        <span className="flex-1">
                          <span className="block font-sans text-[14px] font-medium text-ink">
                            {option.title}
                          </span>
                          {option.group ? (
                            <span className="mt-1 block font-sans text-meta text-muted">
                              {option.group}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right font-sans text-[13px] text-body">
                          {option.durationLabel ? (
                            <span className="block">
                              {option.durationLabel}
                            </span>
                          ) : null}
                          {option.price ? (
                            <span className="block font-medium text-ink">
                              {option.price}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })
                : selectedService.options.map((option) => {
                    // Highlights the option a "Book now" deep link already
                    // pointed at, so the client can see what's pre-chosen
                    // while still being free to click a different one.
                    const preselected = procedure?.key === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => pickOption(selectedService.key, option)}
                        aria-pressed={preselected}
                        className={cn(
                          "flex min-h-16 items-center justify-between gap-4 rounded-(--radius) border p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                          preselected
                            ? "border-accent bg-alt"
                            : "border-line-card bg-card hover:border-line-card-hover",
                        )}
                      >
                        <span>
                          <span className="block font-sans text-[14px] font-medium text-ink">
                            {option.title}
                          </span>
                          {option.group ? (
                            <span className="mt-1 block font-sans text-meta text-muted">
                              {option.group}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right font-sans text-[13px] text-body">
                          {option.durationLabel ? (
                            <span className="block">
                              {option.durationLabel}
                            </span>
                          ) : null}
                          {option.price ? (
                            <span className="block font-medium text-ink">
                              {option.price}
                            </span>
                          ) : null}
                        </span>
                      </button>
                    );
                  })}
              <button
                type="button"
                onClick={() => {
                  setService(null);
                  setProcedure(null);
                  setCart([]);
                  router.replace(PUBLIC_PATHS.booking);
                }}
                className="mt-2 w-fit font-sans text-[13px] text-accent underline underline-offset-4"
              >
                {t("steps.service")}
              </button>
              {selectedService.multiProcedureBooking && cart.length > 0 ? (
                <BookingCartBar
                  count={cart.length}
                  totalDurationMin={cart.reduce(
                    (sum, option) => sum + option.durationMin,
                    0,
                  )}
                  onBook={() => pickCart(selectedService.key)}
                  t={t}
                />
              ) : null}
            </fieldset>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3.5">
              {visibleServices.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => pickService(s.key)}
                  className="group flex min-h-11 flex-col overflow-hidden rounded-(--radius) border border-line-card bg-card text-left transition-all hover:-translate-y-0.75 hover:border-line-card-hover hover:shadow-card"
                >
                  {s.image && (
                    <span className="relative block h-32 w-full overflow-hidden">
                      <Image
                        src={s.image}
                        alt={s.imageAlt}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                        sizes="200px"
                        style={{
                          objectPosition: `${s.imageFocalX}% ${s.imageFocalY}%`,
                        }}
                      />
                    </span>
                  )}
                  <span className="flex min-h-17.5 flex-1 items-center justify-between gap-3 px-4 py-3.5 font-sans text-[14px] leading-[1.35] font-medium text-ink">
                    {s.name}
                    <ArrowRight
                      size={15}
                      weight="thin"
                      className="text-accent"
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && activeOptionKeys.length > 0 && !offerAccountGate ? (
        <div className="mt-[clamp(20px,3vw,32px)]">
          <p className="mb-3 font-sans text-label font-medium tracking-[.04em] text-muted uppercase">
            {t("pickDate")}
          </p>
          {datesLoading ? (
            <p className="font-sans text-[14px] text-muted" role="status">
              {t("loadingDates")}
            </p>
          ) : datesDegraded ? (
            <FallbackBlock t={t} fallback={fallback} />
          ) : noAvailableDates ? (
            <div role="status">
              <p className="font-sans text-[14px] text-muted">
                {t("noDates")}
              </p>
              <FallbackBlock t={t} fallback={fallback} />
            </div>
          ) : (
            <BookingCalendar
              locale={locale}
              value={date}
              onSelect={pickDate}
              availableDates={availableDates}
              loading={datesLoading}
            />
          )}
        </div>
      ) : null}

      {step === 3 && activeOptionKeys.length > 0 && !offerAccountGate ? (
        <div className="mt-[clamp(20px,3vw,32px)]">
          <h2 className="font-display text-[26px] font-medium text-ink">
            {t("pickSpecialist")}
          </h2>
          {specialistsLoading ? (
            <p className="mt-3 font-sans text-[14px] text-muted" role="status">
              {t("loadingSpecialists")}
            </p>
          ) : specialistsDegraded || specialists.length === 0 ? (
            <div className="mt-4" role="status">
              <p className="font-sans text-[14px] text-muted">
                {t("noSpecialists")}
              </p>
              <FallbackBlock t={t} fallback={fallback} />
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {specialists.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickSpecialist(item)}
                  className="min-h-14 rounded-(--radius) border border-line-card bg-card px-4 py-3 text-left font-sans text-[14px] font-medium text-ink hover:border-line-card-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {item.name}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {step === 4 && specialist && !offerAccountGate && (
        <div className="mt-[clamp(20px,3vw,32px)]">
          <p className="mb-3 font-sans text-label font-medium tracking-[.04em] text-muted uppercase">
            {t("pickTime")}
          </p>
          {slotsLoading || resolvingSpecialist ? (
            <p className="font-sans text-[14px] text-muted">{t("loading")}</p>
          ) : slots.length > 0 ? (
            <TimePicker
              inline
              value={slot?.start ?? ""}
              ariaLabel={t("pickTime")}
              options={slots.map((item) => ({
                value: item.start,
                label: item.label,
              }))}
              onValueChange={(value) => {
                const selectedSlot = slots.find(
                  (item) => item.start === value,
                );
                if (selectedSlot) void pickSlot(selectedSlot);
              }}
            />
          ) : slotsDegraded ? (
            <FallbackBlock t={t} fallback={fallback} />
          ) : (
            <p className="font-sans text-[14px] text-muted">{t("noTimes")}</p>
          )}
        </div>
      )}

      {step === 5 && slot && specialist && (
        <form
          className="mt-[clamp(20px,3vw,32px)] max-w-130"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="mb-5 font-sans text-[14px] text-body">
            {t("summary.time")}:{" "}
            <span className="font-medium text-ink">
              {dateTimeFmt.format(new Date(slot.start))}
            </span>
          </p>

          <p className="mb-5 font-sans text-[14px] text-body">
            {t("summary.specialist")}:{" "}
            <span className="font-medium text-ink">{specialist.name}</span>
          </p>

          {consultationRequired && !consultationAvailable ? (
            <div
              className="mb-5 rounded-[6px] border border-line-btn bg-btn-fill px-4 py-3 font-sans text-[14px] text-body"
              role="alert"
            >
              <p>{t("errors.consultationUnavailable")}</p>
            </div>
          ) : null}

          <div className="grid gap-3.5">
            {clientSignedIn ? (
              <div className="rounded-[6px] border border-line-card bg-alt px-4 py-3 font-sans text-[14px] leading-[1.7] text-body">
                <p className="font-medium text-ink">{t("savedProfile")}</p>
                <p>{form.fullName}</p>
                <p>{form.phone}</p>
                <p>{form.email}</p>
                <a
                  href={profileHref}
                  className="mt-1 inline-block text-accent underline underline-offset-4"
                >
                  {t("editProfile")}
                </a>
              </div>
            ) : (
              <>
                <Field label={t("fields.name")} required>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={form.fullName}
                    onChange={(e) =>
                      setForm({ ...form, fullName: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label={t("fields.phone")} required>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    placeholder="+358 40 123 4567"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field label={t("fields.email")} required>
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    readOnly={verifiedEmail}
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
              </>
            )}
            <Field label={t("fields.notes")}>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={cn(inputCls, "resize-y")}
              />
            </Field>
          </div>

          {consultationRequired &&
          consultationConfig &&
          consultationAvailable ? (
            <ConsultationFields
              config={consultationConfig}
              value={consultation}
              locale={locale}
              onChange={setConsultation}
              t={t}
            />
          ) : null}

          <aside className="mt-4.5 rounded-[6px] border border-line-card bg-alt px-4 py-3 font-sans text-[13px] leading-[1.65] text-body">
            <p>{cancellationPolicy.text}</p>
            <a
              href={cancellationPolicy.href}
              className="mt-1.5 inline-block font-medium text-accent underline decoration-accent/45 underline-offset-4"
            >
              {cancellationPolicy.linkLabel}
            </a>
          </aside>

          <label className="mt-4.5 flex items-start gap-2.5 font-sans text-[14px] leading-[1.6] text-body">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.75 h-4.5 w-4.5 accent-accent"
            />
            <span>
              {t.rich("fields.consent", {
                link: (chunks) => (
                  <Link
                    href={PUBLIC_PATHS.privacy}
                    target="_blank"
                    className="underline underline-offset-4 hover:text-accent"
                  >
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>

          <label className="mt-3 flex items-start gap-2.5 font-sans text-[14px] leading-[1.6] text-body">
            <input
              type="checkbox"
              required
              checked={procedureAcknowledged}
              onChange={(e) => setProcedureAcknowledged(e.target.checked)}
              className="mt-0.75 h-4.5 w-4.5 accent-accent"
            />
            <span>
              {procedureConsent.wording || t("fields.procedureConsent")}
            </span>
          </label>

          <div className="mt-6">
            <ButtonAction
              type="submit"
              iconRight={ArrowRight}
              disabled={
                submitting ||
                !consent ||
                !procedureAcknowledged ||
                !procedureConsent.version ||
                !consultationAvailable ||
                (consultationRequired &&
                  (!consultationConfig ||
                    !consultation.dateOfBirth ||
                    !consultation.healthConsent ||
                    !consultation.accuracyAcknowledged))
              }
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submit")}
            </ButtonAction>
          </div>

          {showFallback && <FallbackBlock t={t} fallback={fallback} />}
        </form>
      )}
    </div>
  );
}

function ConsultationFields({
  config,
  value,
  locale,
  onChange,
  t,
}: {
  config: BookingConsultationConfig;
  value: ConsultationState;
  locale: string;
  onChange: (next: ConsultationState) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const setAnswer = (key: string, answer: ConsultationAnswer) =>
    onChange({ ...value, answers: { ...value.answers, [key]: answer } });
  return (
    <fieldset className="mt-5 grid gap-4 rounded-[8px] border border-line-card bg-alt p-4 sm:p-5">
      <legend className="px-2 font-display text-[22px] font-medium text-ink">
        {t("consultation.heading")}
      </legend>
      <p className="font-sans text-[13px] leading-[1.7] text-body">
        {config.requiredInformation}
      </p>
      <div className="font-sans text-[13px] text-body">
        <span className="mb-1.5 block tracking-[.04em] text-muted uppercase">
          {t("consultation.dateOfBirth")} <span className="text-accent">*</span>
        </span>
        <DatePicker
          id="booking-consultation-date-of-birth"
          locale={locale}
          value={value.dateOfBirth}
          onValueChange={(dateOfBirth) => onChange({ ...value, dateOfBirth })}
          ariaLabel={t("consultation.dateOfBirth")}
          placeholder={t("consultation.chooseDateOfBirth")}
          autoComplete="bday"
          max={clinicTodayYmd()}
          disableClosedDays={false}
          navigation="dateOfBirth"
          required
        />
      </div>
      {config.questions.map((question) => {
        const answer = value.answers[question.key];
        if (question.type === "LONG_TEXT" || question.type === "SHORT_TEXT")
          return (
            <label
              key={question.key}
              className="block font-sans text-[13px] text-body"
            >
              <span>
                {question.prompt}
                {question.required ? (
                  <span className="text-accent"> *</span>
                ) : null}
              </span>
              {question.helpText ? (
                <span className="mt-1 block text-muted">
                  {question.helpText}
                </span>
              ) : null}
              {question.type === "LONG_TEXT" ? (
                <textarea
                  className={cn(inputCls, "mt-1.5 min-h-28 resize-y")}
                  value={typeof answer === "string" ? answer : ""}
                  required={question.required}
                  onChange={(event) =>
                    setAnswer(question.key, event.target.value)
                  }
                />
              ) : (
                <input
                  className={cn(inputCls, "mt-1.5")}
                  value={typeof answer === "string" ? answer : ""}
                  required={question.required}
                  onChange={(event) =>
                    setAnswer(question.key, event.target.value)
                  }
                />
              )}
            </label>
          );
        if (question.type === "ACKNOWLEDGMENT")
          return (
            <label
              key={question.key}
              className="flex gap-2.5 font-sans text-[13px] leading-[1.65] text-body"
            >
              <input
                type="checkbox"
                className="mt-0.75 h-4.5 w-4.5 accent-accent"
                checked={answer === true}
                required={question.required}
                onChange={(event) =>
                  setAnswer(question.key, event.target.checked)
                }
              />
              <span>{question.prompt}</span>
            </label>
          );
        const choices =
          question.type === "YES_NO"
            ? [
                { key: "yes", label: t("consultation.yes") },
                { key: "no", label: t("consultation.no") },
              ]
            : question.choices;
        const selected = Array.isArray(answer) ? answer : [];
        return (
          <fieldset
            key={question.key}
            className="grid gap-2 font-sans text-[13px] text-body"
          >
            <legend>
              {question.prompt}
              {question.required ? (
                <span className="text-accent"> *</span>
              ) : null}
            </legend>
            {question.helpText ? (
              <p className="text-muted">{question.helpText}</p>
            ) : null}
            {choices.map((choice) => (
              <label key={choice.key} className="flex gap-2.5">
                <input
                  type={question.type === "MULTI_CHOICE" ? "checkbox" : "radio"}
                  name={`booking_consultation_${question.key}`}
                  value={choice.key}
                  className="accent-accent"
                  checked={
                    question.type === "MULTI_CHOICE"
                      ? selected.includes(choice.key)
                      : answer === choice.key
                  }
                  required={
                    question.required && question.type !== "MULTI_CHOICE"
                  }
                  onChange={(event) => {
                    if (question.type !== "MULTI_CHOICE") {
                      setAnswer(question.key, choice.key);
                      return;
                    }
                    setAnswer(
                      question.key,
                      event.target.checked
                        ? [...selected, choice.key]
                        : selected.filter((item) => item !== choice.key),
                    );
                  }}
                />
                {choice.label}
              </label>
            ))}
          </fieldset>
        );
      })}
      <label className="flex gap-2.5 font-sans text-[13px] leading-[1.65] text-body">
        <input
          type="checkbox"
          className="mt-0.75 h-4.5 w-4.5 accent-accent"
          checked={value.healthConsent}
          required
          onChange={(event) =>
            onChange({ ...value, healthConsent: event.target.checked })
          }
        />
        <span>{config.healthConsent}</span>
      </label>
      <label className="flex gap-2.5 font-sans text-[13px] leading-[1.65] text-body">
        <input
          type="checkbox"
          className="mt-0.75 h-4.5 w-4.5 accent-accent"
          checked={value.accuracyAcknowledged}
          required
          onChange={(event) =>
            onChange({ ...value, accuracyAcknowledged: event.target.checked })
          }
        />
        <span>{config.accuracyAcknowledgment}</span>
      </label>
    </fieldset>
  );
}

const inputCls =
  "w-full rounded-[4px] border border-line-btn bg-page px-3.5 py-2.75 font-sans text-copy text-ink outline-none focus:border-accent";

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-hair pb-2.5">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function SelectedContext({
  service,
  procedure,
  groupOptions,
  groupTotalDuration,
  locale,
  t,
}: {
  service: BookingServiceOption;
  procedure: BookingProcedureContext | null;
  groupOptions: BookingServiceOption["options"] | null;
  groupTotalDuration: number | null;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  const priceFrom =
    service.priceFrom === null
      ? null
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "EUR",
          maximumFractionDigits: 2,
        }).format(service.priceFrom);

  return (
    <article className="mb-[clamp(22px,3vw,32px)] grid overflow-hidden rounded-(--radius) border border-line-card bg-page sm:grid-cols-[150px_1fr]">
      {service.image ? (
        <div className="relative min-h-37.5 sm:min-h-full">
          <Image
            src={service.image}
            alt={service.imageAlt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 150px"
            style={{
              objectPosition: `${service.imageFocalX}% ${service.imageFocalY}%`,
            }}
          />
        </div>
      ) : null}
      <div className="p-[clamp(18px,2.5vw,26px)]">
        <p className="font-sans text-meta font-medium tracking-[.16em] text-accent uppercase">
          {groupOptions
            ? t("context.procedure")
            : procedure
              ? t("context.procedure")
              : t("context.service")}
        </p>
        {groupOptions || procedure ? (
          <p className="mt-1.75 font-sans text-meta text-muted">
            {service.name}
          </p>
        ) : null}
        <h3 className="mt-1.25 font-display text-[clamp(24px,3vw,32px)] leading-[1.08] font-medium text-ink">
          {groupOptions
            ? groupOptions.map((option) => option.title).join(" + ")
            : (procedure?.title ?? service.name)}
        </h3>
        <p className="mt-2.5 font-sans text-compact leading-[1.65] font-normal text-body">
          {procedure?.description ?? service.shortDescription}
        </p>
        <div className="mt-3.5 flex flex-wrap gap-x-4.5 gap-y-1.5 font-sans text-meta text-muted">
          <span>
            {groupOptions && groupTotalDuration !== null
              ? t("context.duration", { minutes: groupTotalDuration })
              : (procedure?.durationLabel ??
                t("context.duration", {
                  minutes: procedure?.durationMin ?? service.durationMin,
                }))}
          </span>
          {!groupOptions && procedure?.price ? <span>{procedure.price}</span> : null}
          {!groupOptions && !procedure && priceFrom ? (
            <span>
              {service.priceMode === "FIXED"
                ? priceFrom
                : t("context.priceFrom", { price: priceFrom })}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-sans text-label tracking-[.04em] text-muted uppercase">
        {label}
        {required && <span className="text-accent"> *</span>}
      </span>
      {children}
    </label>
  );
}

function FallbackBlock({
  t,
  fallback,
}: {
  t: ReturnType<typeof useTranslations>;
  fallback: Fallback;
}) {
  return (
    <div className="mt-4 rounded-(--radius) border border-line-card bg-card p-4.5">
      <p className="font-sans text-[14px] leading-[1.7] text-body">
        {t("fallback")}
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        <a
          href={fallback.phoneHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-[4px] bg-accent px-4.5 font-sans text-meta tracking-[.14em] text-page uppercase"
        >
          <Phone size={16} weight="thin" /> {fallback.phone}
        </a>
        <a
          href={fallback.emailHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-[4px] border border-line-btn px-4.5 font-sans text-meta tracking-[.14em] text-ink uppercase"
        >
          <EnvelopeSimple size={16} weight="thin" /> {fallback.email}
        </a>
      </div>
    </div>
  );
}
