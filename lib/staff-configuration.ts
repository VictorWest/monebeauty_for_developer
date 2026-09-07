import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  auditForUser,
  hashPassword,
  normalizeEmail,
  passwordError,
  verifyPassword,
  type AuthUser,
} from "@/lib/auth";
import {
  availabilityCovers,
  availabilityMatchesWeeklySchedule,
  generateStaffSlots,
  normalizeSlots,
  parseWorkingHours,
  scheduleStorageValue,
} from "@/lib/staff-schedule";
import { clinicDateFromInstant } from "@/lib/clinic-time";

const ACTIVE_FUTURE = ["BOOKED", "CONFIRMED", "RESCHEDULED"] as const;

export class ConfigurationError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public detail?: Record<string, unknown>,
  ) {
    super(code);
  }
}

type CapabilityInput = {
  serviceId: string;
  roomId: string;
  deviceIds: string[];
};

export type ConfigurationPatch = {
  version: number;
  account?: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  };
  profile?: {
    professionalTitle?: string;
    calendarColor?: string;
    active?: boolean;
    displayOrder?: number;
  };
  schedule?: {
    weekly?: unknown;
    exceptions?: Array<{ date: string; slots: unknown }>;
  };
  capabilities?: CapabilityInput[];
  qualifiedOptionIds?: string[];
};

function ymd(value: Date) {
  return value.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date(`${clinicDateFromInstant(new Date())}T00:00:00.000Z`);
}

function normalizeCapabilities(value: CapabilityInput[]) {
  const seen = new Set<string>();
  return value.map((item) => {
    const serviceId = String(item.serviceId ?? "");
    const roomId = String(item.roomId ?? "");
    const deviceIds = Array.from(
      new Set(
        (Array.isArray(item.deviceIds) ? item.deviceIds : []).map(String),
      ),
    ).sort();
    const key = `${serviceId}:${roomId}`;
    if (!serviceId || !roomId || seen.has(key))
      throw new ConfigurationError("invalid_capability");
    seen.add(key);
    return { serviceId, roomId, deviceIds };
  });
}

async function targetForUser(userId: string) {
  const target = await prisma.user.findFirst({
    where: { id: userId, role: "STAFF" },
    include: {
      staff: { include: { practitioner: true } },
    },
  });
  if (!target?.staff?.practitioner)
    throw new ConfigurationError("staff_not_linked", 404);
  return target;
}

type DisplayLocale = "fi" | "en" | "ru";

export async function getStaffConfiguration(
  userId: string,
  displayLocale?: DisplayLocale,
) {
  const target = await targetForUser(userId);
  const practitioner = target.staff!.practitioner!;
  const contentLocale = displayLocale ?? target.locale ?? "fi";
  const [exceptions, capabilities, services, qualifications] =
    await Promise.all([
      prisma.availability.findMany({
        where: { practitionerId: practitioner.id, date: { gte: todayDate() } },
        orderBy: { date: "asc" },
      }),
      prisma.practitionerServiceCapability.findMany({
        where: { practitionerId: practitioner.id },
        orderBy: [
          { service: { order: "asc" } },
          { room: { displayOrder: "asc" } },
        ],
        include: {
          service: { select: { slug: true } },
          room: { select: { name: true } },
          devices: { include: { device: { select: { name: true } } } },
        },
      }),
      prisma.service.findMany({
        where: { archivedAt: null, bookable: true },
        orderBy: [{ order: "asc" }, { slug: "asc" }],
        select: {
          id: true,
          slug: true,
          requiresDevice: true,
          contents: {
            where: { locale: contentLocale },
            select: { h1: true },
            take: 1,
          },
          rooms: {
            where: { active: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          },
          devices: {
            where: { active: true },
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            select: { id: true, name: true },
          },
          options: {
            where: { bookable: true, published: true, archivedAt: null },
            orderBy: { displayOrder: "asc" },
            select: {
              id: true,
              bookingServiceId: true,
              contents: {
                where: { locale: contentLocale, status: "PUBLISHED" },
                select: { name: true },
                take: 1,
              },
            },
          },
        },
      }),
      prisma.practitionerServiceOptionQualification.findMany({
        where: { practitionerId: practitioner.id },
        select: { serviceOptionId: true },
      }),
    ]);

  return {
    version: practitioner.configVersion,
    userId: target.id,
    practitionerId: practitioner.id,
    account: {
      name: target.name ?? practitioner.name,
      email: target.email,
      status: target.status,
      mustChangePassword: target.mustChangePassword,
    },
    profile: {
      professionalTitle: practitioner.role,
      calendarColor: practitioner.calendarColor,
      active: practitioner.active,
      displayOrder: practitioner.displayOrder,
    },
    schedule: {
      weekly: parseWorkingHours(practitioner.workingHours),
      exceptions: exceptions
        .filter(
          (item) =>
            !availabilityMatchesWeeklySchedule(
              ymd(item.date),
              item.slots,
              practitioner.workingHours,
            ),
        )
        .map((item) => ({
          date: ymd(item.date),
          slots: normalizeSlots(item.slots),
        })),
    },
    capabilities: capabilities.map((item) => ({
      id: item.id,
      serviceId: item.serviceId,
      serviceSlug: item.service.slug,
      roomId: item.roomId,
      roomName: item.room.name,
      deviceIds: item.devices.map((link) => link.deviceId),
      deviceNames: item.devices.map((link) => link.device.name),
    })),
    qualifiedOptionIds: qualifications.map((item) => item.serviceOptionId),
    resourcePools: services.map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.contents[0]?.h1 ?? service.slug,
      requiresDevice: service.requiresDevice,
      rooms: service.rooms,
      devices: service.devices,
      options: service.options.map((option) => ({
        id: option.id,
        name: option.contents[0]?.name ?? option.id,
        effectiveServiceId: option.bookingServiceId ?? service.id,
      })),
    })),
  };
}

