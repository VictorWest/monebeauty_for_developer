import "server-only";

import { CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import {
  getBookableServices,
  getLiveProducts,
  getPublishedArticles,
  getPublishedPages,
  getPublishedPricing,
  getPublishedServices,
  getPublishedTechnologies,
} from "@/lib/live-content";
import {
  articlePath,
  canonicalInternalHref,
  productPath,
  PUBLIC_PATHS,
} from "@/lib/public-routes";

export type KnowledgeSnippet = {
  title: string;
  body: string;
  url?: string;
};

export type KnowledgeResult = {
  snippets: KnowledgeSnippet[];
  matched: boolean;
};

const MAX_BODY = 1_800;
const MAX_SNIPPETS = 8;
const QUERY_STOP_TERMS = new Set([
  "about",
  "can",
  "could",
  "does",
  "have",
  "hello",
  "help",
  "offer",
  "perform",
  "please",
  "provide",
  "tell",
  "that",
  "the",
  "what",
  "with",
  "you",
  "että",
  "hei",
  "mitä",
  "onko",
  "teillä",
  "voiko",
  "для",
  "есть",
  "как",
  "ли",
  "можно",
  "предлагаете",
  "привет",
  "расскажите",
  "что",
  "это",
]);

function cleanText(value: string) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#*_>`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function body(value: string) {
  return cleanText(value).slice(0, MAX_BODY);
}

function terms(value: string) {
  return cleanText(value)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((term) => term.length > 2 && !QUERY_STOP_TERMS.has(term));
}

function normalizedContextPath(value: string | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return null;
  return canonicalInternalHref(value.split(/[?#]/, 1)[0]);
}

function scoreSnippet(
  queryTerms: string[],
  snippet: KnowledgeSnippet,
  currentPath: string | null,
) {
  const haystack = `${snippet.title} ${snippet.body}`.toLowerCase();
  const termScore = queryTerms.reduce(
    (score, term) => score + (haystack.includes(term) ? 1 : 0),
    0,
  );
  const snippetPath = snippet.url?.split(/[?#]/, 1)[0];
  const routeScore =
    currentPath && snippetPath && currentPath === snippetPath ? 3 : 0;
  return termScore + routeScore;
}

function jsonText(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

async function websiteSnippets(locale: Locale): Promise<KnowledgeSnippet[]> {
  const [services, technologies, products, pricing, pages, articles] =
    await Promise.all([
      getPublishedServices(locale),
      getPublishedTechnologies(locale),
      getLiveProducts(locale),
      getPublishedPricing(locale),
      getPublishedPages(locale),
      getPublishedArticles(locale),
    ]);

  const serviceSnippets = services.map(({ content, ...service }) => ({
    title: content.h1,
    body: body(
      [
        content.shortDesc,
        content.whatItIs,
        `Suitable for: ${content.suitableFor.join("; ")}`,
        `Benefits: ${content.benefits.join("; ")}`,
        `Process: ${content.processSteps.join("; ")}`,
        `Safety: ${content.safety}`,
        `Before treatment: ${content.preCare}`,
        `After treatment: ${content.postCare}`,
        `Contraindications: ${content.contraindications.join("; ")}`,
        `Sessions: ${content.sessions}`,
        `Expected results: ${content.results}`,
        `FAQ: ${jsonText(content.faq)}`,
        `Duration: ${service.durationMin} minutes.`,
        service.priceFrom === null
          ? ""
          : `Price from: ${service.priceFrom} EUR.`,
      ].join(" "),
    ),
    url: service.publicPath
      ? canonicalInternalHref(service.publicPath)
      : `${PUBLIC_PATHS.booking}?service=${service.slug}`,
  }));

  const technologySnippets = technologies.map(({ content, ...technology }) => ({
    title: content.name,
    body: body(
      [content.specification, content.summary, content.body]
        .filter(Boolean)
        .join(" "),
    ),
    url: canonicalInternalHref(technology.publicPath),
  }));

  const productSnippets = products.map((product) => {
    const content = product.i18n[locale];
    return {
      title: content?.name ?? product.slug,
      body: body(
        `${content?.description ?? ""}${product.price === null ? "" : ` Price: ${product.price.toFixed(2)} EUR.`} Size: ${product.size ?? ""}`,
      ),
      url: productPath(product.slug),
    };
  });

  const pricingSnippets = pricing.map(({ content, ...item }) => ({
    title: content.label,
    body: body(
      `Published clinic price: ${Number(item.price).toFixed(2)} EUR${content.unit ? ` per ${content.unit}` : ""}.`,
    ),
    url: PUBLIC_PATHS.pricing,
  }));

  const pageSnippets = pages.map((page) => ({
    title: page.title,
    body: body(
      [page.hero, page.body, page.seoDescription].filter(Boolean).join(" "),
    ),
    url:
      page.slug === "home"
        ? PUBLIC_PATHS.home
        : canonicalInternalHref(`/${page.slug}`),
  }));

  const articleSnippets = articles.map(({ content, ...article }) => ({
    title: content.title,
    body: body([content.excerpt, content.body].filter(Boolean).join(" ")),
    url: articlePath(article.slug),
  }));

  return [
    {
      title: "Mone Beauty Clinic contact",
      body: `Address: ${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}, ${CONTACT.address.country}. Phone: ${CONTACT.phone}. Email: ${CONTACT.email}. Opening hours: by appointment.`,
      url: PUBLIC_PATHS.clinic,
    },
    ...serviceSnippets,
    ...technologySnippets,
    ...productSnippets,
    ...pricingSnippets,
    ...pageSnippets,
    ...articleSnippets,
  ];
}

export async function retrieveKnowledge(
  locale: Locale,
  query: string,
  currentPath?: string,
): Promise<KnowledgeResult> {
  const all = await websiteSnippets(locale);
  const queryTerms = terms(query);
  const contextPath = normalizedContextPath(currentPath);
  const ranked = all
    .map((snippet, index) => ({
      snippet,
      index,
      score: scoreSnippet(queryTerms, snippet, contextPath),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const matching = ranked.filter((item) => item.score > 0);
  const selected = matching.length > 0 ? matching : ranked;

  return {
    snippets: selected.slice(0, MAX_SNIPPETS).map((item) => item.snippet),
    matched: matching.length > 0,
  };
}

export async function detectBookingService(locale: Locale, message: string) {
  const text = cleanText(message).toLowerCase();
  const services = await getBookableServices(locale);
  return services.find((service) => {
    const title = service.content.h1.toLowerCase();
    return text.includes(service.slug.toLowerCase()) || text.includes(title);
  });
}
