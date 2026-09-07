"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  audit,
  auditForUser,
  authRateLimited,
  createAccountToken,
  createSession,
  currentUser,
  destroySession,
  hashPassword,
  normalizeEmail,
  passwordError,
  requestAuditContext,
  tokenHash,
  validAccountToken,
  verifyPassword,
} from "@/lib/auth";
import { normalizeInternationalPhone } from "@/lib/phone";
import { accountHref } from "@/lib/account-routing";
import { absoluteLocalizedUrl, siteUrl } from "@/lib/seo";
import { sendEmail } from "@/lib/notifications";
import { renderAccountActionEmail } from "@/lib/email";
import { reconcileGuestHistory } from "@/lib/identity-reconciliation";
import type { Locale } from "@/i18n/routing";
import {
  encryptSensitiveJson,
  encryptSensitiveText,
} from "@/lib/sensitive-data";
import { reusableClaimConsultation } from "@/lib/consultation";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
function localeFrom(formData: FormData): Locale {
  const locale = text(formData, "locale");
  return locale === "en" || locale === "ru" ? locale : "fi";
}
function accountUrl(
  locale: Locale,
  segment?: Parameters<typeof accountHref>[1],
) {
  return absoluteLocalizedUrl(
    siteUrl(),
    accountHref(locale, segment).replace(/^\/(?:en|ru)(?=\/)/, ""),
    locale,
  );
}

function encryptedConsultationProfile(dateOfBirth: string, answers: unknown) {
  try {
    return {
      dateOfBirthEncrypted: encryptSensitiveText(dateOfBirth),
      answersEncrypted: encryptSensitiveJson(answers),
    };
  } catch {
    return null;
  }
}

