import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "@/i18n/navigation";
import { canonicalInternalHref } from "@/lib/public-routes";
import {
  normalizeRichTextMarkdown,
  promoteTreatmentDetailSectionHeadings,
} from "@/lib/markdown-normalization";
import { cn } from "@/lib/cn";

/**
 * Renders real page-body markdown (from scraped_content) with the design system.
 * Images resolve from public/media/** (src rewritten by scripts/gen-content.mjs).
 */
type MarkdownVariant =
  "default" | "technology" | "treatment-detail" | "treatment-summary";

export function Markdown({
  children,
  variant = "default",
  className,
}: {
  children: string;
  variant?: MarkdownVariant;
  className?: string;
}) {
  const technology = variant === "technology";
  const treatmentDetail = variant === "treatment-detail";
  const treatmentSummary = variant === "treatment-summary";
  const normalized = normalizeRichTextMarkdown(children);

  return (
    <div className={cn("max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2
              className={
                technology
                  ? "mt-[clamp(30px,4vw,44px)] font-display text-[clamp(26px,3.2vw,40px)] leading-[1.12] font-medium text-ink first:mt-0"
                  : "mt-[clamp(32px,4vw,48px)] font-display text-[clamp(26px,3.2vw,40px)] leading-[1.12] font-medium text-ink first:mt-0"
              }
            >
              {children}
            </h2>
          ),
          h2: ({ children }) =>
            technology ? (
              <h3 className="mt-[clamp(24px,3vw,34px)] font-display text-[clamp(22px,2.4vw,28px)] leading-[1.14] font-medium text-ink first:mt-0">
                {children}
              </h3>
            ) : (
              <h2 className="mt-[clamp(28px,3.5vw,44px)] font-display text-[clamp(23px,2.6vw,32px)] leading-[1.15] font-medium text-ink first:mt-0">
                {children}
              </h2>
            ),
          h3: ({ children }) => (
            <h3
              className={
                technology
                  ? "mt-[clamp(22px,2.6vw,30px)] font-display text-[clamp(20px,2.2vw,26px)] leading-[1.16] font-medium text-ink"
                  : "mt-[clamp(22px,2.4vw,32px)] font-display text-[22px] font-semibold text-ink"
              }
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p
              className={
                treatmentSummary
                  ? "font-sans text-compact leading-[1.7] text-body"
                  : technology
                    ? "mt-[14px] max-w-[70ch] font-sans text-copy leading-[1.75] font-normal text-body"
                    : "mt-[16px] font-sans text-copy leading-[1.8] font-normal text-body"
              }
            >
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul
              className={
                treatmentSummary
                  ? "mt-2 list-disc space-y-1 pl-5 marker:text-accent first:mt-0"
                  : technology
                    ? "mt-[14px] flex max-w-[70ch] flex-col gap-[8px]"
                    : "mt-[16px] flex flex-col gap-[10px]"
              }
            >
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol
              className={`${treatmentSummary ? "mt-2 gap-1 first:mt-0" : technology ? "mt-[14px] max-w-[70ch] gap-[8px]" : "mt-[16px] gap-[10px]"} flex list-decimal flex-col pl-[20px] marker:text-accent`}
            >
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li
              className={
                treatmentSummary
                  ? "font-sans text-compact leading-[1.7] text-body"
                  : "font-sans text-copy leading-[1.75] font-normal text-body"
              }
            >
              {children}
            </li>
          ),
          a: ({ href, children }) => {
            const canonicalHref = href ? canonicalInternalHref(href) : "";
            const className =
              "text-accent underline decoration-line-underline underline-offset-2 transition-colors hover:decoration-accent";
            return canonicalHref.startsWith("/") &&
              !canonicalHref.startsWith("//") ? (
              <Link href={canonicalHref} className={className}>
                {children}
              </Link>
            ) : (
              <a href={href} className={className}>
                {children}
              </a>
            );
          },
          strong: ({ children }) => (
            <strong className="font-medium text-ink">{children}</strong>
          ),
          img: ({ src, alt }) =>
            typeof src === "string" ? (
              // Markdown images have unknown intrinsic size — plain img with lazy load.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt={alt ?? ""}
                loading="lazy"
                className={
                  technology
                    ? "mt-[28px] w-full rounded-[var(--radius)] object-cover"
                    : "mt-[24px] w-full rounded-[var(--radius)] object-cover"
                }
              />
            ) : null,
          table: ({ children }) => (
            <div className="mt-[20px] overflow-x-auto">
              <table className="w-full border-collapse text-left font-sans text-[14px]">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-line-card px-[12px] py-[10px] font-medium text-ink">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-line-card px-[12px] py-[10px] font-normal text-body">
              {children}
            </td>
          ),
        }}
      >
        {treatmentDetail
          ? promoteTreatmentDetailSectionHeadings(normalized)
          : normalized}
      </ReactMarkdown>
    </div>
  );
}
