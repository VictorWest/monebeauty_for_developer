import type { KnowledgeSnippet } from "@/lib/chat-knowledge";

// Gemini API, reached through its OpenAI-compatible endpoint (see lib/ai.ts).
const DEFAULT_MODEL = "gemini-3.6-flash";
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_SOURCE_LINKS = 3;

export type ChatSource = {
  title: string;
  href: string;
};

export type ChatProviderConfig = {
  apiKey: string;
  configured: boolean;
  maxRetries: 1;
  model: string;
  timeoutMs: number;
};

function boundedTimeout(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.min(30_000, Math.max(1_000, Math.round(parsed)));
}

export function chatProviderConfig(
  env: Record<string, string | undefined> = process.env,
): ChatProviderConfig {
  const apiKey = env.GEMINI_API_KEY?.trim() ?? "";
  return {
    apiKey,
    configured: apiKey.length > 0,
    maxRetries: 1,
    model: env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    timeoutMs: boundedTimeout(env.GEMINI_TIMEOUT_MS),
  };
}

export function sourceLinks(
  snippets: KnowledgeSnippet[],
  limit = MAX_SOURCE_LINKS,
): ChatSource[] {
  const seen = new Set<string>();
  const links: ChatSource[] = [];
  for (const snippet of snippets) {
    const href = snippet.url?.trim();
    if (!href?.startsWith("/") || href.startsWith("//") || seen.has(href)) {
      continue;
    }
    seen.add(href);
    links.push({ title: snippet.title, href });
    if (links.length >= limit) break;
  }
  return links;
}