export async function registerClientAction(formData: FormData) {
  const locale = localeFrom(formData);
  const email = normalizeEmail(text(formData, "email"));
  const firstName = text(formData, "firstName").slice(0, 80);
  const lastName = text(formData, "lastName").slice(0, 80);
  const fullName = `${firstName} ${lastName}`.trim();
  const dateOfBirth = text(formData, "dateOfBirth");
  const phone = normalizeInternationalPhone(text(formData, "phone"));
  const password = text(formData, "password");
  const confirm = text(formData, "confirmPassword");
  const consent = formData.get("consentGdpr") === "on";
  const healthConsent = formData.get("healthDataConsent") === "on";
  const accuracyAcknowledged = formData.get("accuracyAcknowledged") === "on";
  const claim = text(formData, "claim");
  const context = await requestAuditContext();
  if (await authRateLimited(email, "client_registration", context.ipAddress))
    redirect(`${accountHref(locale, "register")}?error=rate`);
  const claimToken = claim
    ? await validAccountToken(claim, "CLAIM_APPOINTMENT")
    : null;
  const reusableClaim = claim ? await reusableClaimConsultation(claim) : null;
  const consultationForm = await prisma.consultationForm.findUnique({
    where: { id: "current" },
    include: {
      questions: {
        where: { active: true, archivedAt: null },
        orderBy: { displayOrder: "asc" },
        include: {
          contents: { where: { locale } },
          choices: { where: { active: true }, select: { key: true } },
        },
      },
    },
  });
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    ? new Date(`${dateOfBirth}T00:00:00.000Z`)
    : null;
  const answerSnapshots = consultationForm?.questions.map((question) => {
    const field = `consultation_${question.key}`;
    const allowed = new Set(question.choices.map((choice) => choice.key));
    const rawValues = formData
      .getAll(field)
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean);
    const answer =
      question.type === "MULTI_CHOICE"
        ? rawValues.filter((value) => allowed.has(value))
        : question.type === "SINGLE_CHOICE"
          ? (rawValues.find((value) => allowed.has(value)) ?? "")
          : question.type === "YES_NO"
            ? (rawValues.find((value) => value === "yes" || value === "no") ??
              "")
            : question.type === "ACKNOWLEDGMENT"
              ? rawValues.includes("on")
              : (rawValues[0] ?? "").slice(0, 4000);
    return {
      key: question.key,
      questionVersion: question.version,
      prompt: question.contents[0]?.prompt ?? "",
      answer,
      required: question.required,
    };
  });
  const missingRequired = answerSnapshots?.some(
    (item) =>
      item.required &&
      (item.answer === "" ||
        item.answer === false ||
        (Array.isArray(item.answer) && item.answer.length === 0)),
  );
  if (
    !email.includes("@") ||
    !firstName ||
    !lastName ||
    (!reusableClaim && (!birth || birth.getTime() >= Date.now())) ||
    !phone ||
    passwordError(password) ||
    password !== confirm ||
    !consent ||
    (!reusableClaim && (!healthConsent || !accuracyAcknowledged)) ||
    !consultationForm ||
    (!reusableClaim && missingRequired) ||
    (reusableClaim && reusableClaim.email !== email) ||
    (claimToken && claimToken.email !== email)
  ) {
    await audit({
      actor: email || "unknown",
      action: "client_registration",
      outcome: "FAILURE",
      entity: "User",
      ...context,
    });
    redirect(
      `${accountHref(locale, "register")}?error=validation${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`,
    );
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await audit({
      actor: email,
      actorUserId: existing.id,
      actorRole: existing.role,
      action: "client_registration",
      outcome: "FAILURE",
      entity: "User",
      entityId: existing.id,
      ...context,
    });
    redirect(
      `${accountHref(locale, "login")}?notice=check_email${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`,
    );
  }
  const encryptedProfile = reusableClaim
    ? null
    : encryptedConsultationProfile(dateOfBirth, answerSnapshots ?? []);
  if (!reusableClaim && !encryptedProfile)
    redirect(
      `${accountHref(locale, "register")}?error=consultation_unavailable${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`,
    );
  const passwordHash = await hashPassword(password);
  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        name: fullName,
        locale,
        role: "CLIENT",
        status: "PENDING_VERIFICATION",
        passwordHash,
      },
    });
    const client = await tx.client.create({
      data: {
        userId: createdUser.id,
        firstName,
        lastName,
        fullName,
        phone,
        email,
        consentGdpr: true,
      },
    });
    const localized = (value: unknown) =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? String((value as Record<string, unknown>)[locale] ?? "")
        : "";
    if (encryptedProfile) {
      await tx.consultationProfile.create({
        data: {
          clientId: client.id,
          completedVersion: consultationForm.requiredVersion,
          ...encryptedProfile,
          locale,
        },
      });
      await tx.consent.createMany({
        data: [
          {
            clientId: client.id,
            type: "health_profile",
            granted: true,
            locale,
            textVersion: consultationForm.healthConsentVersion,
            wordingSnapshot: localized(consultationForm.healthConsentWording),
          },
          {
            clientId: client.id,
            type: "consultation_accuracy",
            granted: true,
            locale,
            textVersion: consultationForm.accuracyVersion,
            wordingSnapshot: localized(consultationForm.accuracyWording),
          },
        ],
      });
    }
    return createdUser;
  });
  const verify = await createAccountToken({
    userId: user.id,
    email,
    purpose: "VERIFY_EMAIL",
    ttlMs: 24 * 60 * 60 * 1000,
  });
  const verifyUrl = `${accountUrl(locale, "verify")}?token=${encodeURIComponent(verify)}${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`;
  const verificationEmail = renderAccountActionEmail({
    locale,
    kind: "verification",
    href: verifyUrl,
    name: fullName,
  });
  await sendEmail({
    to: email,
    ...verificationEmail,
    idempotencyKey: `client-verify:${user.id}`,
  });
  await audit({
    actor: email,
    actorUserId: user.id,
    actorRole: "CLIENT",
    action: "client_registration",
    entity: "User",
    entityId: user.id,
    ...context,
  });
  redirect(`${accountHref(locale, "login")}?notice=check_email`);
}

