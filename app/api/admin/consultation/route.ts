import { NextResponse, type NextRequest } from "next/server";
import { ConsultationQuestionType, Prisma } from "@prisma/client";
import { auditForUser, requireApiUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

const LOCALES = ["fi", "en", "ru"] as const;
const TYPES = new Set([
  "SHORT_TEXT",
  "LONG_TEXT",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "ACKNOWLEDGMENT",
]);

type Localized = Record<(typeof LOCALES)[number], string>;
type QuestionInput = {
  key: string;
  type: string;
  required: boolean;
  active: boolean;
  displayOrder: number;
  prompts: Localized;
  helpText?: Partial<Localized>;
  choices?: Array<{
    key: string;
    displayOrder: number;
    active: boolean;
    labels: Localized;
  }>;
};

function localized(value: unknown): value is Localized {
  return Boolean(
    value &&
    typeof value === "object" &&
    LOCALES.every(
      (locale) =>
        typeof (value as Record<string, unknown>)[locale] === "string" &&
        String((value as Record<string, unknown>)[locale]).trim(),
    ),
  );
}

export async function GET() {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await prisma.consultationForm.findUnique({
    where: { id: "current" },
    include: {
      questions: {
        orderBy: { displayOrder: "asc" },
        include: {
          contents: true,
          choices: {
            orderBy: { displayOrder: "asc" },
            include: { contents: true },
          },
        },
      },
    },
  });
  return NextResponse.json(form, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await requireApiUser(["ADMIN", "STAFF"]);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const payload = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const questions = Array.isArray(payload?.questions)
    ? (payload.questions as QuestionInput[])
    : null;
  const version = Number(payload?.version);
  const wording = payload?.wording as
    Record<string, { version: number; text: Localized }> | undefined;
  if (!questions || !Number.isInteger(version) || version < 1 || !wording)
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const wordingKeys = [
    "healthConsent",
    "accuracy",
    "requiredInformation",
    "procedureConsent",
  ];
  if (
    wordingKeys.some(
      (key) =>
        !wording[key] ||
        !Number.isInteger(wording[key].version) ||
        !localized(wording[key].text),
    ) ||
    questions.some(
      (question) =>
        !/^[a-z0-9][a-z0-9_-]{1,79}$/.test(question.key) ||
        !TYPES.has(question.type) ||
        !localized(question.prompts) ||
        !Number.isInteger(question.displayOrder) ||
        (["SINGLE_CHOICE", "MULTI_CHOICE"].includes(question.type) &&
          (!question.choices?.length ||
            question.choices.some(
              (choice) =>
                !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(choice.key) ||
                !localized(choice.labels),
            ))),
    )
  )
    return NextResponse.json({ error: "incomplete_locales" }, { status: 400 });
  if (
    new Set(questions.map((question) => question.key)).size !== questions.length
  )
    return NextResponse.json({ error: "duplicate_key" }, { status: 400 });

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const current = await tx.consultationForm.findUniqueOrThrow({
          where: { id: "current" },
          include: {
            questions: { include: { contents: true, choices: true } },
          },
        });
        if (current.contentVersion !== version)
          throw new Error("version_conflict");
        const stricter = questions.some((next) => {
          const previous = current.questions.find(
            (item) => item.key === next.key,
          );
          if (!next.required || !next.active) return false;
          if (!previous || !previous.required || !previous.active) return true;
          const oldPrompts = new Map(
            previous.contents.map((item) => [item.locale, item.prompt]),
          );
          return (
            previous.type !== next.type ||
            LOCALES.some(
              (locale) => oldPrompts.get(locale) !== next.prompts[locale],
            ) ||
            JSON.stringify(
              previous.choices.map((choice) => choice.key).sort(),
            ) !==
              JSON.stringify(
                (next.choices ?? []).map((choice) => choice.key).sort(),
              )
          );
        });
        const nextWordingVersion = (
          currentText: Prisma.JsonValue,
          nextText: Localized,
          currentVersion: number,
        ) =>
          JSON.stringify(currentText) === JSON.stringify(nextText)
            ? currentVersion
            : currentVersion + 1;
        await tx.consultationQuestion.updateMany({
          where: {
            formId: "current",
            key: { notIn: questions.map((item) => item.key) },
          },
          data: { active: false, archivedAt: new Date() },
        });
        for (const question of questions) {
          const existing = current.questions.find(
            (item) => item.key === question.key,
          );
          const saved = existing
            ? await tx.consultationQuestion.update({
                where: { id: existing.id },
                data: {
                  type: question.type as ConsultationQuestionType,
                  required: question.required,
                  active: question.active,
                  displayOrder: question.displayOrder,
                  archivedAt: question.active
                    ? null
                    : (existing.archivedAt ?? new Date()),
                  version: { increment: 1 },
                  ...(stricter && question.required
                    ? { requiredSinceVersion: current.requiredVersion + 1 }
                    : {}),
                },
              })
            : await tx.consultationQuestion.create({
                data: {
                  formId: "current",
                  key: question.key,
                  type: question.type as ConsultationQuestionType,
                  required: question.required,
                  active: question.active,
                  displayOrder: question.displayOrder,
                  requiredSinceVersion: question.required
                    ? current.requiredVersion + 1
                    : null,
                },
              });
          for (const locale of LOCALES)
            await tx.consultationQuestionContent.upsert({
              where: { questionId_locale: { questionId: saved.id, locale } },
              update: {
                prompt: question.prompts[locale],
                helpText: question.helpText?.[locale] ?? null,
              },
              create: {
                questionId: saved.id,
                locale,
                prompt: question.prompts[locale],
                helpText: question.helpText?.[locale] ?? null,
              },
            });
          const choiceKeys = (question.choices ?? []).map(
            (choice) => choice.key,
          );
          await tx.consultationChoice.updateMany({
            where: { questionId: saved.id, key: { notIn: choiceKeys } },
            data: { active: false },
          });
          for (const choice of question.choices ?? []) {
            const savedChoice = await tx.consultationChoice.upsert({
              where: {
                questionId_key: { questionId: saved.id, key: choice.key },
              },
              update: {
                displayOrder: choice.displayOrder,
                active: choice.active,
              },
              create: {
                questionId: saved.id,
                key: choice.key,
                displayOrder: choice.displayOrder,
                active: choice.active,
              },
            });
            for (const locale of LOCALES)
              await tx.consultationChoiceContent.upsert({
                where: {
                  choiceId_locale: { choiceId: savedChoice.id, locale },
                },
                update: { label: choice.labels[locale] },
                create: {
                  choiceId: savedChoice.id,
                  locale,
                  label: choice.labels[locale],
                },
              });
          }
        }
        const claimed = await tx.consultationForm.updateMany({
          where: { id: "current", contentVersion: version },
          data: {
            contentVersion: { increment: 1 },
            ...(stricter ? { requiredVersion: { increment: 1 } } : {}),
            healthConsentVersion: nextWordingVersion(
              current.healthConsentWording,
              wording.healthConsent.text,
              current.healthConsentVersion,
            ),
            healthConsentWording: wording.healthConsent.text,
            accuracyVersion: nextWordingVersion(
              current.accuracyWording,
              wording.accuracy.text,
              current.accuracyVersion,
            ),
            accuracyWording: wording.accuracy.text,
            requiredInformationVersion: nextWordingVersion(
              current.requiredInformationWording,
              wording.requiredInformation.text,
              current.requiredInformationVersion,
            ),
            requiredInformationWording: wording.requiredInformation.text,
            procedureConsentVersion: nextWordingVersion(
              current.procedureConsentWording,
              wording.procedureConsent.text,
              current.procedureConsentVersion,
            ),
            procedureConsentWording: wording.procedureConsent.text,
          },
        });
        if (!claimed.count) throw new Error("version_conflict");
        return {
          version: version + 1,
          requiredVersion: current.requiredVersion + (stricter ? 1 : 0),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    await auditForUser(
      user,
      "consultation_form_updated",
      "ConsultationForm",
      "current",
      {
        request,
        metadata: {
          version: result.version,
          requiredVersion: result.requiredVersion,
        },
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "version_conflict")
      return NextResponse.json({ error: "version_conflict" }, { status: 409 });
    throw error;
  }
}
