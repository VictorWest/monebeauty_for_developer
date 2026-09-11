import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  APPOINTMENT_BUFFER_MINUTES,
  MAX_GROUP_PROCEDURES,
  getServiceId,
  openPublicGroupSlotCandidates,
  openPublicSlotCandidates,
} from "@/lib/booking";
import {
  notifyAppointmentGroupReceipt,
  notifyAppointmentReceipt,
} from "@/lib/notifications";
import { normalizeInternationalPhone } from "@/lib/phone";
import { normalizeContactEmail } from "@/lib/contact-normalization";
import { routing, type Locale } from "@/i18n/routing";
import { currentUser } from "@/lib/auth";
import { createAppointmentClaimUrl } from "@/lib/appointment-claim";
import { appointmentManageUrl } from "@/lib/email/messages";
import { lockAndFindReservationConflict } from "@/lib/calendar-blocks";
import { clinicDateFromInstant } from "@/lib/clinic-time";
import { ENDOSPHERES_BOOKING_FAMILY } from "@/content/endospheres";
import {
  decryptSavedConsultation,
  loadConsultationForm,
  serializeConsultationForm,
  validateConsultationSubmission,
} from "@/lib/consultation";
import { isSensitiveDataEncryptionConfigured } from "@/lib/sensitive-data";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Multi-procedure visit: several options from one service, one specialist,
 * back-to-back (see lib/booking.ts's collectGroupSlotCandidates). This
 * deliberately mirrors rather than shares control flow with the
 * single-procedure POST handler below — the consultation/consent/offer
 * gating is duplicated here instead of factored out, so the already-working
 * single-procedure path stays completely untouched by this feature.
 */
async function createGroupBooking(
  payload: Record<string, unknown>,
  optionKeys: string[],
) {
  const service = String(payload.service ?? "");
  const start = String(payload.start ?? "");
  const specialistId = String(payload.specialistId ?? "").trim();
  const procedureConsentVersion = Number(payload.procedureConsentVersion);
  const submittedFullName = String(payload.fullName ?? "").trim();
  const submittedPhone = normalizeInternationalPhone(
    String(payload.phone ?? ""),
  );
  const submittedEmail = String(payload.email ?? "")
    .trim()
    .toLowerCase();
  const notes = payload.notes ? String(payload.notes).slice(0, 2000) : null;
  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : routing.defaultLocale;
  const consentGdpr = payload.consentGdpr === true;
  const procedureConsent = payload.procedureConsent === true;

  const uniqueKeys = Array.from(new Set(optionKeys));
  if (
    uniqueKeys.length !== optionKeys.length ||
    optionKeys.length < 2 ||
    optionKeys.length > MAX_GROUP_PROCEDURES
  )
    return bad("invalid_option");

  const svc = await prisma.service.findFirst({
    where: {
      slug: service,
      bookable: true,
      multiProcedureBooking: true,
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      options: {
        where: {
          key: { in: optionKeys },
          type: { in: ["APPOINTMENT", "COURSE"] },
          bookable: true,
          published: true,
          archivedAt: null,
          contents: { some: { locale, status: "PUBLISHED" } },
        },
        orderBy: { displayOrder: "asc" },
        include: {
          contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
        },
      },
    },
  });
  if (!svc) return bad("unknown_service");
  if (svc.options.length !== optionKeys.length) return bad("invalid_option");
  const resolvedOptions = svc.options;
  if (
    resolvedOptions.some(
      (option) => !option.bookingDurationMin || !option.contents[0],
    )
  )
    return bad("invalid_option");
  if (!specialistId) return bad("specialist_required");
  if (!start || Number.isNaN(Date.parse(start))) return bad("invalid_start");

  const authUser = await currentUser("client");
  const accountClient =
    authUser?.role === "CLIENT"
      ? await prisma.client.findUnique({ where: { userId: authUser.id } })
      : null;
  const fullName = accountClient?.fullName.trim() || submittedFullName;
  const phone =
    normalizeInternationalPhone(accountClient?.phone ?? "") || submittedPhone;
  if (!fullName) return bad("name_required");
  if (!phone) return bad("phone_invalid");
  const formConfig = await loadConsultationForm();
  if (
    !formConfig ||
    !serializeConsultationForm(formConfig, locale) ||
    !isSensitiveDataEncryptionConfigured()
  )
    return NextResponse.json(
      { error: "consultation_unavailable", degraded: true },
      { status: 503 },
    );
  const existingProfile = accountClient
    ? await prisma.consultationProfile.findUnique({
        where: { clientId: accountClient.id },
      })
    : null;
  let existingProfileReadable = false;
  if (existingProfile) {
    try {
      decryptSavedConsultation(existingProfile);
      existingProfileReadable = true;
    } catch {
      existingProfileReadable = false;
    }
  }
  const consultationRequired =
    !accountClient ||
    !existingProfile ||
    !existingProfileReadable ||
    existingProfile.completedVersion < formConfig.requiredVersion;
  const preliminaryConsultation = consultationRequired
    ? validateConsultationSubmission(payload.consultation, formConfig, locale)
    : null;
  if (preliminaryConsultation && !preliminaryConsultation.ok)
    return bad(preliminaryConsultation.error);
  if (!procedureConsent) return bad("procedure_consent_required");
  if (
    !Number.isInteger(procedureConsentVersion) ||
    procedureConsentVersion !== formConfig.procedureConsentVersion
  )
    return bad("procedure_consent_stale");
  const wording = formConfig.procedureConsentWording as Record<
    string,
    unknown
  >;
  const procedureWordingSnapshot = String(wording?.[locale] ?? "").trim();
  if (!procedureWordingSnapshot) return bad("procedure_consent_unavailable");
  // Multi-procedure carts are ordinary bookings only — the account-gated
  // Endospheres intro offer never applies to them.
  const email = accountClient ? authUser!.email : submittedEmail;
  if (!EMAIL_RE.test(email)) return bad("email_required");
  if (!consentGdpr) return bad("consent_required");

  const startDate = new Date(start);
  if (startDate.getTime() <= Date.now()) return bad("start_in_past");
  const dateStr = clinicDateFromInstant(startDate);

  try {
    const serviceId = await getServiceId(svc.slug);
    const appointments = await prisma.$transaction(
      async (tx) => {
        const liveForm = await loadConsultationForm(tx);
        if (
          !liveForm ||
          procedureConsentVersion !== liveForm.procedureConsentVersion
        )
          throw new Error("procedure_consent_stale");
        if (!serializeConsultationForm(liveForm, locale))
          throw new Error("consultation_unavailable");
        const liveProfile = accountClient
          ? await tx.consultationProfile.findUnique({
              where: { clientId: accountClient.id },
            })
          : null;
        let liveProfileReadable = false;
        if (liveProfile) {
          try {
            decryptSavedConsultation(liveProfile);
            liveProfileReadable = true;
          } catch {
            liveProfileReadable = false;
          }
        }
        const liveConsultationRequired =
          !accountClient ||
          !liveProfile ||
          !liveProfileReadable ||
          liveProfile.completedVersion < liveForm.requiredVersion;
        const consultationSubmission = liveConsultationRequired
          ? validateConsultationSubmission(
              payload.consultation,
              liveForm,
              locale,
            )
          : null;
        if (consultationSubmission && !consultationSubmission.ok)
          throw new Error(consultationSubmission.error);
        const liveWording = liveForm.procedureConsentWording as Record<
          string,
          unknown
        >;
        const liveProcedureWording = String(liveWording?.[locale] ?? "").trim();
        if (!liveProcedureWording) throw new Error("procedure_consent_stale");

        const group = await openPublicGroupSlotCandidates(
          {
            dateStr,
            serviceKey: service,
            locale,
            start,
            optionKeys: resolvedOptions.map((option) => option.key),
            specialistId,
          },
          tx,
        );
        const matchingGroup =
          group.find(
            (candidate) => candidate.practitionerId === specialistId,
          ) ?? null;
        if (!matchingGroup || matchingGroup.legs.length !== resolvedOptions.length)
          throw new Error("slot_taken");

        // Lock and revalidate every leg's own resource window. Every leg
        // shares the same specialist and day, so this is a sequence of
        // small, individually-sorted lock acquisitions rather than one
        // combined one — safe against the single-procedure path's own
        // locking (same keys, same lock primitive), and in practice safe
        // here too since every concurrent attempt at this same cart walks
        // its legs in this identical, deterministic (displayOrder) order.
        for (let index = 0; index < matchingGroup.legs.length; index += 1) {
          const leg = matchingGroup.legs[index];
          const isLast = index === matchingGroup.legs.length - 1;
          const legEnd = new Date(leg.end);
          const reservedUntil = isLast
            ? new Date(legEnd.getTime() + APPOINTMENT_BUFFER_MINUTES * 60_000)
            : legEnd;
          const clash = await lockAndFindReservationConflict(tx, {
            start: new Date(leg.start),
            end: reservedUntil,
            practitionerIds: [matchingGroup.practitionerId],
            deviceId: leg.deviceId,
          });
          if (clash) throw new Error("slot_taken");
        }

        const existing = accountClient
          ? accountClient
          : await tx.client.findFirst({
              where: {
                userId: null,
                email: { equals: email, mode: "insensitive" },
              },
              orderBy: { updatedAt: "desc" },
            });
        const client = existing
          ? await tx.client.update({
              where: { id: existing.id },
              data: { fullName, phone, consentGdpr: true },
            })
          : await tx.client.create({
              data: { fullName, phone, email, consentGdpr: true },
            });
        if (consultationSubmission?.ok) {
          await tx.consultationProfile.upsert({
            where: { clientId: client.id },
            update: {
              completedVersion: liveForm.requiredVersion,
              ...consultationSubmission.encrypted,
              locale,
            },
            create: {
              clientId: client.id,
              completedVersion: liveForm.requiredVersion,
              ...consultationSubmission.encrypted,
              locale,
            },
          });
        }

        const bookingGroupId = crypto.randomUUID();
        const appointmentInclude = {
          client: {
            select: { fullName: true, email: true, phone: true },
          },
          service: { select: { slug: true } },
          practitioner: { select: { name: true, publicName: true } },
        } satisfies Prisma.AppointmentInclude;
        const created: Prisma.AppointmentGetPayload<{
          include: typeof appointmentInclude;
        }>[] = [];
        for (let index = 0; index < resolvedOptions.length; index += 1) {
          const option = resolvedOptions[index];
          const optionContent = option.contents[0];
          const leg = matchingGroup.legs[index];
          const isLast = index === resolvedOptions.length - 1;
          const legEnd = new Date(leg.end);
          const row = await tx.appointment.create({
            data: {
              clientId: client.id,
              contactName: fullName,
              contactEmail: email,
              contactPhone: phone,
              normalizedContactEmail: normalizeContactEmail(email),
              normalizedContactPhone: phone,
              practitionerId: matchingGroup.practitionerId,
              serviceId,
              roomId: matchingGroup.roomId,
              deviceId: leg.deviceId,
              locale,
              start: new Date(leg.start),
              end: legEnd,
              // Only the last leg carries the real preparation/cleaning
              // buffer; intermediate legs sit back-to-back with none of
              // their own (see lib/booking.ts's group scheduling notes).
              bufferMinutes: isLast ? APPOINTMENT_BUFFER_MINUTES : 0,
              reservedUntil: isLast
                ? new Date(legEnd.getTime() + APPOINTMENT_BUFFER_MINUTES * 60_000)
                : legEnd,
              bufferEnforced: true,
              status: "BOOKED",
              channel: "web",
              notes: index === 0 ? notes : null,
              procedureTitle: optionContent.name,
              procedurePrice: optionContent.priceLabel,
              serviceOptionId: option.id,
              bookingDurationMin: option.bookingDurationMin,
              bookingGroupId,
              bookingGroupIndex: index,
              bookingGroupCount: resolvedOptions.length,
            },
            include: appointmentInclude,
          });
          created.push(row);
        }

        const consultationConsents = consultationSubmission?.ok
          ? [
              {
                clientId: client.id,
                type: "health_profile",
                granted: true,
                locale,
                textVersion: liveForm.healthConsentVersion,
                wordingSnapshot: String(
                  (liveForm.healthConsentWording as Record<string, unknown>)[
                    locale
                  ] ?? "",
                ),
              },
              {
                clientId: client.id,
                type: "consultation_accuracy",
                granted: true,
                locale,
                textVersion: liveForm.accuracyVersion,
                wordingSnapshot: String(
                  (liveForm.accuracyWording as Record<string, unknown>)[
                    locale
                  ] ?? "",
                ),
              },
            ]
          : [];
        await tx.consent.createMany({
          data: [
            ...consultationConsents,
            ...created.flatMap((appointment) => [
              {
                clientId: client.id,
                appointmentId: appointment.id,
                type: "gdpr_booking",
                granted: true,
                locale,
              },
              {
                clientId: client.id,
                appointmentId: appointment.id,
                type: "procedure_booking",
                granted: true,
                locale,
                ...(Number.isInteger(procedureConsentVersion)
                  ? { textVersion: procedureConsentVersion }
                  : {}),
                wordingSnapshot: liveProcedureWording,
              },
            ]),
          ],
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const primary = appointments[0];
    let claimUrl: string | undefined;
    if (!accountClient) {
      try {
        claimUrl = await createAppointmentClaimUrl(
          { appointmentId: primary.id, email },
          locale,
        );
      } catch {
        await prisma.auditLog.create({
          data: {
            actor: "system",
            action: "appointment_claim_link_failed",
            outcome: "FAILURE",
            entity: "Appointment",
            entityId: primary.id,
          },
        });
      }
    }

    try {
      await notifyAppointmentGroupReceipt(
        appointments.map((appointment, index) => ({
          ...appointment,
          claimUrl: index === 0 ? claimUrl : undefined,
        })),
        locale,
      );
    } catch {
      await prisma.auditLog.create({
        data: {
          actor: "system",
          action: "booking_confirmation_unhandled_error",
          entity: "Appointment",
          entityId: primary.id,
        },
      });
    }

    return NextResponse.json({
      id: primary.id,
      groupId: primary.bookingGroupId,
      start: primary.start.toISOString(),
      manageUrl: appointmentManageUrl(primary.id, locale),
      serviceKey: svc.slug,
      procedures: appointments.map((appointment, index) => ({
        id: appointment.id,
        key: resolvedOptions[index].key,
        title: resolvedOptions[index].contents[0].name,
        price: resolvedOptions[index].contents[0].priceLabel,
        durationMin: resolvedOptions[index].bookingDurationMin,
        manageUrl: appointmentManageUrl(appointment.id, locale),
      })),
      specialist: {
        id: primary.practitionerId,
        name:
          primary.practitioner.publicName ??
          primary.practitioner.name.split(/\s+/)[0],
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "consultation_required",
        "consultation_invalid",
        "consultation_stale",
      ].includes(error.message)
    )
      return bad(error.message);
    if (error instanceof Error && error.message === "consultation_unavailable")
      return NextResponse.json(
        { error: "consultation_unavailable", degraded: true },
        { status: 503 },
      );
    if (error instanceof Error && error.message === "procedure_consent_stale")
      return bad("procedure_consent_stale");
    if (
      (error instanceof Error && error.message === "slot_taken") ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034")
    )
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    return NextResponse.json(
      { error: "unavailable", degraded: true },
      { status: 503 },
    );
  }
}

/** POST /api/booking: create an appointment (lean flow). */
export async function POST(req: NextRequest) {
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    }
    return bad("invalid_json");
  }

  // Multi-procedure cart: `options` (array) instead of a single `option`.
  // Everything below this point is the single-procedure path, unchanged.
  const groupOptionKeys = Array.isArray(payload.options)
    ? payload.options.filter((item): item is string => typeof item === "string")
    : undefined;
  if (groupOptionKeys && groupOptionKeys.length > 1)
    return createGroupBooking(payload, groupOptionKeys);

  const service = String(payload.service ?? "");
  const optionKey = String(payload.option ?? "");
  const start = String(payload.start ?? "");
  const specialistId = String(payload.specialistId ?? "").trim();
  const procedureConsentVersion = Number(payload.procedureConsentVersion);
  const submittedFullName = String(payload.fullName ?? "").trim();
  const submittedPhone = normalizeInternationalPhone(
    String(payload.phone ?? ""),
  );
  const submittedEmail = String(payload.email ?? "")
    .trim()
    .toLowerCase();
  const notes = payload.notes ? String(payload.notes).slice(0, 2000) : null;
  const locale = routing.locales.includes(payload.locale as Locale)
    ? (payload.locale as Locale)
    : routing.defaultLocale;
  const consentGdpr = payload.consentGdpr === true;
  const procedureConsent = payload.procedureConsent === true;

  const svc = await prisma.service.findFirst({
    where: {
      slug: service,
      bookable: true,
      ...(optionKey ? {} : { bookingPickerVisible: true }),
      archivedAt: null,
      contents: { some: { locale, status: "PUBLISHED" } },
    },
    include: {
      contents: {
        where: { locale, status: "PUBLISHED" },
        select: { whatItIs: true },
        take: 1,
      },
      options: {
        where: {
          key: optionKey,
          type: { in: ["APPOINTMENT", "COURSE"] },
          bookable: true,
          published: true,
          archivedAt: null,
          contents: { some: { locale, status: "PUBLISHED" } },
        },
        include: {
          contents: { where: { locale, status: "PUBLISHED" }, take: 1 },
        },
        take: 1,
      },
    },
  });
  if (!svc) return bad("unknown_service");
  const option = svc.options[0];
  const optionContent = option?.contents[0];
  if (!option || !optionContent || !option.bookingDurationMin)
    return bad("invalid_option");
  if (!specialistId) return bad("specialist_required");
  if (!start || Number.isNaN(Date.parse(start))) return bad("invalid_start");
  const authUser = await currentUser("client");
  const accountClient =
    authUser?.role === "CLIENT"
      ? await prisma.client.findUnique({ where: { userId: authUser.id } })
      : null;
  const fullName = accountClient?.fullName.trim() || submittedFullName;
  const phone =
    normalizeInternationalPhone(accountClient?.phone ?? "") || submittedPhone;
  if (!fullName) return bad("name_required");
  if (!phone) return bad("phone_invalid");
  const formConfig = await loadConsultationForm();
  if (
    !formConfig ||
    !serializeConsultationForm(formConfig, locale) ||
    !isSensitiveDataEncryptionConfigured()
  )
    return NextResponse.json(
      { error: "consultation_unavailable", degraded: true },
      { status: 503 },
    );
  const existingProfile = accountClient
    ? await prisma.consultationProfile.findUnique({
        where: { clientId: accountClient.id },
      })
    : null;
  let existingProfileReadable = false;
  if (existingProfile) {
    try {
      decryptSavedConsultation(existingProfile);
      existingProfileReadable = true;
    } catch {
      existingProfileReadable = false;
    }
  }
  const consultationRequired =
    !accountClient ||
    !existingProfile ||
    !existingProfileReadable ||
    existingProfile.completedVersion < formConfig.requiredVersion;
  const preliminaryConsultation = consultationRequired
    ? validateConsultationSubmission(payload.consultation, formConfig, locale)
    : null;
  if (preliminaryConsultation && !preliminaryConsultation.ok)
    return bad(preliminaryConsultation.error);
  if (!procedureConsent) return bad("procedure_consent_required");
  if (
    !Number.isInteger(procedureConsentVersion) ||
    procedureConsentVersion !== formConfig.procedureConsentVersion
  )
    return bad("procedure_consent_stale");
  const wording = formConfig.procedureConsentWording as Record<string, unknown>;
  const procedureWordingSnapshot = String(wording?.[locale] ?? "").trim();
  if (!procedureWordingSnapshot) return bad("procedure_consent_unavailable");
  const offerRequiresAccount =
    svc.offerRequiresAccount || option.offerRequiresAccount;
  if (offerRequiresAccount && !accountClient) {
    return NextResponse.json(
      { error: "offer_account_required" },
      { status: 401 },
    );
  }
  const email = accountClient ? authUser!.email : submittedEmail;
  if (!EMAIL_RE.test(email)) return bad("email_required");
  if (!consentGdpr) return bad("consent_required");

  const startDate = new Date(start);
  if (startDate.getTime() <= Date.now()) return bad("start_in_past");
  const dateStr = clinicDateFromInstant(startDate);

  try {
    const serviceId = await getServiceId(svc.slug);
    const appointment = await prisma.$transaction(
      async (tx) => {
        const liveForm = await loadConsultationForm(tx);
        if (
          !liveForm ||
          procedureConsentVersion !== liveForm.procedureConsentVersion
        )
          throw new Error("procedure_consent_stale");
        if (!serializeConsultationForm(liveForm, locale))
          throw new Error("consultation_unavailable");
        const liveProfile = accountClient
          ? await tx.consultationProfile.findUnique({
              where: { clientId: accountClient.id },
            })
          : null;
        let liveProfileReadable = false;
        if (liveProfile) {
          try {
            decryptSavedConsultation(liveProfile);
            liveProfileReadable = true;
          } catch {
            liveProfileReadable = false;
          }
        }
        const liveConsultationRequired =
          !accountClient ||
          !liveProfile ||
          !liveProfileReadable ||
          liveProfile.completedVersion < liveForm.requiredVersion;
        const consultationSubmission = liveConsultationRequired
          ? validateConsultationSubmission(
              payload.consultation,
              liveForm,
              locale,
            )
          : null;
        if (consultationSubmission && !consultationSubmission.ok)
          throw new Error(consultationSubmission.error);
        const liveWording = liveForm.procedureConsentWording as Record<
          string,
          unknown
        >;
        const liveProcedureWording = String(liveWording?.[locale] ?? "").trim();
        if (!liveProcedureWording) throw new Error("procedure_consent_stale");
        if (offerRequiresAccount) {
          const accountPhone = normalizeInternationalPhone(
            accountClient?.phone ?? "",
          );
          const identityMatches = await tx.client.findMany({
            where: {
              OR: [
                {
                  email: {
                    equals: authUser!.email,
                    mode: "insensitive",
                  },
                },
                ...(accountPhone ? [{ phone: accountPhone }] : []),
              ],
            },
            select: { id: true },
          });
          const prior = identityMatches.length
            ? await tx.appointment.findFirst({
                where: {
                  clientId: { in: identityMatches.map((client) => client.id) },
                  status: { not: "CANCELLED" },
                  service: {
                    OR: [
                      { bookingFamily: ENDOSPHERES_BOOKING_FAMILY },
                      { slug: ENDOSPHERES_BOOKING_FAMILY },
                    ],
                  },
                },
                select: { id: true },
              })
            : null;
          if (prior) throw new Error("offer_not_eligible");
        }
        const candidates = await openPublicSlotCandidates(
          {
            dateStr,
            serviceKey: service,
            locale,
            start,
            optionKey,
            specialistId,
          },
          tx,
        );
        if (!candidates.length) throw new Error("slot_taken");
        const matchingSlot =
          candidates.find(
            (candidate) => candidate.practitionerId === specialistId,
          ) ?? null;
        if (matchingSlot) {
          const reservedUntil = new Date(
            new Date(matchingSlot.end).getTime() +
              APPOINTMENT_BUFFER_MINUTES * 60_000,
          );
          const clash = await lockAndFindReservationConflict(tx, {
            start: startDate,
            end: reservedUntil,
            practitionerIds: [matchingSlot.practitionerId],
            // Rooms never gate online booking availability: only specialist
            // and (where required) device conflicts are checked here.
            deviceId: matchingSlot.deviceId,
          });
          if (clash) throw new Error("slot_taken");
        }
        if (!matchingSlot) throw new Error("slot_taken");
        const existing = accountClient
          ? accountClient
          : await tx.client.findFirst({
              where: {
                userId: null,
                email: { equals: email, mode: "insensitive" },
              },
              orderBy: { updatedAt: "desc" },
            });
        const client = existing
          ? await tx.client.update({
              where: { id: existing.id },
              data: { fullName, phone, consentGdpr: true },
            })
          : await tx.client.create({
              data: { fullName, phone, email, consentGdpr: true },
            });
        if (consultationSubmission?.ok) {
          await tx.consultationProfile.upsert({
            where: { clientId: client.id },
            update: {
              completedVersion: liveForm.requiredVersion,
              ...consultationSubmission.encrypted,
              locale,
            },
            create: {
              clientId: client.id,
              completedVersion: liveForm.requiredVersion,
              ...consultationSubmission.encrypted,
              locale,
            },
          });
        }
        const created = await tx.appointment.create({
          data: {
            clientId: client.id,
            contactName: fullName,
            contactEmail: email,
            contactPhone: phone,
            normalizedContactEmail: normalizeContactEmail(email),
            normalizedContactPhone: phone,
            practitionerId: matchingSlot.practitionerId,
            serviceId,
            roomId: matchingSlot.roomId,
            deviceId: matchingSlot.deviceId,
            locale,
            start: startDate,
            end: new Date(matchingSlot.end),
            bufferMinutes: APPOINTMENT_BUFFER_MINUTES,
            reservedUntil: new Date(
              new Date(matchingSlot.end).getTime() +
                APPOINTMENT_BUFFER_MINUTES * 60_000,
            ),
            bufferEnforced: true,
            status: "BOOKED",
            channel: "web",
            notes,
            procedureIndex: option.legacyProcedureIndex,
            procedureTitle: optionContent.name,
            procedurePrice: optionContent.priceLabel,
            serviceOptionId: option.id,
            bookingDurationMin: option.bookingDurationMin,
          },
          include: {
            client: { select: { fullName: true, email: true, phone: true } },
            service: { select: { slug: true } },
            practitioner: { select: { name: true, publicName: true } },
          },
        });
        const consultationConsents = consultationSubmission?.ok
          ? [
              {
                clientId: client.id,
                type: "health_profile",
                granted: true,
                locale,
                textVersion: liveForm.healthConsentVersion,
                wordingSnapshot: String(
                  (liveForm.healthConsentWording as Record<string, unknown>)[
                    locale
                  ] ?? "",
                ),
              },
              {
                clientId: client.id,
                type: "consultation_accuracy",
                granted: true,
                locale,
                textVersion: liveForm.accuracyVersion,
                wordingSnapshot: String(
                  (liveForm.accuracyWording as Record<string, unknown>)[
                    locale
                  ] ?? "",
                ),
              },
            ]
          : [];
        await tx.consent.createMany({
          data: [
            ...consultationConsents,
            {
              clientId: client.id,
              appointmentId: created.id,
              type: "gdpr_booking",
              granted: true,
              locale,
            },
            {
              clientId: client.id,
              appointmentId: created.id,
              type: "procedure_booking",
              granted: true,
              locale,
              ...(Number.isInteger(procedureConsentVersion)
                ? { textVersion: procedureConsentVersion }
                : {}),
              wordingSnapshot: liveProcedureWording,
            },
          ],
        });
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    // Guests get the account-claim link as a secondary CTA inside the localized confirmation
    // email rather than a second, English-only message of its own.
    let claimUrl: string | undefined;
    if (!accountClient) {
      try {
        claimUrl = await createAppointmentClaimUrl(
          { appointmentId: appointment.id, email },
          locale,
        );
      } catch {
        await prisma.auditLog.create({
          data: {
            actor: "system",
            action: "appointment_claim_link_failed",
            outcome: "FAILURE",
            entity: "Appointment",
            entityId: appointment.id,
          },
        });
      }
    }

    try {
      await notifyAppointmentReceipt({ ...appointment, claimUrl }, locale);
    } catch {
      await prisma.auditLog.create({
        data: {
          actor: "system",
          action: "booking_confirmation_unhandled_error",
          entity: "Appointment",
          entityId: appointment.id,
        },
      });
    }

    return NextResponse.json({
      id: appointment.id,
      start: appointment.start.toISOString(),
      manageUrl: appointmentManageUrl(appointment.id, locale),
      serviceKey: svc.slug,
      option: {
        key: option.key,
        title: optionContent.name,
        price: optionContent.priceLabel,
        durationMin: option.bookingDurationMin,
      },
      specialist: {
        id: appointment.practitionerId,
        name:
          appointment.practitioner.publicName ??
          appointment.practitioner.name.split(/\s+/)[0],
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      [
        "consultation_required",
        "consultation_invalid",
        "consultation_stale",
      ].includes(error.message)
    )
      return bad(error.message);
    if (error instanceof Error && error.message === "consultation_unavailable")
      return NextResponse.json(
        { error: "consultation_unavailable", degraded: true },
        { status: 503 },
      );
    if (error instanceof Error && error.message === "procedure_consent_stale")
      return bad("procedure_consent_stale");
    if (error instanceof Error && error.message === "offer_not_eligible") {
      return NextResponse.json(
        { error: "offer_not_eligible" },
        { status: 409 },
      );
    }
    if (
      offerRequiresAccount &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "offer_not_eligible" },
        { status: 409 },
      );
    }
    if (
      (error instanceof Error && error.message === "slot_taken") ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034")
    )
      return NextResponse.json({ error: "slot_taken" }, { status: 409 });
    // DB unavailable: signal the wizard to show its call/email fallback.
    return NextResponse.json(
      { error: "unavailable", degraded: true },
      { status: 503 },
    );
  }
}
