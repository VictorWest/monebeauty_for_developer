"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  audit,
  auditForUser,
  authRateLimited,
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  isBackofficeRole,
  normalizeEmail,
  passwordError,
  requestAuditContext,
  verifyPassword,
} from "@/lib/auth";
import { staffHref } from "@/lib/account-routing";
import { adminBase } from "@/lib/admin-routing";
import { sharedLoginDestination } from "@/lib/shared-login";
import type { Locale } from "@/i18n/routing";
import { temporaryPasswordError } from "@/lib/password-policy";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function localeFrom(formData: FormData): Locale {
  const locale = text(formData, "locale");
  return locale === "en" || locale === "ru" ? locale : "fi";
}

function adminReturn(formData: FormData) {
  const path = text(formData, "returnTo");
  return /^\/(?:en\/|ru\/)?admin\/henkilosto(?:\/|$)/.test(path)
    ? path
    : "/admin/henkilosto";
}

async function requireAdmin() {
  const user = await currentUser("backoffice");
  if (!user || !isBackofficeRole(user.role)) redirect("/admin/kirjaudu");
  return user;
}

export async function staffLoginAction(formData: FormData) {
  const locale = localeFrom(formData);
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const context = await requestAuditContext();
  const user = await prisma.user.findUnique({ where: { email } });
  const blocked = await authRateLimited(
    email,
    "staff_login",
    context.ipAddress,
  );
  const valid =
    !blocked &&
    user?.role === "STAFF" &&
    user.status === "ACTIVE" &&
    (await verifyPassword(password, user.passwordHash));

  if (!valid) {
    await audit({
      actor: email || "unknown",
      actorUserId: user?.id,
      actorRole: user?.role,
      action: "staff_login",
      outcome: blocked ? "DENIED" : "FAILURE",
      entity: "User",
      entityId: user?.id,
      ...context,
    });
    redirect(`${staffHref(locale, "login")}?error=invalid`);
  }

  await createSession(user.id, "backoffice");
  await audit({
    actor: user.email,
    actorUserId: user.id,
    actorRole: user.role,
    action: "staff_login",
    entity: "User",
    entityId: user.id,
    ...context,
  });
  redirect(sharedLoginDestination(locale, user)!);
}

export async function staffLogoutAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await currentUser("backoffice");
  if (user?.role === "STAFF")
    await auditForUser(user, "staff_logout", "User", user.id);
  await destroySession("backoffice");
  redirect(staffHref(locale, "login"));
}

export async function changeStaffPasswordAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await currentUser("backoffice");
  if (!user || user.role !== "STAFF") redirect(staffHref(locale, "login"));
  const currentPassword = text(formData, "currentPassword");
  const nextPassword = text(formData, "password");
  const confirm = text(formData, "confirmPassword");
  const stored = await prisma.user.findUnique({ where: { id: user.id } });
  if (
    !stored ||
    !(await verifyPassword(currentPassword, stored.passwordHash)) ||
    passwordError(nextPassword) ||
    nextPassword !== confirm ||
    currentPassword === nextPassword
  ) {
    await auditForUser(user, "staff_password_change", "User", user.id, {
      outcome: "FAILURE",
    });
    redirect(`${staffHref(locale, "password")}?error=invalid`);
  }

  const passwordHash = await hashPassword(nextPassword);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  await auditForUser(user, "staff_password_change", "User", user.id);
  await createSession(user.id, "backoffice");
  redirect(`${adminBase(locale)}?password=changed`);
}