export async function verifyClientEmailAction(formData: FormData) {
  const locale = localeFrom(formData);
  const raw = text(formData, "token");
  const claim = text(formData, "claim");
  const token = await validAccountToken(raw, "VERIFY_EMAIL");
  if (!token?.userId)
    redirect(`${accountHref(locale, "verify")}?error=invalid`);
  const user = await prisma.$transaction(async (tx) => {
    const consumed = await tx.accountToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!consumed.count) return null;
    const verified = await tx.user.update({
      where: { id: token.userId! },
      data: { status: "ACTIVE", emailVerifiedAt: new Date() },
    });
    return verified;
  });
  if (!user) redirect(`${accountHref(locale, "verify")}?error=invalid`);
  await reconcileGuestHistory(user.id);
  await audit({
    actor: user.email,
    actorUserId: user.id,
    actorRole: user.role,
    action: "client_email_verified",
    entity: "User",
    entityId: user.id,
  });
  await createSession(user.id, "client");
  if (claim)
    redirect(
      `${accountHref(locale, "claim")}?token=${encodeURIComponent(claim)}`,
    );
  redirect(accountHref(locale));
}

async function clientAccount() {
  const user = await currentUser("client");
  if (!user || user.role !== "CLIENT" || !user.emailVerifiedAt) return null;
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  return client ? { user, client } : null;
}

function accountView(locale: Locale, view: string, state?: string) {
  const query = new URLSearchParams({ view });
  if (state) query.set("notice", state);
  return `${accountHref(locale)}?${query}`;
}

export async function updateClientProfileAction(formData: FormData) {
  const locale = localeFrom(formData);
  const account = await clientAccount();
  if (!account) redirect(accountHref(locale, "login"));
  const firstName = text(formData, "firstName").slice(0, 80);
  const lastName = text(formData, "lastName").slice(0, 80);
  const legacyFullName = text(formData, "fullName").slice(0, 160);
  const fullName = `${firstName} ${lastName}`.trim() || legacyFullName;
  const phone = normalizeInternationalPhone(text(formData, "phone"));
  if (!fullName || !phone) redirect(accountView(locale, "profile", "invalid"));
  await prisma.$transaction([
    prisma.user.update({
      where: { id: account.user.id },
      data: { name: fullName },
    }),
    prisma.client.update({
      where: { id: account.client.id },
      data: {
        fullName,
        phone,
        ...(firstName && lastName ? { firstName, lastName } : {}),
      },
    }),
  ]);
  await auditForUser(
    account.user,
    "client_profile_updated",
    "Client",
    account.client.id,
  );
  redirect(accountView(locale, "profile", "saved"));
}

