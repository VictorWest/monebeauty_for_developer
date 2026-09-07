"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/auth";
import {
  appointmentIdFromManageToken,
  validAppointmentManageToken,
} from "@/lib/appointment-access";
import {
  APPOINTMENT_BUFFER_MINUTES,
  openPublicSlotCandidates,
} from "@/lib/booking";
import { lockAndFindReservationConflict } from "@/lib/calendar-blocks";
import { clinicDateFromInstant } from "@/lib/clinic-time";
import { notifyAppointmentChange } from "@/lib/notifications";
import { localizedPath } from "@/lib/seo";
import { PUBLIC_PATHS } from "@/lib/public-routes";
import type { Locale } from "@/i18n/routing";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function localeFrom(formData: FormData): Locale {
  const value = text(formData, "locale");
  return value === "en" || value === "ru" ? value : "fi";
}

function manageHref(
  locale: Locale,
  token: string,
  params: Record<string, string>,
) {
  const query = new URLSearchParams({ token, ...params });
  return `${localizedPath(PUBLIC_PATHS.manageAppointment, locale)}?${query}`;
}

/**
 * Loads an appointment from a signed manage link. Returns null when the token is invalid,
 * the appointment is gone, already cancelled, or in the past — the page renders those
 * read-only, so there is nothing for the caller to act on.
 */
async function openAppointmentForToken(token: string) {
  const id = token ? appointmentIdFromManageToken(token) : null;
  if (!id || !validAppointmentManageToken(id, token)) return null;
  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: { client: true, service: true, serviceOption: true },
  });
  if (!appointment) return null;
  if (appointment.start <= new Date()) return null;
  if (appointment.status === "CANCELLED" || appointment.status === "COMPLETED")
    return null;
  return appointment;
}

/** Cancels an appointment straight away from an emailed manage link — no account required. */
export async function cancelAppointmentByTokenAction(formData: FormData) {
  const locale = localeFrom(formData);
  const token = text(formData, "token");
  const reason = text(formData, "reason").slice(0, 500) || null;
  const appointment = await openAppointmentForToken(token);
  if (!appointment) redirect(manageHref(locale, token, { error: "invalid" }));

  const cancelled = await prisma.$transaction(async (tx) => {
    const updated = await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancellationReason: reason,
        version: { increment: 1 },
      },
      include: { client: true, service: true },
    });
    await tx.appointmentEvent.create({
      data: {
        appointmentId: appointment.id,
        kind: "CANCELLED",
        actor: "client",
        previousStatus: appointment.status,
        nextStatus: "CANCELLED",
        reason,
      },
    });
    return updated;
  });

  await notifyAppointmentChange(
    cancelled,
    "cancellation",
    cancelled.locale as Locale,
    reason,
    "client",
  );
  await audit({
    actor: `client:${appointment.contactEmail}`,
    action: "appointment_cancelled_by_client",
    entity: "Appointment",
    entityId: appointment.id,
    metadata: { reason },
  });
  redirect(manageHref(locale, token, { done: "cancelled" }));
}

/** Moves an appointment to another open slot straight away from an emailed manage link. */
export async function rescheduleAppointmentByTokenAction(formData: FormData) {
  const locale = localeFrom(formData);
  const token = text(formData, "token");
  const start = text(formData, "start");
  const appointment = await openAppointmentForToken(token);
  if (!appointment) redirect(manageHref(locale, token, { error: "invalid" }));
  const startDate = new Date(start);
  if (!start || Number.isNaN(startDate.getTime()) || startDate <= new Date())
    redirect(manageHref(locale, token, { error: "invalid_time" }));

  const rescheduled = await prisma
    .$transaction(async (tx) => {
      const candidates = await openPublicSlotCandidates(
        {
          dateStr: clinicDateFromInstant(startDate),
          serviceKey: appointment.service.slug,
          locale: appointment.locale as Locale,
          start,
          optionKey: appointment.serviceOption?.key,
          specialistId: appointment.practitionerId,
        },
        tx,
      );
      let matching: (typeof candidates)[number] | null = null;
      for (const candidate of candidates) {
        const reservedUntil = new Date(
          new Date(candidate.end).getTime() +
            APPOINTMENT_BUFFER_MINUTES * 60_000,
        );
        const clash = await lockAndFindReservationConflict(tx, {
          start: new Date(candidate.start),
          end: reservedUntil,
          practitionerIds: [candidate.practitionerId],
          roomId: candidate.roomId,
          deviceId: candidate.deviceId,
          excludeAppointmentId: appointment.id,
        });
        if (!clash) {
          matching = candidate;
          break;
        }
      }
      if (!matching) throw new Error("slot_taken");
      const updated = await tx.appointment.update({
        where: { id: appointment.id },
        data: {
          start: new Date(matching.start),
          end: new Date(matching.end),
          bufferMinutes: APPOINTMENT_BUFFER_MINUTES,
          reservedUntil: new Date(
            new Date(matching.end).getTime() +
              APPOINTMENT_BUFFER_MINUTES * 60_000,
          ),
          bufferEnforced: true,
          practitionerId: matching.practitionerId,
          roomId: matching.roomId,
          deviceId: matching.deviceId,
          status: "BOOKED",
          confirmedAt: null,
          version: { increment: 1 },
        },
        include: { client: true, service: true },
      });
      await tx.appointmentEvent.create({
        data: {
          appointmentId: appointment.id,
          kind: "RESCHEDULED",
          actor: "client",
          previousStatus: appointment.status,
          nextStatus: "BOOKED",
          previousStart: appointment.start,
          previousEnd: appointment.end,
          nextStart: updated.start,
          nextEnd: updated.end,
        },
      });
      return updated;
    })
    .catch((error: unknown) => {
      if (error instanceof Error && error.message === "slot_taken") return null;
      throw error;
    });
  if (!rescheduled)
    redirect(manageHref(locale, token, { error: "slot_taken" }));

  await notifyAppointmentChange(
    rescheduled,
    "rescheduled",
    rescheduled.locale as Locale,
    null,
    "client",
  );
  await audit({
    actor: `client:${appointment.contactEmail}`,
    action: "appointment_rescheduled_by_client",
    entity: "Appointment",
    entityId: appointment.id,
    metadata: {
      from: appointment.start.toISOString(),
      to: rescheduled.start.toISOString(),
    },
  });
  redirect(manageHref(locale, token, { done: "rescheduled" }));
}
