import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  adjustFinalItemDuration,
  endFromSequentialItems,
  lockAndFindReservationConflict,
  snapToCalendarQuarter,
} from "@/lib/calendar-blocks";
import {
  clinicDateFromInstant,
  clinicDateTimeToInstant,
  clinicTimeFromInstant,
} from "@/lib/clinic-time";

function response(error: string, status = 400, detail?: unknown) {
  return NextResponse.json({ error, detail }, { status });
}

async function context(id: string) {
  const block = await prisma.calendarBlock.findUnique({
    where: { id },
    include: { participants: true, items: true },
  });
  if (!block) return { error: response("not_found", 404) };
  return { block };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return response("forbidden", 403);
  const { id } = await params;
  const found = await context(id);
  if (found.error) return found.error;
  const block = found.block!;
  const payload = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!payload) return response("invalid_json");
  if (Number(payload.version) !== block.version) return response("stale", 409);
  const scope = payload.scope === "future" ? "future" : "occurrence";
  const practitionerIds = Array.isArray(payload.practitionerIds)
    ? [...new Set(payload.practitionerIds.map(String).filter(Boolean))]
    : block.participants.map((item) => item.practitionerId);
  if (!practitionerIds.length) return response("employee_required");
  const start = snapToCalendarQuarter(
    new Date(String(payload.start ?? block.start.toISOString())),
  );
  if (Number.isNaN(start.getTime())) return response("invalid_time");
  let itemInputs = Array.isArray(payload.items)
    ? payload.items.map((value) => {
        const item = value as Record<string, unknown>;
        return {
          templateId: String(item.templateId ?? ""),
          durationMin: Number(item.durationMin),
        };
      })
    : block.items
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((item) => ({
          templateId: item.templateId ?? "",
          durationMin: item.durationMin,
        }));
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
    return response("invalid_items");
  if (payload.end) {
    try {
      itemInputs = adjustFinalItemDuration(
        start,
        new Date(String(payload.end)),
        itemInputs,
      );
    } catch {
      return response("invalid_duration");
    }
  }
  const end = endFromSequentialItems(start, itemInputs);
  const roomId = String(payload.roomId ?? block.roomId ?? "") || null;
  const deviceId = String(payload.deviceId ?? block.deviceId ?? "") || null;
  if (roomId && deviceId) return response("one_resource_only");
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
    return response("invalid_template");
  if (employeeCount !== practitionerIds.length)
    return response("invalid_employee");
  if (roomId && !room) return response("invalid_room");
  if (deviceId && !device) return response("invalid_device");
  const byId = new Map(templates.map((template) => [template.id, template]));
  const targets =
    scope === "future" && block.seriesId
      ? await prisma.calendarBlock.findMany({
          where: {
            seriesId: block.seriesId,
            start: { gte: block.start },
            status: "ACTIVE",
          },
          orderBy: { start: "asc" },
        })
      : [block];
  const durationMs = end.getTime() - start.getTime();
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const target of targets) {
          const nextStart =
            target.id === block.id
              ? start
              : clinicDateTimeToInstant(
                  clinicDateFromInstant(target.start),
                  clinicTimeFromInstant(start),
                )!;
          const reservation = {
            start: nextStart,
            end: new Date(nextStart.getTime() + durationMs),
            practitionerIds,
            roomId,
            deviceId,
            excludeBlockId: target.id,
          };
          const conflict = await lockAndFindReservationConflict(
            tx,
            reservation,
          );
          if (conflict)
            throw new Error(
              `reservation_conflict|${nextStart.toISOString()}|${conflict.resource}`,
            );
          const changed = await tx.calendarBlock.updateMany({
            where: { id: target.id, version: target.version },
            data: {
              start: reservation.start,
              end: reservation.end,
              roomId,
              deviceId,
              notes:
                String(payload.notes ?? block.notes ?? "")
                  .trim()
                  .slice(0, 2000) || null,
              version: { increment: 1 },
            },
          });
          if (!changed.count) throw new Error("stale");
          await tx.calendarBlockParticipant.deleteMany({
            where: { blockId: target.id },
          });
          await tx.calendarBlockParticipant.createMany({
            data: practitionerIds.map((practitionerId) => ({
              blockId: target.id,
              practitionerId,
            })),
          });
          await tx.calendarBlockItem.deleteMany({
            where: { blockId: target.id },
          });
          await tx.calendarBlockItem.createMany({
            data: itemInputs.map((item, displayOrder) => {
              const template = byId.get(item.templateId)!;
              return {
                blockId: target.id,
                templateId: template.id,
                displayOrder,
                durationMin: item.durationMin,
                labelFi: template.labelFi,
                labelEn: template.labelEn,
                labelRu: template.labelRu,
              };
            }),
          });
        }
        await tx.auditLog.create({
          data: {
            actor: user.email,
            actorUserId: user.id,
            actorRole: user.role,
            action: "calendar_block_updated",
            entity: "CalendarBlock",
            entityId: id,
            metadata: { scope, affected: targets.length },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 15_000,
      },
    );
    return NextResponse.json({
      id,
      version: block.version + 1,
      affected: targets.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "stale")
      return response("stale", 409);
    if (
      error instanceof Error &&
      error.message.startsWith("reservation_conflict|")
    ) {
      const [, date, resource] = error.message.split("|");
      return response("reservation_conflict", 409, { date, resource });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      return response("reservation_conflict", 409);
    throw error;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return response("forbidden", 403);
  const { id } = await params;
  const found = await context(id);
  if (found.error) return found.error;
  const block = found.block!;
  const payload = (await req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  if (Number(payload.version) !== block.version) return response("stale", 409);
  const scope = payload.scope === "future" ? "future" : "occurrence";
  await prisma.$transaction(async (tx) => {
    const where =
      scope === "future" && block.seriesId
        ? {
            seriesId: block.seriesId,
            start: { gte: block.start },
            status: "ACTIVE" as const,
          }
        : { id, version: block.version, status: "ACTIVE" as const };
    const changed = await tx.calendarBlock.updateMany({
      where,
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledBy: user.email,
        version: { increment: 1 },
      },
    });
    if (!changed.count) throw new Error("stale");
    await tx.auditLog.create({
      data: {
        actor: user.email,
        actorUserId: user.id,
        actorRole: user.role,
        action: "calendar_block_cancelled",
        entity: "CalendarBlock",
        entityId: id,
        metadata: { scope, affected: changed.count },
      },
    });
  });
  return NextResponse.json({ id, status: "CANCELLED" });
}