export async function updateConsultationProfileAction(formData: FormData) {
  const locale = localeFrom(formData);
  const account = await clientAccount();
  if (!account) redirect(accountHref(locale, "login"));
  const dateOfBirth = text(formData, "dateOfBirth");
  const birth = /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)
    ? new Date(`${dateOfBirth}T00:00:00.000Z`)
    : null;
  const healthConsent = formData.get("healthDataConsent") === "on";
  const accuracy = formData.get("accuracyAcknowledged") === "on";
  const config = await prisma.consultationForm.findUnique({
    where: { id: "current" },
    include: {
      questions: {
        where: { active: true, archivedAt: null },
        orderBy: { displayOrder: "asc" },
        include: {
          contents: { where: { locale } },
          choices: { where: { active: true }, select: { key: true } },
        },
      },
    },
  });
  const snapshots = config?.questions.map((question) => {
    const values = formData
      .getAll(`consultation_${question.key}`)
      .map(String)
      .map((value) => value.trim())
      .filter(Boolean);
    const allowed = new Set(question.choices.map((choice) => choice.key));
    const answer =
      question.type === "MULTI_CHOICE"
        ? values.filter((value) => allowed.has(value))
        : question.type === "SINGLE_CHOICE"
          ? (values.find((value) => allowed.has(value)) ?? "")
          : question.type === "YES_NO"
            ? (values.find((value) => value === "yes" || value === "no") ?? "")
            : question.type === "ACKNOWLEDGMENT"
              ? values.includes("on")
              : (values[0] ?? "").slice(0, 4000);
    return {
      key: question.key,
      questionVersion: question.version,
      prompt: question.contents[0]?.prompt ?? "",
      required: question.required,
      answer,
    };
  });
  const invalid =
    !birth ||
    birth.getTime() >= Date.now() ||
    !healthConsent ||
    !accuracy ||
    !config ||
    snapshots?.some(
      (item) =>
        item.required &&
        (item.answer === "" ||
          item.answer === false ||
          (Array.isArray(item.answer) && !item.answer.length)),
    );
  if (invalid) redirect(accountView(locale, "profile", "invalid"));
  const encryptedProfile = encryptedConsultationProfile(
    dateOfBirth,
    snapshots ?? [],
  );
  if (!encryptedProfile)
    redirect(accountView(locale, "profile", "consultation_unavailable"));
  const localized = (value: unknown) =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? String((value as Record<string, unknown>)[locale] ?? "")
      : "";
  await prisma.$transaction(async (tx) => {
    await tx.consultationProfile.upsert({
      where: { clientId: account.client.id },
      update: {
        completedVersion: config.requiredVersion,
        ...encryptedProfile,
        locale,
      },
      create: {
        clientId: account.client.id,
        completedVersion: config.requiredVersion,
        ...encryptedProfile,
        locale,
      },
    });
    await tx.consent.createMany({
      data: [
        {
          clientId: account.client.id,
          type: "health_profile",
          granted: true,
          locale,
          textVersion: config.healthConsentVersion,
          wordingSnapshot: localized(config.healthConsentWording),
        },
        {
          clientId: account.client.id,
          type: "consultation_accuracy",
          granted: true,
          locale,
          textVersion: config.accuracyVersion,
          wordingSnapshot: localized(config.accuracyWording),
        },
      ],
    });
  });
  await auditForUser(
    account.user,
    "consultation_profile_updated",
    "ConsultationProfile",
    account.client.id,
  );
  redirect(accountView(locale, "profile", "saved"));
}

export async function saveClientAddressAction(formData: FormData) {
  const locale = localeFrom(formData);
  const account = await clientAccount();
  if (!account) redirect(accountHref(locale, "login"));
  const id = text(formData, "id");
  const recipientName = text(formData, "recipientName").slice(0, 160);
  const phone = normalizeInternationalPhone(text(formData, "phone"));
  const line1 = text(formData, "line1").slice(0, 180);
  const label = line1.slice(0, 60);
  const line2 = text(formData, "line2").slice(0, 180) || null;
  const postalCode = text(formData, "postalCode");
  const city = text(formData, "city").slice(0, 100);
  const makeDefault = formData.get("isDefault") === "on";
  if (
    !recipientName ||
    !phone ||
    !line1 ||
    !/^\d{5}$/.test(postalCode) ||
    !city
  )
    redirect(accountView(locale, "addresses", "invalid"));
  const existing = id
    ? await prisma.savedAddress.findFirst({
        where: { id, clientId: account.client.id },
      })
    : null;
  if (id && !existing) redirect(accountView(locale, "addresses", "invalid"));
  if (
    !id &&
    (await prisma.savedAddress.count({
      where: { clientId: account.client.id },
    })) >= 10
  )
    redirect(accountView(locale, "addresses", "limit"));
  await prisma.$transaction(async (tx) => {
    const count = await tx.savedAddress.count({
      where: { clientId: account.client.id },
    });
    const isDefault = makeDefault || count === 0;
    if (isDefault) {
      await tx.savedAddress.updateMany({
        where: { clientId: account.client.id, isDefault: true },
        data: { isDefault: false },
      });
    }
    const data = {
      label,
      recipientName,
      phone,
      line1,
      line2,
      postalCode,
      city,
      country: "FI",
      ...(isDefault ? { isDefault: true } : {}),
    };
    if (existing)
      await tx.savedAddress.update({ where: { id: existing.id }, data });
    else
      await tx.savedAddress.create({
        data: { ...data, clientId: account.client.id },
      });
  });
  await auditForUser(
    account.user,
    existing ? "client_address_updated" : "client_address_created",
    "Client",
    account.client.id,
  );
  redirect(accountView(locale, "addresses", "saved"));
}

