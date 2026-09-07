"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash } from "@phosphor-icons/react";
import { ThemedSelect } from "@/components/ui/ThemedSelect";

type Locale = "fi" | "en" | "ru";
type Localized = Record<Locale, string>;
type Choice = {
  key: string;
  displayOrder: number;
  active: boolean;
  labels: Localized;
};
type Question = {
  key: string;
  type: string;
  required: boolean;
  active: boolean;
  displayOrder: number;
  prompts: Localized;
  choices: Choice[];
};
type EditorState = {
  version: number;
  wording: Record<string, { version: number; text: Localized }>;
  questions: Question[];
};

const locales: Locale[] = ["fi", "en", "ru"];
const types = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTI_CHOICE",
  "ACKNOWLEDGMENT",
].map((value) => ({ value, label: value.replaceAll("_", " ") }));
const emptyLocalized = (): Localized => ({ fi: "", en: "", ru: "" });

export function ConsultationFormAdmin({ locale }: { locale: Locale }) {
  const [state, setState] = useState<EditorState | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/consultation", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((form) => {
        const localized = (value: unknown): Localized => {
          const object = (value ?? {}) as Record<string, unknown>;
          return Object.fromEntries(
            locales.map((key) => [key, String(object[key] ?? "")]),
          ) as Localized;
        };
        setState({
          version: form.contentVersion,
          wording: {
            healthConsent: {
              version: form.healthConsentVersion,
              text: localized(form.healthConsentWording),
            },
            accuracy: {
              version: form.accuracyVersion,
              text: localized(form.accuracyWording),
            },
            requiredInformation: {
              version: form.requiredInformationVersion,
              text: localized(form.requiredInformationWording),
            },
            procedureConsent: {
              version: form.procedureConsentVersion,
              text: localized(form.procedureConsentWording),
            },
          },
          questions: form.questions.map(
            (question: Record<string, unknown>, index: number) => ({
              key: String(question.key),
              type: String(question.type),
              required: Boolean(question.required),
              active: Boolean(question.active) && !question.archivedAt,
              displayOrder: index,
              prompts: Object.fromEntries(
                locales.map((key) => [
                  key,
                  String(
                    (question.contents as Array<Record<string, unknown>>).find(
                      (item) => item.locale === key,
                    )?.prompt ?? "",
                  ),
                ]),
              ) as Localized,
              choices: (question.choices as Array<Record<string, unknown>>).map(
                (choice, choiceIndex) => ({
                  key: String(choice.key),
                  active: Boolean(choice.active),
                  displayOrder: choiceIndex,
                  labels: Object.fromEntries(
                    locales.map((key) => [
                      key,
                      String(
                        (
                          choice.contents as Array<Record<string, unknown>>
                        ).find((item) => item.locale === key)?.label ?? "",
                      ),
                    ]),
                  ) as Localized,
                }),
              ),
            }),
          ),
        });
      })
      .catch(() => setMessage("Unable to load consultation form."));
    return () => controller.abort();
  }, []);

  if (!state)
    return (
      <p className="font-sans text-sm text-muted">
        {message || "Loading consultation form…"}
      </p>
    );
  const updateQuestion = (index: number, patch: Partial<Question>) =>
    setState({
      ...state,
      questions: state.questions.map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    });
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= state.questions.length) return;
    const questions = [...state.questions];
    [questions[index], questions[target]] = [
      questions[target],
      questions[index],
    ];
    setState({
      ...state,
      questions: questions.map((item, displayOrder) => ({
        ...item,
        displayOrder,
      })),
    });
  };
  async function save() {
    setMessage("Saving…");
    const response = await fetch("/api/admin/consultation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(
        payload.error === "incomplete_locales"
          ? "Complete every FI/EN/RU translation before publishing."
          : "Could not save the consultation form.",
      );
      return;
    }
    setState((current) =>
      current ? { ...current, version: payload.version } : current,
    );
    setMessage("Consultation form published.");
  }

  return (
    <section className="rounded-lg border border-line-card bg-card p-[clamp(16px,2.5vw,24px)]">
      <h2 className="font-display text-[26px] font-medium text-ink">
        Consultation form
      </h2>
      <p className="mt-2 font-sans text-sm text-muted">
        Manage required information, consent snapshots, question order, and
        FI/EN/RU translations.
      </p>
      <div className="mt-5 grid gap-4">
        {Object.entries(state.wording).map(([key, item]) => (
          <fieldset key={key} className="rounded border border-line-card p-3">
            <legend className="px-1 font-sans text-xs font-semibold uppercase">
              {key.replaceAll(/([A-Z])/g, " $1")}
            </legend>
            <div className="grid gap-3 md:grid-cols-3">
              {locales.map((language) => (
                <label key={language} className="font-sans text-xs text-muted">
                  {language.toUpperCase()}
                  <textarea
                    value={item.text[language]}
                    onChange={(event) =>
                      setState({
                        ...state,
                        wording: {
                          ...state.wording,
                          [key]: {
                            ...item,
                            text: {
                              ...item.text,
                              [language]: event.target.value,
                            },
                          },
                        },
                      })
                    }
                    rows={3}
                    className="mt-1 min-h-24 w-full rounded border border-line-btn bg-page p-2 text-sm text-ink"
                  />
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 grid gap-4">
        {state.questions.map((question, index) => (
          <fieldset
            key={question.key}
            className="rounded border border-line-card p-3"
          >
            <legend className="px-1 font-sans text-xs font-semibold">
              {question.key}
            </legend>
            <div className="flex flex-wrap items-center gap-3">
              <ThemedSelect
                value={question.type}
                options={types}
                ariaLabel="Question type"
                onValueChange={(type) => updateQuestion(index, { type })}
              />
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(event) =>
                    updateQuestion(index, { required: event.target.checked })
                  }
                />
                Required
              </label>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={question.active}
                  onChange={(event) =>
                    updateQuestion(index, { active: event.target.checked })
                  }
                />
                Active
              </label>
              <button
                type="button"
                aria-label="Move up"
                onClick={() => move(index, -1)}
                className="min-h-11 min-w-11"
              >
                <ArrowUp />
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(index, 1)}
                className="min-h-11 min-w-11"
              >
                <ArrowDown />
              </button>
              <button
                type="button"
                onClick={() => updateQuestion(index, { active: false })}
                className="min-h-11 min-w-11"
                aria-label="Archive"
              >
                <Trash />
              </button>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {locales.map((language) => (
                <label key={language} className="font-sans text-xs text-muted">
                  Prompt · {language.toUpperCase()}
                  <textarea
                    value={question.prompts[language]}
                    onChange={(event) =>
                      updateQuestion(index, {
                        prompts: {
                          ...question.prompts,
                          [language]: event.target.value,
                        },
                      })
                    }
                    rows={2}
                    className="mt-1 w-full rounded border border-line-btn bg-page p-2 text-sm text-ink"
                  />
                </label>
              ))}
            </div>
            {["SINGLE_CHOICE", "MULTI_CHOICE"].includes(question.type) ? (
              <div className="mt-3 grid gap-2">
                {question.choices.map((choice, choiceIndex) => (
                  <div
                    key={choice.key}
                    className="grid gap-2 rounded border border-line-hair p-2 md:grid-cols-[140px_repeat(3,1fr)]"
                  >
                    <input
                      aria-label="Stable choice key"
                      value={choice.key}
                      onChange={(event) =>
                        updateQuestion(index, {
                          choices: question.choices.map((item, i) =>
                            i === choiceIndex
                              ? { ...item, key: event.target.value }
                              : item,
                          ),
                        })
                      }
                      className="rounded border border-line-btn bg-page p-2 text-sm"
                    />
                    {locales.map((language) => (
                      <input
                        key={language}
                        aria-label={`Choice ${language}`}
                        placeholder={language.toUpperCase()}
                        value={choice.labels[language]}
                        onChange={(event) =>
                          updateQuestion(index, {
                            choices: question.choices.map((item, i) =>
                              i === choiceIndex
                                ? {
                                    ...item,
                                    labels: {
                                      ...item.labels,
                                      [language]: event.target.value,
                                    },
                                  }
                                : item,
                            ),
                          })
                        }
                        className="rounded border border-line-btn bg-page p-2 text-sm"
                      />
                    ))}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateQuestion(index, {
                      choices: [
                        ...question.choices,
                        {
                          key: `choice_${question.choices.length + 1}`,
                          active: true,
                          displayOrder: question.choices.length,
                          labels: emptyLocalized(),
                        },
                      ],
                    })
                  }
                  className="inline-flex min-h-11 w-fit items-center gap-2 text-sm text-accent"
                >
                  <Plus />
                  Add choice
                </button>
              </div>
            ) : null}
          </fieldset>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() =>
            setState({
              ...state,
              questions: [
                ...state.questions,
                {
                  key: `question_${Date.now()}`,
                  type: "SHORT_TEXT",
                  required: false,
                  active: true,
                  displayOrder: state.questions.length,
                  prompts: emptyLocalized(),
                  choices: [],
                },
              ],
            })
          }
          className="inline-flex min-h-11 items-center gap-2 rounded border border-line-btn px-4 text-sm"
        >
          <Plus />
          Add question
        </button>
        <button
          type="button"
          onClick={() => void save()}
          className="min-h-11 rounded bg-accent px-5 text-sm font-medium text-page"
        >
          Publish
        </button>
        {message ? (
          <p role="status" className="self-center text-sm text-body">
            {message}
          </p>
        ) : null}
      </div>
      <p className="sr-only">Active interface locale: {locale}</p>
    </section>
  );
}