export async function createStaffAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnTo = adminReturn(formData);
  const email = normalizeEmail(text(formData, "email"));
  const name = text(formData, "name");
  const password = text(formData, "temporaryPassword");
  const locale = localeFrom(formData);
  if (!email.includes("@") || !name || temporaryPasswordError(password))
    redirect(`${returnTo}?error=validation`);
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } }))
    redirect(`${returnTo}?error=duplicate`);

  const passwordHash = await hashPassword(password);
  const created = await prisma.$transaction(async (tx) => {
    const matches = await tx.practitioner.findMany({
      where: {
        name: { equals: name, mode: "insensitive" },
        staff: null,
      },
      orderBy: [{ active: "desc" }, { displayOrder: "asc" }],
      take: 2,
    });
    let practitionerId: string;
    if (matches.length === 1) {
      const practitioner = await tx.practitioner.update({
        where: { id: matches[0].id },
        data: { active: true },
      });
      practitionerId = practitioner.id;
    } else {
      const order = await tx.practitioner.aggregate({
        _max: { displayOrder: true },
      });
      const practitioner = await tx.practitioner.create({
        data: {
          name,
          role: "Specialist",
          active: true,
          displayOrder: (order._max.displayOrder ?? -1) + 1,
        },
      });
      practitionerId = practitioner.id;
    }
    const user = await tx.user.create({
      data: {
        email,
        name,
        locale,
        role: "STAFF",
        status: "ACTIVE",
        emailVerifiedAt: new Date(),
        mustChangePassword: true,
        passwordHash,
        staff: { create: { practitionerId, daysOff: [] } },
      },
    });
    return { user, practitionerId };
  });
  await auditForUser(admin, "staff_account_created", "User", created.user.id, {
    metadata: { practitionerId: created.practitionerId },
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}

export async function resetStaffPasswordAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnTo = adminReturn(formData);
  const id = text(formData, "id");
  const password = text(formData, "temporaryPassword");
  if (!id || temporaryPasswordError(password))
    redirect(`${returnTo}?error=validation`);
  const passwordHash = await hashPassword(password);
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id, role: "STAFF" },
      data: {
        passwordHash,
        mustChangePassword: true,
        passwordChangedAt: new Date(),
      },
    });
    const revoked = changed.count
      ? await tx.session.deleteMany({ where: { userId: id } })
      : { count: 0 };
    return { changed: changed.count, revoked: revoked.count };
  });
  if (!result.changed) redirect(`${returnTo}?error=not_found`);
  await auditForUser(admin, "staff_password_reset", "User", id, {
    metadata: { revokedSessions: result.revoked },
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}

export async function setStaffStatusAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnTo = adminReturn(formData);
  const id = text(formData, "id");
  const status = text(formData, "status") === "ACTIVE" ? "ACTIVE" : "DISABLED";
  const result = await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id, role: "STAFF" },
      data: { status },
    });
    const revoked =
      changed.count && status === "DISABLED"
        ? await tx.session.deleteMany({ where: { userId: id } })
        : { count: 0 };
    return { changed: changed.count, revoked: revoked.count };
  });
  if (!result.changed) redirect(`${returnTo}?error=not_found`);
  await auditForUser(
    admin,
    status === "ACTIVE"
      ? "staff_account_reactivated"
      : "staff_account_disabled",
    "User",
    id,
    { metadata: { revokedSessions: result.revoked } },
  );
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}

export async function revokeStaffSessionsAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnTo = adminReturn(formData);
  const id = text(formData, "id");
  const target = await prisma.user.findFirst({ where: { id, role: "STAFF" } });
  if (!target) redirect(`${returnTo}?error=not_found`);
  const revoked = await prisma.session.deleteMany({ where: { userId: id } });
  await auditForUser(admin, "staff_sessions_revoked", "User", id, {
    metadata: { revokedSessions: revoked.count },
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}

export async function deleteStaffAccountAction(formData: FormData) {
  const admin = await requireAdmin();
  const returnTo = adminReturn(formData);
  const id = text(formData, "id");
  const confirmationEmail = normalizeEmail(text(formData, "confirmationEmail"));
  const target = await prisma.user.findFirst({
    where: { id, role: "STAFF" },
    include: { staff: { select: { practitionerId: true } } },
  });
  if (!target) redirect(`${returnTo}?error=not_found`);
  if (confirmationEmail !== normalizeEmail(target.email))
    redirect(`${returnTo}?error=confirmation`);

  const result = await prisma.$transaction(async (tx) => {
    const revoked = await tx.session.deleteMany({ where: { userId: id } });
    const deleted = await tx.user.deleteMany({ where: { id, role: "STAFF" } });
    return { revoked: revoked.count, deleted: deleted.count };
  });
  if (!result.deleted) redirect(`${returnTo}?error=not_found`);
  await auditForUser(admin, "staff_account_deleted", "User", id, {
    metadata: {
      targetEmail: target.email,
      targetName: target.name ?? null,
      practitionerId: target.staff?.practitionerId ?? null,
      revokedSessions: result.revoked,
      retainedCalendarHistory: true,
    },
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?saved=1`);
}
