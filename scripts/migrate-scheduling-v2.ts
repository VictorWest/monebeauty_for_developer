import { PrismaClient } from "@prisma/client";
import { clinicDateTimeToInstant, minuteLabel } from "../lib/clinic-time";
import { normalizeSlots, scheduleStorageValue } from "../lib/staff-schedule";

const prisma = new PrismaClient();
const ACTION = "scheduling_helsinki_time_v2_migrated";
const apply = process.argv.includes("--apply");

function legacyWallClockToInstant(value: Date) {
  const date = value.toISOString().slice(0, 10);
  const minute = value.getUTCHours() * 60 + value.getUTCMinutes();
  const converted = clinicDateTimeToInstant(date, minuteLabel(minute));
  if (!converted)
    throw new Error(`Invalid Helsinki wall time ${value.toISOString()}`);
  return converted;
}

function migratedSlots(value: unknown) {
  return normalizeSlots(value).map((slot) => ({
    ...slot,
    start: legacyWallClockToInstant(new Date(slot.start)).toISOString(),
    end: legacyWallClockToInstant(new Date(slot.end)).toISOString(),
  }));
}

async function main() {
  const completed = await prisma.auditLog.findFirst({
    where: { action: ACTION, outcome: "SUCCESS" },
    select: { id: true, at: true },
  });
  if (completed) {
    console.log(
      JSON.stringify({ status: "already_applied", at: completed.at }),
    );
    return;
  }

  const [
    practitioners,
    availabilities,
    appointments,
    blocks,
    changeRequests,
    appointmentEvents,
  ] =
    await Promise.all([
      prisma.practitioner
        .findMany({ select: { id: true, workingHours: true } })
        .then((rows) => rows.filter((row) => row.workingHours !== null)),
      prisma.availability.findMany({ select: { id: true, slots: true } }),
      prisma.appointment.findMany({
        select: { id: true, start: true, end: true },
      }),
      prisma.calendarBlock.findMany({
        select: { id: true, start: true, end: true },
      }),
      prisma.appointmentChangeRequest.findMany({
        where: { requestedStart: { not: null } },
        select: { id: true, requestedStart: true },
      }),
      prisma.appointmentEvent.findMany({
        where: {
          OR: [
            { previousStart: { not: null } },
            { previousEnd: { not: null } },
            { nextStart: { not: null } },
            { nextEnd: { not: null } },
          ],
        },
        select: {
          id: true,
          previousStart: true,
          previousEnd: true,
          nextStart: true,
          nextEnd: true,
        },
      }),
    ]);

  const summary = {
    mode: apply ? "apply" : "dry_run",
    practitioners: practitioners.length,
    availabilities: availabilities.length,
    appointments: appointments.length,
    blocks: blocks.length,
    changeRequests: changeRequests.length,
    appointmentEvents: appointmentEvents.length,
  };
  if (!apply) {
    console.log(JSON.stringify(summary, null, 2));
    console.log("Re-run with --apply after taking a database backup.");
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const practitioner of practitioners) {
        await tx.practitioner.update({
          where: { id: practitioner.id },
          data: {
            workingHours: scheduleStorageValue(practitioner.workingHours),
          },
        });
      }
      for (const availability of availabilities) {
        await tx.availability.update({
          where: { id: availability.id },
          data: { slots: migratedSlots(availability.slots) },
        });
      }
      for (const appointment of appointments) {
        await tx.appointment.update({
          where: { id: appointment.id },
          data: {
            start: legacyWallClockToInstant(appointment.start),
            end: legacyWallClockToInstant(appointment.end),
          },
        });
      }
      for (const block of blocks) {
        await tx.calendarBlock.update({
          where: { id: block.id },
          data: {
            start: legacyWallClockToInstant(block.start),
            end: legacyWallClockToInstant(block.end),
          },
        });
      }
      for (const request of changeRequests) {
        await tx.appointmentChangeRequest.update({
          where: { id: request.id },
          data: {
            requestedStart: legacyWallClockToInstant(request.requestedStart!),
          },
        });
      }
      for (const event of appointmentEvents) {
        const convert = (value: Date | null) =>
          value ? legacyWallClockToInstant(value) : null;
        await tx.appointmentEvent.update({
          where: { id: event.id },
          data: {
            previousStart: convert(event.previousStart),
            previousEnd: convert(event.previousEnd),
            nextStart: convert(event.nextStart),
            nextEnd: convert(event.nextEnd),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actor: "system",
          action: ACTION,
          outcome: "SUCCESS",
          entity: "Scheduling",
          metadata: summary,
        },
      });
    },
    { timeout: 120_000 },
  );
  console.log(JSON.stringify({ ...summary, status: "complete" }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
