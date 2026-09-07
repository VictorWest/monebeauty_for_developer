import { Markdown } from "@/components/Markdown";
import type { Locale } from "@/i18n/routing";

type Faq = { q: string; a: string };

const labels = {
  en: {
    what: "What the treatment is and how it works",
    suitable: "Who it is suitable for",
    benefits: "Benefits",
    results: "Expected results and recommended sessions",
    safety: "Safety and contraindications",
    care: "Preparation and aftercare",
    preparation: "Preparation",
    aftercare: "Aftercare",
    faq: "Frequently asked questions",
  },
  fi: {
    what: "Mikä hoito on ja miten se toimii",
    suitable: "Kenelle hoito sopii",
    benefits: "Hyödyt",
    results: "Odotettavat tulokset ja suositeltu hoitomäärä",
    safety: "Turvallisuus ja vasta-aiheet",
    care: "Valmistautuminen ja jälkihoito",
    preparation: "Valmistautuminen",
    aftercare: "Jälkihoito",
    faq: "Usein kysytyt kysymykset",
  },
  ru: {
    what: "Что представляет собой процедура и как она работает",
    suitable: "Кому подходит процедура",
    benefits: "Преимущества",
    results: "Ожидаемые результаты и рекомендуемый курс",
    safety: "Безопасность и противопоказания",
    care: "Подготовка и последующий уход",
    preparation: "Подготовка",
    aftercare: "Последующий уход",
    faq: "Часто задаваемые вопросы",
  },
} as const;

export type StructuredTreatmentContent = {
  whatItIs: string;
  suitableFor: string[];
  benefits: string[];
  processSteps: string[];
  safety: string;
  preCare: string;
  postCare: string;
  contraindications: string[];
  sessions: string;
  results: string;
  faq: unknown;
};

export function TreatmentInformation({
  content,
  locale,
  showWhatItIs = true,
}: {
  content: StructuredTreatmentContent;
  locale: Locale;
  showWhatItIs?: boolean;
}) {
  const t = labels[locale];
  const faq = parseFaq(content.faq);
  const results = [content.results, content.sessions].filter(Boolean);
  const safety = [content.safety, ...content.contraindications].filter(Boolean);
  const hasCare = Boolean(content.preCare || content.postCare);

  return (
    <div className="mx-auto max-w-[860px] space-y-[clamp(38px,6vw,68px)]">
      {showWhatItIs && content.whatItIs.trim() ? (
        <InformationSection title={t.what}>
          <Markdown variant="technology">
            {withoutEmbeddedImages(content.whatItIs)}
          </Markdown>
          {content.processSteps.length ? (
            <ol className="mt-5 grid gap-3">
              {content.processSteps.map((step, index) => (
                <li key={step} className="flex gap-3">
                  <span className="text-accent" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : null}
        </InformationSection>
      ) : null}
      {content.suitableFor.length ? (
        <ListSection title={t.suitable} items={content.suitableFor} />
      ) : null}
      {content.benefits.length ? (
        <ListSection title={t.benefits} items={content.benefits} />
      ) : null}
      {results.length ? (
        <ListSection title={t.results} items={results} />
      ) : null}
      {safety.length ? <ListSection title={t.safety} items={safety} /> : null}
      {hasCare ? (
        <InformationSection title={t.care}>
          <div className="grid gap-6 sm:grid-cols-2">
            {content.preCare ? (
              <CareBlock title={t.preparation} value={content.preCare} />
            ) : null}
            {content.postCare ? (
              <CareBlock title={t.aftercare} value={content.postCare} />
            ) : null}
          </div>
        </InformationSection>
      ) : null}
      {faq.length ? (
        <InformationSection title={t.faq}>
          <div className="divide-y divide-line-hair border-y border-line-hair">
            {faq.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="cursor-pointer list-none font-sans text-copy font-medium text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                  {item.q}
                </summary>
                <div className="mt-3 font-sans text-copy leading-[1.75] text-body">
                  <Markdown>{item.a}</Markdown>
                </div>
              </details>
            ))}
          </div>
        </InformationSection>
      ) : null}
    </div>
  );
}

function InformationSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-5 font-display text-[clamp(29px,4vw,43px)] leading-[1.08] font-medium text-ink">
        {title}
      </h2>
      <div className="font-sans text-copy leading-[1.8] text-body">
        {children}
      </div>
    </section>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <InformationSection title={title}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item}
            className="rounded-[var(--radius)] border border-line-card bg-card px-5 py-4"
          >
            {item}
          </li>
        ))}
      </ul>
    </InformationSection>
  );
}

function CareBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line-card bg-card p-5">
      <h3 className="font-display text-[23px] font-medium text-ink">{title}</h3>
      <div className="mt-3">
        <Markdown>{value}</Markdown>
      </div>
    </div>
  );
}

function parseFaq(value: unknown): Faq[] {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        item &&
        typeof item === "object" &&
        "q" in item &&
        "a" in item &&
        typeof item.q === "string" &&
        typeof item.a === "string"
          ? [{ q: item.q, a: item.a }]
          : [],
      )
    : [];
}

function withoutEmbeddedImages(markdown: string) {
  return markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
}