export async function deleteClientAddressAction(formData: FormData) {
  const locale = localeFrom(formData);
  const account = await clientAccount();
  if (!account) redirect(accountHref(locale, "login"));
  const id = text(formData, "id");
  const address = await prisma.savedAddress.findFirst({
    where: { id, clientId: account.client.id },
  });
  if (!address) redirect(accountView(locale, "addresses", "invalid"));
  await prisma.$transaction(async (tx) => {
    await tx.savedAddress.delete({ where: { id: address.id } });
    if (address.isDefault) {
      const next = await tx.savedAddress.findFirst({
        where: { clientId: account.client.id },
        orderBy: [{ lastUsedAt: "desc" }, { updatedAt: "desc" }],
      });
      if (next)
        await tx.savedAddress.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
    }
  });
  await auditForUser(
    account.user,
    "client_address_deleted",
    "SavedAddress",
    address.id,
  );
  redirect(accountView(locale, "addresses", "deleted"));
}

export async function makeDefaultClientAddressAction(formData: FormData) {
  const locale = localeFrom(formData);
  const account = await clientAccount();
  if (!account) redirect(accountHref(locale, "login"));
  const id = text(formData, "id");
  const address = await prisma.savedAddress.findFirst({
    where: { id, clientId: account.client.id },
  });
  if (!address) redirect(accountView(locale, "addresses", "invalid"));
  await prisma.$transaction(async (tx) => {
    await tx.savedAddress.updateMany({
      where: { clientId: account.client.id, isDefault: true },
      data: { isDefault: false },
    });
    await tx.savedAddress.update({ where: { id }, data: { isDefault: true } });
  });
  await auditForUser(
    account.user,
    "client_address_defaulted",
    "SavedAddress",
    id,
  );
  redirect(accountView(locale, "addresses", "saved"));
}

export async function clientLoginAction(formData: FormData) {
  const locale = localeFrom(formData);
  const email = normalizeEmail(text(formData, "email"));
  const password = text(formData, "password");
  const claim = text(formData, "claim");
  const context = await requestAuditContext();
  const user = await prisma.user.findUnique({ where: { email } });
  const blocked = await authRateLimited(
    email,
    "client_login",
    context.ipAddress,
  );
  const valid =
    !blocked &&
    user?.role === "CLIENT" &&
    user.status === "ACTIVE" &&
    Boolean(user.emailVerifiedAt) &&
    (await verifyPassword(password, user.passwordHash));
  if (!valid) {
    await audit({
      actor: email || "unknown",
      actorUserId: user?.id,
      actorRole: user?.role,
      action: "client_login",
      outcome: blocked ? "DENIED" : "FAILURE",
      entity: "User",
      entityId: user?.id,
      ...context,
    });
    redirect(
      `${accountHref(locale, "login")}?error=invalid${claim ? `&claim=${encodeURIComponent(claim)}` : ""}`,
    );
  }
  await reconcileGuestHistory(user.id);
  await createSession(user.id, "client");
  await audit({
    actor: user.email,
    actorUserId: user.id,
    actorRole: user.role,
    action: "client_login",
    entity: "User",
    entityId: user.id,
    ...context,
  });
  redirect(
    claim
      ? `${accountHref(locale, "claim")}?token=${encodeURIComponent(claim)}`
      : accountHref(locale),
  );
}

export async function clientLogoutAction(formData: FormData) {
  const locale = localeFrom(formData);
  const user = await currentUser("client");
  if (user?.role === "CLIENT")
    await auditForUser(user, "client_logout", "User", user.id);
  await destroySession("client");
  redirect(accountHref(locale, "login"));
}

