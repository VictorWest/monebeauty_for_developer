import OpenAI from "openai";

const GEMINI_OPENAI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/openai/";

const apiKey = process.env.GEMINI_API_KEY?.trim() ?? "";
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

if (!apiKey) {
  console.error(
    JSON.stringify({
      check: "chat_provider",
      ok: false,
      model,
      errorClass: "MissingApiKey",
    }),
  );
  process.exit(1);
}

const client = new OpenAI({
  apiKey,
  baseURL: GEMINI_OPENAI_BASE_URL,
  maxRetries: 0,
  timeout: 30_000,
});

try {
  const response = await client.chat.completions.create({
    model,
    max_tokens: 16,
    messages: [
      {
        role: "system",
        content: "This is a provider health check. Reply only with OK.",
      },
      { role: "user", content: "OK" },
    ],
  });
  console.log(
    JSON.stringify({
      check: "chat_provider",
      ok: true,
      model: response.model,
      requestId: response.id ?? null,
    }),
  );
} catch (error) {
  const candidate =
    error && typeof error === "object"
      ? error
      : { constructor: { name: "UnknownError" } };
  console.error(
    JSON.stringify({
      check: "chat_provider",
      ok: false,
      model,
      status: typeof candidate.status === "number" ? candidate.status : null,
      errorClass: candidate.constructor?.name ?? "UnknownError",
      requestId:
        typeof candidate.requestID === "string" ? candidate.requestID : null,
    }),
  );
  process.exit(1);
}
