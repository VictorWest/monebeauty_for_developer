import { prisma } from "../lib/db";
import { notifyAppointmentReminder } from "../lib/notifications";
import type { Locale } from "../i18n/routing";

const WINDOW_MINUTES = Number(process.env.REMINDER_WINDOW_MINUTES ?? 60);
type ReminderKind = "reminder_24h" | "reminder_2h";

function windowFor(hoursAhead: number) {
  const now = new Date();
  const center = now.getTime() + hoursAhead * 60 * 60 * 1000;
  const halfWindow = Math.max(5, WINDOW_MINUTES) * 30 * 1000;
  return {
    gte: new Date(center - halfWindow),
    lt: new Date(center + halfWindow),
  };
}

async function alreadyHandled(appointmentId: string, kind: ReminderKind) {
  const messageKind =
    kind === "reminder_24h"
      ? "APPOINTMENT_REMINDER_24H"
      : "APPOINTMENT_REMINDER_2H";
  const communication = await prisma.outboundMessage.findFirst({
    where: {
      appointmentId,
      kind: messageKind,
      attempts: { some: { status: "ACCEPTED" } },
    },
    select: { id: true },
  });
  if (communication) return true;
  const existing = await prisma.auditLog.findFirst({
    where: {
      entity: "Appointment",
      entityId: appointmentId,
      action: {
        in: [`booking_${kind}_email_sent`, `booking_${kind}_sms_sent`],
      },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

async function sendWindow(kind: ReminderKind, hoursAhead: number) {
  const appointments = await prisma.appointment.findMany({
    where: {
      status: { in: ["BOOKED", "CONFIRMED"] },
      start: windowFor(hoursAhead),
    },
    include: {
      client: { select: { fullName: true, email: true, phone: true } },
      practitioner: { select: { name: true, role: true } },
      service: { select: { slug: true } },
    },
    orderBy: { start: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appointment of appointments) {
    if (await alreadyHandled(appointment.id, kind)) {
      skipped++;
      continue;
    }

    try {
      await notifyAppointmentReminder(
        appointment,
        kind,
        appointment.locale as Locale,
      );
      sent++;
    } catch (error) {
      failed++;
      await prisma.auditLog.create({
        data: {
          actor: "system",
          action: `booking_${kind}_unhandled_error`,
          entity: "Appointment",
          entityId: appointment.id,
        },
      });
      console.error(
        `Failed to send ${kind} for appointment ${appointment.id}:`,
        error,
      );
    }
  }

  return { kind, checked: appointments.length, sent, skipped, failed };
}

async function main() {
  const results = [
    await sendWindow("reminder_24h", 24),
    await sendWindow("reminder_2h", 2),
  ];
  console.log(JSON.stringify({ ok: true, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