export async function requestClientPasswordResetAction(formData: FormData) {
  const locale = localeFrom(formData);
  const email = normalizeEmail(text(formData, "email"));
  const context = await requestAuditContext();
  const user = await prisma.user.findFirst({
    where: { email, role: "CLIENT", status: "ACTIVE" },
  });
  if (
    user &&
    !(await authRateLimited(
      email,
      "client_password_reset_requested",
      context.ipAddress,
    ))
  ) {
    await prisma.accountToken.deleteMany({
      where: { userId: user.id, purpose: "RESET_PASSWORD", consumedAt: null },
    });
    const token = await createAccountToken({
      userId: user.id,
      email,
      purpose: "RESET_PASSWORD",
      ttlMs: 60 * 60 * 1000,
    });
    const url = `${accountUrl(locale, "reset")}?token=${encodeURIComponent(token)}`;
    const passwordResetEmail = renderAccountActionEmail({
      locale,
      kind: "password-reset",
      href: url,
      name: user.name,
    });
    await sendEmail({
      to: email,
      ...passwordResetEmail,
      idempotencyKey: `client-reset:${user.id}:${Date.now()}`,
    });
    await audit({
      actor: email,
      actorUserId: user.id,
      actorRole: user.role,
      action: "client_password_reset_requested",
      entity: "User",
      entityId: user.id,
      ...context,
    });
  }
  redirect(`${accountHref(locale, "forgot")}?sent=1`);
}

export async function resetClientPasswordAction(formData: FormData) {
  const locale = localeFrom(formData);
  const raw = text(formData, "token");
  const password = text(formData, "password");
  const confirm = text(formData, "confirmPassword");
  const token = await validAccountToken(raw, "RESET_PASSWORD");
  if (!token?.userId || passwordError(password) || password !== confirm)
    redirect(
      `${accountHref(locale, "reset")}?error=invalid&token=${encodeURIComponent(raw)}`,
    );
  const passwordHash = await hashPassword(password);
  const changed = await prisma.$transaction(async (tx) => {
    const consumed = await tx.accountToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!consumed.count) return null;
    await tx.session.deleteMany({ where: { userId: token.userId! } });
    return tx.user.update({
      where: { id: token.userId! },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  });
  if (!changed) redirect(`${accountHref(locale, "reset")}?error=invalid`);
  await audit({
    actor: changed.email,
    actorUserId: changed.id,
    actorRole: changed.role,
    action: "client_password_reset",
    entity: "User",
    entityId: changed.id,
  });
  redirect(`${accountHref(locale, "login")}?notice=password_changed`);
}

export async function claimAppointmentAction(formData: FormData) {
  const locale = localeFrom(formData);
  const raw = text(formData, "token");
  const user = await currentUser("client");
  if (!user || user.role !== "CLIENT")
    redirect(
      `${accountHref(locale, "login")}?claim=${encodeURIComponent(raw)}`,
    );
  const token = raw
    ? await prisma.accountToken.findFirst({
        where: {
          tokenHash: tokenHash(raw),
          purpose: "CLAIM_APPOINTMENT",
          expiresAt: { gt: new Date() },
        },
      })
    : null;
  const client = await prisma.client.findUnique({ where: { userId: user.id } });
  if (!token?.appointmentId || !client || token.email !== user.email)
    redirect(`${accountHref(locale, "claim")}?error=invalid`);
  await reconcileGuestHistory(user.id);
  const claimed = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: token.appointmentId! },
      include: { client: { select: { userId: true } } },
    });
    if (!appointment) return null;
    if (appointment.client.userId && appointment.client.userId !== user.id)
      return null;
    const consumed = await tx.accountToken.updateMany({
      where: { id: token.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (!consumed.count && appointment.clientId !== client.id) return null;
    if (appointment.clientId === client.id) return appointment;
    const updated = await tx.appointment.update({
      where: { id: token.appointmentId! },
      data: { clientId: client.id },
    });
    await tx.appointmentChangeRequest.updateMany({
      where: { appointmentId: updated.id },
      data: { clientId: client.id },
    });
    return updated;
  });
  if (!claimed) redirect(`${accountHref(locale, "claim")}?error=invalid`);
  await auditForUser(user, "appointment_claimed", "Appointment", claimed.id);
  redirect(`${accountHref(locale)}?claimed=1`);
}
