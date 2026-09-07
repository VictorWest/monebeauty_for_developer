import "server-only";

import { prisma } from "@/lib/db";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contact-normalization";
import {
  decryptSensitiveJson,
  decryptSensitiveText,
} from "@/lib/sensitive-data";

/**
 * Attaches unregistered guest history to a verified client account. The immutable order and
 * appointment contact snapshots are deliberately not updated here.
 */
export async function reconcileGuestHistory(userId: string) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { client: true },
    });
    if (
      !user ||
      user.role !== "CLIENT" ||
      !user.emailVerifiedAt ||
      !user.client
    ) {
      return { orders: 0, appointments: 0 };
    }

    const email = normalizeContactEmail(user.email);
    const phone = normalizeContactPhone(user.client.phone);
    if (!email && !phone) return { orders: 0, appointments: 0 };

    const otherVerifiedEmails = (
      await tx.user.findMany({
        where: {
          id: { not: user.id },
          role: "CLIENT",
          emailVerifiedAt: { not: null },
        },
        select: { email: true },
      })
    )
      .map((candidate) => normalizeContactEmail(candidate.email))
      .filter((candidate): candidate is string => Boolean(candidate));

    const phoneIsSafe = (snapshotEmail: string | null) =>
      !snapshotEmail || !otherVerifiedEmails.includes(snapshotEmail);
    const guestOwner = { is: { userId: null } } as const;

    const [orders, appointments] = await Promise.all([
      tx.order.findMany({
        where: {
          AND: [
            { OR: [{ clientId: null }, { client: guestOwner }] },
            {
              OR: [
                ...(email ? [{ normalizedEmail: email }] : []),
                ...(phone ? [{ normalizedPhone: phone }] : []),
              ],
            },
          ],
        },
        select: {
          id: true,
          clientId: true,
          normalizedEmail: true,
          normalizedPhone: true,
        },
      }),
      tx.appointment.findMany({
        where: {
          client: guestOwner,
          OR: [
            ...(email ? [{ normalizedContactEmail: email }] : []),
            ...(phone ? [{ normalizedContactPhone: phone }] : []),
          ],
        },
        select: {
          id: true,
          clientId: true,
          normalizedContactEmail: true,
          normalizedContactPhone: true,
        },
      }),
    ]);

    let linkedOrders = 0;
    let linkedAppointments = 0;
    const linkedAppointmentIds: string[] = [];
    const matchedGuestClients = new Map<string, "email" | "phone">();
    for (const order of orders) {
      const method =
        email && order.normalizedEmail === email
          ? "email"
          : phone &&
              order.normalizedPhone === phone &&
              phoneIsSafe(order.normalizedEmail)
            ? "phone"
            : null;
      if (!method) continue;
      const changed = await tx.order.updateMany({
        where: {
          id: order.id,
          ...(order.clientId
            ? { clientId: order.clientId, client: guestOwner }
            : { clientId: null }),
        },
        data: { clientId: user.client.id },
      });
      if (!changed.count) continue;
      linkedOrders += 1;
      await tx.auditLog.create({
        data: {
          actor: user.email,
          actorUserId: user.id,
          actorRole: "CLIENT",
          action: "guest_history_linked",
          entity: "Order",
          entityId: order.id,
          metadata: { matchMethod: method, recordType: "order" },
        },
      });
    }

    for (const appointment of appointments) {
      const method =
        email && appointment.normalizedContactEmail === email
          ? "email"
          : phone &&
              appointment.normalizedContactPhone === phone &&
              phoneIsSafe(appointment.normalizedContactEmail)
            ? "phone"
            : null;
      if (!method) continue;
      const changed = await tx.appointment.updateMany({
        where: {
          id: appointment.id,
          clientId: appointment.clientId,
          client: guestOwner,
        },
        data: { clientId: user.client.id },
      });
      if (!changed.count) continue;
      linkedAppointments += 1;
      linkedAppointmentIds.push(appointment.id);
      matchedGuestClients.set(appointment.clientId, method);
      await tx.appointmentChangeRequest.updateMany({
        where: { appointmentId: appointment.id },
        data: { clientId: user.client.id },
      });
      await tx.auditLog.create({
        data: {
          actor: user.email,
          actorUserId: user.id,
          actorRole: "CLIENT",
          action: "guest_history_linked",
          entity: "Appointment",
          entityId: appointment.id,
          metadata: { matchMethod: method, recordType: "appointment" },
        },
      });
    }

    const guestClientIds = [...matchedGuestClients.keys()];
    if (guestClientIds.length) {
      await tx.consent.updateMany({
        where: {
          OR: [
            {
              clientId: { in: guestClientIds },
              type: { in: ["health_profile", "consultation_accuracy"] },
            },
            ...(linkedAppointmentIds.length
              ? [{ appointmentId: { in: linkedAppointmentIds } }]
              : []),
          ],
        },
        data: { clientId: user.client.id },
      });

      const profiles = await tx.consultationProfile.findMany({
        where: { clientId: { in: [user.client.id, ...guestClientIds] } },
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      });
      const canonical = profiles.find((profile) => {
        try {
          decryptSensitiveText(profile.dateOfBirthEncrypted);
          decryptSensitiveJson(profile.answersEncrypted);
          return true;
        } catch {
          return false;
        }
      });
      if (canonical && canonical.clientId !== user.client.id) {
        await tx.consultationProfile.upsert({
          where: { clientId: user.client.id },
          update: {
            formId: canonical.formId,
            completedVersion: canonical.completedVersion,
            dateOfBirthEncrypted: canonical.dateOfBirthEncrypted,
            answersEncrypted: canonical.answersEncrypted,
            locale: canonical.locale,
          },
          create: {
            clientId: user.client.id,
            formId: canonical.formId,
            completedVersion: canonical.completedVersion,
            dateOfBirthEncrypted: canonical.dateOfBirthEncrypted,
            answersEncrypted: canonical.answersEncrypted,
            locale: canonical.locale,
          },
        });
        await tx.auditLog.create({
          data: {
            actor: user.email,
            actorUserId: user.id,
            actorRole: "CLIENT",
            action: "guest_consultation_reconciled",
            entity: "ConsultationProfile",
            entityId: user.client.id,
            metadata: {
              matchMethod:
                matchedGuestClients.get(canonical.clientId) ?? "email",
              recordType: "consultation_profile",
            },
          },
        });
      }
      await tx.consultationProfile.deleteMany({
        where: { clientId: { in: guestClientIds } },
      });
    }

    return { orders: linkedOrders, appointments: linkedAppointments };
  });
}
