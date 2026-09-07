import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  CALENDAR_BLOCK_MAX_OCCURRENCES,
  endFromSequentialItems,
  expandCalendarRecurrence,
  lockAndFindReservationConflict,
  snapToCalendarQuarter,
} from "@/lib/calendar-blocks";
import { dateFromYmd } from "@/lib/staff-schedule";
import {
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

function bad(error: string, status = 400, detail?: unknown) {
  return NextResponse.json({ error, detail }, { status });
}

export async function POST(req: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return bad("forbidden", 403);
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return bad("invalid_json");
  const rawTargets = Array.isArray(payload.targets) ? payload.targets : [];
  const parsedTargets = rawTargets.map((value) => {
    const target = value as Record<string, unknown>;
    return {
      date: String(target.date ?? ""),
      practitionerIds: Array.isArray(target.practitionerIds)
        ? [...new Set(target.practitionerIds.map(String).filter(Boolean))]
        : [],
    };
  });
  if (
    parsedTargets.length > 42 ||
    parsedTargets.some(
      (target) => !dateFromYmd(target.date) || !target.practitionerIds.length,
    ) ||
    new Set(parsedTargets.map((target) => target.date)).size !==
      parsedTargets.length
  )
    return bad("invalid_targets");

  const requestedParticipants = parsedTargets.length
    ? [...new Set(parsedTargets.flatMap((target) => target.practitionerIds))]
    : Array.isArray(payload.practitionerIds)
      ? [...new Set(payload.practitionerIds.map(String).filter(Boolean))]
      : [];
  const practitionerIds = requestedParticipants;
  if (!practitionerIds.length) return bad("employee_required");
  const targets = parsedTargets.map((target) => ({
    ...target,
    practitionerIds: target.practitionerIds,
  }));

  const rawItems = Array.isArray(payload.items) ? payload.items : [];
  const itemInputs = rawItems.map((value) => {
    const item = value as Record<string, unknown>;
    return {
      templateId: String(item.templateId ?? ""),
      durationMin: Number(item.durationMin),
    };
  });
  if (
    !itemInputs.length ||
    itemInputs.some(
      (item) =>
        !item.templateId ||
        !Number.isInteger(item.durationMin) ||
        item.durationMin < 15 ||
        item.durationMin % 15,
    )
  )
    return bad("invalid_items");

  const start = snapToCalendarQuarter(new Date(String(payload.start ?? "")));
  if (Number.isNaN(start.getTime())) return bad("invalid_time");
  const end = endFromSequentialItems(start, itemInputs);
  const roomId = String(payload.roomId ?? "") || null;
  const deviceId = String(payload.deviceId ?? "") || null;
  if (roomId && deviceId) return bad("one_resource_only");
  const weekdays = Array.isArray(payload.weekdays)
    ? payload.weekdays.map(Number)
    : [];
  const recurrenceEnd = payload.recurrenceEnd
    ? new Date(String(payload.recurrenceEnd))
    : null;
  if (targets.length && (weekdays.length || recurrenceEnd))
    return bad("range_recurrence_unsupported");

  let starts: Date[];
  try {
    starts = expandCalendarRecurrence({
      start,
      weekdays,
      endDate: recurrenceEnd,
    });
  } catch (error) {
    return bad(error instanceof Error ? error.message : "invalid_recurrence");
  }
  if (starts.length > CALENDAR_BLOCK_MAX_OCCURRENCES)
    return bad("occurrence_limit");

  const [templates, employeeCount, room, device] = await Promise.all([
    prisma.calendarBlockTemplate.findMany({
      where: {
        id: { in: itemInputs.map((item) => item.templateId) },
        active: true,
      },
    }),
    prisma.practitioner.count({
      where: { id: { in: practitionerIds }, active: true },
    }),
    roomId
      ? prisma.room.findFirst({
          where: { id: roomId, active: true },
          select: { id: true },
        })
      : null,
    deviceId
      ? prisma.device.findFirst({
          where: { id: deviceId, active: true },
          select: { id: true },
        })
      : null,
  ]);
  if (
    templates.length !== new Set(itemInputs.map((item) => item.templateId)).size
  )
    return bad("invalid_template");
  if (employeeCount !== practitionerIds.length) return bad("invalid_employee");
  if (roomId && !room) return bad("invalid_room");
  if (deviceId && !device) return bad("invalid_device");
  const byId = new Map(templates.map((template) => [template.id, template]));
  const durationMs = end.getTime() - start.getTime();
  const reservations = targets.length
    ? targets.map((target) => {
        const occurrenceStart = clinicDateTimeToInstant(
          target.date,
          clinicTimeFromInstant(start),
        )!;
        return {
          start: occurrenceStart,
          end: new Date(occurrenceStart.getTime() + durationMs),
          practitionerIds: target.practitionerIds,
          roomId,
          deviceId,
        };
      })
    : starts.map((occurrenceStart) => ({
        start: occurrenceStart,
        end: new Date(occurrenceStart.getTime() + durationMs),
        practitionerIds,
        roomId,
        deviceId,
      }));
  if (reservations.some((reservation) => reservation.start <= new Date()))
    return bad("start_in_past");

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        for (const reservation of reservations) {
          const conflict = await lockAndFindReservationConflict(
            tx,
            reservation,
          );
          if (conflict) {
            throw new Error(
              `reservation_conflict|${reservation.start.toISOString()}|${conflict.resource}`,
            );
          }
        }
        const series =
          !targets.length && starts.length > 1
            ? await tx.calendarBlockSeries.create({
                data: {
                  weekdays: [...new Set(weekdays)].sort(),
                  endDate: recurrenceEnd!,
                  createdBy: user.email,
                },
              })
            : null;
        const ids: string[] = [];
        for (const reservation of reservations) {
          const block = await tx.calendarBlock.create({
            data: {
              seriesId: series?.id,
              start: reservation.start,
              end: reservation.end,
              notes:
                String(payload.notes ?? "")
                  .trim()
                  .slice(0, 2000) || null,
              roomId,
              deviceId,
              createdBy: user.email,
              participants: {
                create: reservation.practitionerIds.map((practitionerId) => ({
                  practitionerId,
                })),
              },
              items: {
                create: itemInputs.map((item, displayOrder) => {
                  const template = byId.get(item.templateId)!;
                  return {
                    templateId: template.id,
                    displayOrder,
                    durationMin: item.durationMin,
                    labelFi: template.labelFi,
                    labelEn: template.labelEn,
                    labelRu: template.labelRu,
                  };
                }),
              },
            },
          });
          ids.push(block.id);
        }
        await tx.auditLog.create({
          data: {
            actor: user.email,
            actorUserId: user.id,
            actorRole: user.role,
            action: "calendar_block_created",
            entity: "CalendarBlockSeries",
            entityId: series?.id ?? ids[0],
            metadata: {
              occurrenceCount: ids.length,
              practitionerIds,
              exactTargets: targets.length,
            },
          },
        });
        return { ids, seriesId: series?.id ?? null };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    );
    return NextResponse.json(
      { ...created, occurrenceCount: created.ids.length },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("reservation_conflict|")
    ) {
      const [, date, resource] = error.message.split("|");
      return bad("reservation_conflict", 409, { date, resource });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return bad("reservation_conflict", 409);
    throw error;
  }
}
