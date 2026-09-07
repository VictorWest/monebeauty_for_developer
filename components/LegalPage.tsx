import { Container } from "@/components/ui/Container";

/** Shared legal page shell (Privacy / Terms / Cookies). Content is a placeholder. */
export function LegalPage({
  title,
  lastUpdatedLabel,
  date,
  body,
  sections = [],
}: {
  title: string;
  lastUpdatedLabel: string;
  date: string;
  body: string[];
  sections?: Array<{
    id: string;
    title: string;
    paragraphs: string[];
  }>;
}) {
  return (
    <section className="bg-page py-[clamp(48px,6vw,88px)]">
      <Container className="max-w-[720px]">
        <h1 className="font-display text-h2 leading-[1.06] font-medium text-ink">
          {title}
        </h1>
        <p className="mt-[12px] font-sans text-[12px] tracking-[.14em] text-muted uppercase">
          {lastUpdatedLabel}: {date}
        </p>
        <div className="mt-[28px] grid gap-[16px] font-sans text-copy leading-[1.8] font-normal text-body">
          {body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        {sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            className="mt-[32px] scroll-mt-24 border-t border-line-hair pt-[28px]"
          >
            <h2 className="font-display text-[clamp(26px,3vw,36px)] leading-[1.12] font-medium text-ink">
              {section.title}
            </h2>
            <div className="mt-[18px] grid gap-[14px] font-sans text-copy leading-[1.8] font-normal text-body">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </Container>
    </section>
  );
}
