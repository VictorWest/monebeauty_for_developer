import "server-only";

import type { Prisma } from "@prisma/client";
import type { Locale } from "@/i18n/routing";
import { prisma } from "@/lib/db";
import { normalizeContactEmail } from "@/lib/contact-normalization";
import { validAccountToken } from "@/lib/auth";
import {
  decryptSensitiveJson,
  decryptSensitiveText,
  encryptSensitiveJson,
  encryptSensitiveText,
} from "@/lib/sensitive-data";
import type {
  BookingConsultationConfig,
  BookingConsultationPayload,
  ConsultationAnswer,
  SavedConsultationAnswers,
} from "@/lib/consultation-types";

type ConsultationDb = Prisma.TransactionClient | typeof prisma;

const consultationInclude = {
  questions: {
    where: { active: true, archivedAt: null },
    orderBy: { displayOrder: "asc" as const },
    include: {
      contents: true,
      choices: {
        where: { active: true },
        orderBy: { displayOrder: "asc" as const },
        include: { contents: true },
      },
    },
  },
} satisfies Prisma.ConsultationFormInclude;

export async function loadConsultationForm(db: ConsultationDb = prisma) {
  return db.consultationForm.findUnique({
    where: { id: "current" },
    include: consultationInclude,
  });
}

function localized(value: Prisma.JsonValue, locale: Locale) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? String((value as Record<string, unknown>)[locale] ?? "").trim()
    : "";
}

export function serializeConsultationForm(
  form: NonNullable<Awaited<ReturnType<typeof loadConsultationForm>>>,
  locale: Locale,
): BookingConsultationConfig | null {
  const questions = form.questions.map((question) => {
    const content = question.contents.find((item) => item.locale === locale);
    return {
      key: question.key,
      type: question.type,
      required: question.required,
      prompt: content?.prompt.trim() ?? "",
      helpText: content?.helpText?.trim() || null,
      choices: question.choices.map((choice) => ({
        key: choice.key,
        label:
          choice.contents
            .find((item) => item.locale === locale)
            ?.label.trim() ?? "",
      })),
    };
  });
  const config = {
    contentVersion: form.contentVersion,
    requiredVersion: form.requiredVersion,
    requiredInformation: localized(form.requiredInformationWording, locale),
    healthConsent: localized(form.healthConsentWording, locale),
    accuracyAcknowledgment: localized(form.accuracyWording, locale),
    questions,
  };
  if (
    !config.requiredInformation ||
    !config.healthConsent ||
    !config.accuracyAcknowledgment ||
    questions.some(
      (question) =>
        !question.prompt || question.choices.some((choice) => !choice.label),
    )
  )
    return null;
  return config;
}

function validBirthDate(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() + 1 !== Number(match[2]) ||
    date.getUTCDate() !== Number(match[3]) ||
    date.getTime() >= Date.now()
  )
    return null;
  return value;
}

function present(answer: ConsultationAnswer) {
  return (
    answer !== "" &&
    answer !== false &&
    (!Array.isArray(answer) || answer.length > 0)
  );
}

export function validateConsultationSubmission(
  raw: unknown,
  form: NonNullable<Awaited<ReturnType<typeof loadConsultationForm>>>,
  locale: Locale,
) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return { ok: false as const, error: "consultation_required" as const };
  const payload = raw as Partial<BookingConsultationPayload>;
  if (
    !Number.isInteger(payload.contentVersion) ||
    payload.contentVersion !== form.contentVersion
  )
    return { ok: false as const, error: "consultation_stale" as const };
  const dateOfBirth = validBirthDate(payload.dateOfBirth);
  if (!dateOfBirth)
    return { ok: false as const, error: "consultation_invalid" as const };
  if (payload.healthConsent !== true || payload.accuracyAcknowledged !== true)
    return { ok: false as const, error: "consultation_required" as const };
  if (
    !payload.answers ||
    typeof payload.answers !== "object" ||
    Array.isArray(payload.answers)
  )
    return { ok: false as const, error: "consultation_required" as const };

  const snapshots = form.questions.map((question) => {
    const supplied = payload.answers?.[question.key];
    const allowed = new Set(question.choices.map((choice) => choice.key));
    let answer: ConsultationAnswer;
    if (question.type === "MULTI_CHOICE") {
      answer = Array.isArray(supplied)
        ? supplied.filter(
            (value): value is string =>
              typeof value === "string" && allowed.has(value),
          )
        : [];
    } else if (question.type === "SINGLE_CHOICE") {
      answer =
        typeof supplied === "string" && allowed.has(supplied) ? supplied : "";
    } else if (question.type === "YES_NO") {
      answer = supplied === "yes" || supplied === "no" ? supplied : "";
    } else if (question.type === "ACKNOWLEDGMENT") {
      answer = supplied === true;
    } else {
      answer =
        typeof supplied === "string" ? supplied.trim().slice(0, 4000) : "";
    }
    const content = question.contents.find((item) => item.locale === locale);
    return {
      key: question.key,
      questionVersion: question.version,
      prompt: content?.prompt.trim() ?? "",
      required: question.required,
      answer,
    };
  });
  if (
    snapshots.some(
      (item) => !item.prompt || (item.required && !present(item.answer)),
    )
  )
    return { ok: false as const, error: "consultation_required" as const };

  try {
    return {
      ok: true as const,
      encrypted: {
        dateOfBirthEncrypted: encryptSensitiveText(dateOfBirth),
        answersEncrypted: encryptSensitiveJson(snapshots),
      },
      snapshots,
    };
  } catch {
    return { ok: false as const, error: "consultation_unavailable" as const };
  }
}

export function decryptSavedConsultation(profile: {
  dateOfBirthEncrypted: string;
  answersEncrypted: string;
}): SavedConsultationAnswers {
  const snapshots = decryptSensitiveJson<
    Array<{ key: string; answer: ConsultationAnswer }>
  >(profile.answersEncrypted);
  return {
    dateOfBirth: decryptSensitiveText(profile.dateOfBirthEncrypted),
    answers: Object.fromEntries(
      snapshots.map((item) => [item.key, item.answer]),
    ),
  };
}

export async function reusableClaimConsultation(rawToken: string) {
  const token = await validAccountToken(rawToken, "CLAIM_APPOINTMENT");
  if (!token?.appointmentId) return null;
  const [appointment, form] = await Promise.all([
    prisma.appointment.findUnique({
      where: { id: token.appointmentId },
      include: {
        client: {
          include: {
            consultationProfile: true,
            user: { select: { id: true } },
          },
        },
      },
    }),
    prisma.consultationForm.findUnique({ where: { id: "current" } }),
  ]);
  const profile = appointment?.client.consultationProfile;
  if (
    !appointment ||
    appointment.client.user ||
    normalizeContactEmail(appointment.contactEmail) !==
      normalizeContactEmail(token.email) ||
    !form ||
    !profile ||
    profile.completedVersion < form.requiredVersion
  )
    return null;
  try {
    decryptSensitiveText(profile.dateOfBirthEncrypted);
    decryptSensitiveJson(profile.answersEncrypted);
  } catch {
    return null;
  }
  return { email: token.email, appointmentId: appointment.id };
}