function appointmentCovered(
  appointment: { start: Date; end: Date },
  weekly: unknown,
  exception: unknown | undefined,
) {
  const available =
    exception === undefined
      ? generateStaffSlots(
          clinicDateFromInstant(appointment.start),
          parseWorkingHours(weekly),
        )
      : normalizeSlots(exception);
  return availabilityCovers(available, appointment.start, appointment.end);
}

export async function updateStaffConfiguration(args: {
  actor: AuthUser;
  targetUserId: string;
  administrative?: boolean;
  patch: ConfigurationPatch;
  displayLocale?: DisplayLocale;
  request?: Request;
}) {
  const { actor, targetUserId, patch } = args;
  const isAdmin = Boolean(args.administrative);
  if (!isAdmin && actor.id !== targetUserId)
    throw new ConfigurationError("forbidden_target", 403);
  if (!Number.isInteger(patch.version) || patch.version < 1)
    throw new ConfigurationError("invalid_version");

  const target = await targetForUser(targetUserId);
  const practitionerId = target.staff!.practitionerId!;
  const changedSections = [
    patch.account && "account",
    patch.profile && "profile",
    patch.schedule && "schedule",
    patch.capabilities && "capabilities",
    patch.qualifiedOptionIds && "qualifications",
  ].filter((item): item is string => Boolean(item));
  if (!changedSections.length) throw new ConfigurationError("empty_patch");

  let normalizedEmail: string | undefined;
  let passwordHash: string | undefined;
  if (patch.account) {
    if (patch.account.email !== undefined) {
      normalizedEmail = normalizeEmail(patch.account.email);
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail))
        throw new ConfigurationError("invalid_email");
      if (!isAdmin && normalizedEmail !== target.email) {
        const valid = await verifyPassword(
          patch.account.currentPassword ?? "",
          target.passwordHash,
        );
        if (!valid)
          throw new ConfigurationError("current_password_required", 403);
      }
    }
    if (patch.account.newPassword) {
      if (isAdmin)
        throw new ConfigurationError("use_admin_password_reset", 403);
      const valid = await verifyPassword(
        patch.account.currentPassword ?? "",
        target.passwordHash,
      );
      const invalid = passwordError(patch.account.newPassword);
      if (!valid || invalid)
        throw new ConfigurationError(
          invalid ?? "current_password_required",
          403,
        );
      passwordHash = await hashPassword(patch.account.newPassword);
    }
  }

  const nextCapabilities = patch.capabilities
    ? normalizeCapabilities(patch.capabilities)
    : undefined;
  const nextQualifiedOptionIds = patch.qualifiedOptionIds
    ? Array.from(new Set(patch.qualifiedOptionIds.map(String).filter(Boolean)))
    : undefined;
  const nextWeekly =
    patch.schedule?.weekly === undefined
      ? undefined
      : scheduleStorageValue(patch.schedule.weekly);
  const nextExceptions = patch.schedule?.exceptions?.map((item) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date))
      throw new ConfigurationError("invalid_exception");
    return { date: item.date, slots: normalizeSlots(item.slots) };
  });
  if (
    nextExceptions &&
    new Set(nextExceptions.map((item) => item.date)).size !==
      nextExceptions.length
  )
    throw new ConfigurationError("duplicate_exception");

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const claimed = await tx.practitioner.updateMany({
          where: { id: practitionerId, configVersion: patch.version },
          data: { configVersion: { increment: 1 } },
        });
        if (!claimed.count)
          throw new ConfigurationError("version_conflict", 409);

        const current = await tx.practitioner.findUniqueOrThrow({
          where: { id: practitionerId },
          select: { workingHours: true },
        });
        const future = await tx.appointment.findMany({
          where: {
            practitionerId,
            start: { gte: new Date() },
            status: { in: [...ACTIVE_FUTURE] },
          },
          select: {
            id: true,
            serviceId: true,
            roomId: true,
            deviceId: true,
            start: true,
            end: true,
            serviceOptionId: true,
          },
        });

        if (nextCapabilities) {
          const serviceIds = Array.from(
            new Set(nextCapabilities.map((item) => item.serviceId)),
          );
          const pools = await tx.service.findMany({
            where: { id: { in: serviceIds }, archivedAt: null, bookable: true },
            select: {
              id: true,
              requiresDevice: true,
              rooms: { where: { active: true }, select: { id: true } },
              devices: { where: { active: true }, select: { id: true } },
            },
          });
          if (pools.length !== serviceIds.length)
            throw new ConfigurationError("invalid_service");
          const poolById = new Map(pools.map((item) => [item.id, item]));
          for (const capability of nextCapabilities) {
            const pool = poolById.get(capability.serviceId)!;
            if (!pool.rooms.some((room) => room.id === capability.roomId))
              throw new ConfigurationError("room_not_permitted");
            if (
              capability.deviceIds.some(
                (id) => !pool.devices.some((device) => device.id === id),
              )
            )
              throw new ConfigurationError("device_not_permitted");
            if (pool.requiresDevice && !capability.deviceIds.length)
              throw new ConfigurationError("device_required");
          }
          const affected = future.filter(
            (appointment) =>
              !nextCapabilities.some(
                (capability) =>
                  capability.serviceId === appointment.serviceId &&
                  capability.roomId === appointment.roomId &&
                  (appointment.deviceId === null ||
                    capability.deviceIds.includes(appointment.deviceId)),
              ),
          );
          if (affected.length)
            throw new ConfigurationError("future_appointments", 409, {
              affected: affected.length,
              appointmentIds: affected.slice(0, 20).map((item) => item.id),
            });
          await tx.practitionerServiceCapability.deleteMany({
            where: { practitionerId },
          });
          for (const capability of nextCapabilities) {
            await tx.practitionerServiceCapability.create({
              data: {
                practitionerId,
                serviceId: capability.serviceId,
                roomId: capability.roomId,
                devices: {
                  create: capability.deviceIds.map((deviceId) => ({
                    deviceId,
                  })),
                },
              },
            });
          }
        }

        if (nextQualifiedOptionIds) {
          const options = await tx.serviceOption.findMany({
            where: {
              id: { in: nextQualifiedOptionIds },
              bookable: true,
              published: true,
              archivedAt: null,
            },
            select: { id: true, serviceId: true, bookingServiceId: true },
          });
          if (options.length !== nextQualifiedOptionIds.length)
            throw new ConfigurationError("invalid_qualification");
          const effectiveServiceIds = new Set(
            (
              nextCapabilities ??
              (await tx.practitionerServiceCapability.findMany({
                where: { practitionerId },
                select: { serviceId: true },
              }))
            ).map((item) => item.serviceId),
          );
          if (
            options.some(
              (option) =>
                !effectiveServiceIds.has(
                  option.bookingServiceId ?? option.serviceId,
                ),
            )
          )
            throw new ConfigurationError("qualification_without_capability");
          const invalidFuture = future.filter(
            (appointment) =>
              appointment.serviceOptionId &&
              !nextQualifiedOptionIds.includes(appointment.serviceOptionId),
          );
          if (invalidFuture.length)
            throw new ConfigurationError("future_appointments", 409, {
              affected: invalidFuture.length,
              appointmentIds: invalidFuture.slice(0, 20).map((item) => item.id),
            });
          await tx.practitionerServiceOptionQualification.deleteMany({
            where: { practitionerId },
          });
          if (nextQualifiedOptionIds.length)
            await tx.practitionerServiceOptionQualification.createMany({
              data: nextQualifiedOptionIds.map((serviceOptionId) => ({
                practitionerId,
                serviceOptionId,
              })),
            });
        }

        if (nextWeekly !== undefined || nextExceptions !== undefined) {
          const existing = await tx.availability.findMany({
            where: { practitionerId, date: { gte: todayDate() } },
            select: { date: true, slots: true },
          });
          const exceptions = new Map(
            existing.map((item) => [ymd(item.date), item.slots]),
          );
          if (nextExceptions) {
            exceptions.clear();
            nextExceptions.forEach((item) =>
              exceptions.set(item.date, item.slots),
            );
          }
          const weekly = nextWeekly ?? current.workingHours;
          const affected = future.filter(
            (appointment) =>
              !appointmentCovered(
                appointment,
                weekly,
                exceptions.get(clinicDateFromInstant(appointment.start)),
              ),
          );
          if (affected.length)
            throw new ConfigurationError("future_appointments", 409, {
              affected: affected.length,
              appointmentIds: affected.slice(0, 20).map((item) => item.id),
            });
          if (nextWeekly !== undefined)
            await tx.practitioner.update({
              where: { id: practitionerId },
              data: { workingHours: nextWeekly },
            });
          if (nextExceptions) {
            await tx.availability.deleteMany({
              where: { practitionerId, date: { gte: todayDate() } },
            });
            for (const item of nextExceptions) {
              await tx.availability.create({
                data: {
                  practitionerId,
                  date: new Date(`${item.date}T00:00:00.000Z`),
                  slots: item.slots,
                },
              });
            }
          }
        }

        const userData: Prisma.UserUpdateInput = {};
        const practitionerData: Prisma.PractitionerUpdateInput = {};
        if (patch.account?.name !== undefined) {
          const name = patch.account.name.trim().slice(0, 120);
          if (!name) throw new ConfigurationError("name_required");
          userData.name = name;
          practitionerData.name = name;
        }
        if (normalizedEmail !== undefined) userData.email = normalizedEmail;
        if (passwordHash) {
          userData.passwordHash = passwordHash;
          userData.passwordChangedAt = new Date();
          userData.mustChangePassword = false;
        }
        if (patch.profile?.professionalTitle !== undefined) {
          const title = patch.profile.professionalTitle.trim().slice(0, 120);
          if (!title) throw new ConfigurationError("title_required");
          practitionerData.role = title;
        }
        if (patch.profile?.calendarColor !== undefined) {
          if (!/^#[0-9a-f]{6}$/i.test(patch.profile.calendarColor))
            throw new ConfigurationError("invalid_color");
          practitionerData.calendarColor =
            patch.profile.calendarColor.toUpperCase();
        }
        if (isAdmin && patch.profile?.active !== undefined) {
          if (!patch.profile.active && future.length)
            throw new ConfigurationError("future_appointments", 409, {
              affected: future.length,
              appointmentIds: future.slice(0, 20).map((item) => item.id),
            });
          practitionerData.active = patch.profile.active;
        }
        if (isAdmin && patch.profile?.displayOrder !== undefined) {
          if (!Number.isInteger(patch.profile.displayOrder))
            throw new ConfigurationError("invalid_display_order");
          practitionerData.displayOrder = patch.profile.displayOrder;
        }
        if (Object.keys(userData).length)
          await tx.user.update({ where: { id: targetUserId }, data: userData });
        if (Object.keys(practitionerData).length)
          await tx.practitioner.update({
            where: { id: practitionerId },
            data: practitionerData,
          });

        const emailChanged =
          normalizedEmail !== undefined && normalizedEmail !== target.email;
        if (emailChanged || passwordHash)
          await tx.session.deleteMany({ where: { userId: targetUserId } });
        return { emailChanged, passwordChanged: Boolean(passwordHash) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    await auditForUser(
      actor,
      "staff_configuration_updated",
      "Practitioner",
      practitionerId,
      {
        request: args.request,
        metadata: {
          targetUserId,
          sections: changedSections.join(","),
          capabilityCount: nextCapabilities?.length ?? null,
          emailChanged: result.emailChanged,
        },
      },
    );
    return {
      ...(await getStaffConfiguration(targetUserId, args.displayLocale)),
      requiresLogin: result.emailChanged || result.passwordChanged,
    };
  } catch (error) {
    const known =
      error instanceof ConfigurationError
        ? error
        : error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          ? new ConfigurationError("email_in_use", 409)
          : error;
    throw known;
  }
}
