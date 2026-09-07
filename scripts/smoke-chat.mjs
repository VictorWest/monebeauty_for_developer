const baseUrl = (
  process.env.CHAT_SMOKE_BASE_URL || "http://127.0.0.1:5000"
).replace(/\/$/, "");

function safeErrorClass(error) {
  const name = error?.constructor?.name;
  return typeof name === "string"
    ? name.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 80) || "UnknownError"
    : "UnknownError";
}

let response;
let connectionError;
for (let attempt = 1; attempt <= 6; attempt += 1) {
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale: "en",
        message: "What is Endospheres therapy?",
        consentGdpr: false,
      }),
      signal: AbortSignal.timeout(35_000),
    });
    break;
  } catch (error) {
    connectionError = error;
    if (attempt < 6) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
}

if (!response) {
  console.error(
    JSON.stringify({
      check: "chat_smoke",
      status: null,
      errorClass: safeErrorClass(connectionError),
    }),
  );
  process.exit(1);
}

let body = null;
try {
  body = await response.json();
} catch {
  // The diagnostic below intentionally does not print the response body.
}

const answerPresent =
  typeof body?.answer === "string" && body.answer.trim().length > 0;
const nativeAnswer = body?.kind === "answer";
if (!response.ok || !answerPresent || !nativeAnswer) {
  console.error(
    JSON.stringify({
      check: "chat_smoke",
      status: response.status,
      answerPresent,
      nativeAnswer,
    }),
  );
  process.exit(1);
}

console.log(
  JSON.stringify({
    check: "chat_smoke",
    status: response.status,
    answerPresent: true,
    nativeAnswer: true,
  }),
);
