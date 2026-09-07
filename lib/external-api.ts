import { prisma } from "@/lib/db";

export type ExternalApiContext = {
  appointmentId?: string;
  orderId?: string;
  messageId?: string;
  correlationId?: string;
  retryNumber?: number;
};

type AttemptInput = ExternalApiContext & {
  provider: string;
  operation: string;
  outcome: "SUCCESS" | "FAILURE";
  httpStatus?: number;
  providerRequestId?: string;
  providerMessageId?: string;
  durationMs?: number;
  requestMetadata?: unknown;
  responseMetadata?: unknown;
  error?: unknown;
};

const SECRET_KEY = /(authorization|token|secret|password|cookie|api[-_]?key|body|prompt|transcript|card|payment_method)/i;

function safeString(value: unknown, max = 500) {
  if (typeof value !== "string") return undefined;
  return value.replace(/[\r\n\t]+/g, " ").slice(0, max);
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[TRUNCATED]";
  if (value == null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return safeString(value, 800);
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !SECRET_KEY.test(key))
        .slice(0, 40)
        .map(([key, item]) => [key, redact(item, depth + 1)]),
    );
  }
  return String(value).slice(0, 200);
}

export function externalError(error: unknown) {
  const candidate = error && typeof error === "object"
    ? error as { constructor?: { name?: string }; name?: unknown; code?: unknown; message?: unknown; status?: unknown; requestID?: unknown; requestId?: unknown }
    : null;
  return {
    errorClass: safeString(candidate?.constructor?.name ?? candidate?.name, 100) ?? "UnknownError",
    errorCode: safeString(candidate?.code, 120),
    errorMessage: safeString(candidate?.message ?? String(error), 1200),
    httpStatus: typeof candidate?.status === "number" ? candidate.status : undefined,
    providerRequestId: safeString(candidate?.requestID ?? candidate?.requestId, 200),
  } as {
    errorClass: string;
    errorCode?: string;
    errorMessage?: string;
    httpStatus?: number;
    providerRequestId?: string;
  };
}

export async function recordExternalApiAttempt(input: AttemptInput): Promise<string | undefined> {
  const details: ReturnType<typeof externalError> = input.error
    ? externalError(input.error)
    : { errorClass: "" };
  const line = {
    type: "external_api_attempt",
    provider: input.provider,
    operation: input.operation,
    outcome: input.outcome,
    httpStatus: input.httpStatus ?? details.httpStatus,
    providerRequestId: input.providerRequestId ?? details.providerRequestId,
    providerMessageId: input.providerMessageId,
    durationMs: input.durationMs,
    correlationId: input.correlationId,
    errorClass: details.errorClass,
    errorCode: details.errorCode,
    errorMessage: details.errorMessage,
  };
  console[input.outcome === "FAILURE" ? "error" : "info"](JSON.stringify(line));
  try {
    const row = await prisma.externalApiAttempt.create({
      data: {
        provider: input.provider.slice(0, 80),
        operation: input.operation.slice(0, 120),
        outcome: input.outcome,
        httpStatus: input.httpStatus ?? details.httpStatus,
        providerRequestId: input.providerRequestId ?? details.providerRequestId,
        providerMessageId: input.providerMessageId,
        correlationId: input.correlationId,
        retryNumber: input.retryNumber ?? 0,
        durationMs: input.durationMs,
        requestMetadata: redact(input.requestMetadata) as never,
        responseMetadata: redact(input.responseMetadata) as never,
        errorClass: details.errorClass,
        errorCode: details.errorCode,
        errorMessage: details.errorMessage,
        appointmentId: input.appointmentId,
        orderId: input.orderId,
        messageId: input.messageId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return row.id;
  } catch (loggingError) {
    console.error(JSON.stringify({ type: "external_api_log_failure", provider: input.provider, operation: input.operation, error: externalError(loggingError) }));
    return undefined;
  }
}

export async function runExternalApiAttempt<T>({
  provider,
  operation,
  context = {},
  requestMetadata,
  run,
  responseMetadata,
}: {
  provider: string;
  operation: string;
  context?: ExternalApiContext;
  requestMetadata?: unknown;
  run: () => Promise<T>;
  responseMetadata?: (value: T) => unknown;
}): Promise<{ value: T; attemptId?: string }> {
  const started = Date.now();
  try {
    const value = await run();
    const candidate = value as { id?: unknown; request_id?: unknown; requestId?: unknown; status?: unknown };
    const attemptId = await recordExternalApiAttempt({
      ...context,
      provider,
      operation,
      outcome: "SUCCESS",
      durationMs: Date.now() - started,
      providerRequestId: safeString(candidate?.request_id ?? candidate?.requestId, 200),
      providerMessageId: safeString(candidate?.id, 200),
      httpStatus: typeof candidate?.status === "number" ? candidate.status : undefined,
      requestMetadata,
      responseMetadata: responseMetadata ? responseMetadata(value) : undefined,
    });
    return { value, attemptId };
  } catch (error) {
    const attemptId = await recordExternalApiAttempt({
      ...context,
      provider,
      operation,
      outcome: "FAILURE",
      durationMs: Date.now() - started,
      requestMetadata,
      error,
    });
    if (attemptId && error && typeof error === "object")
      Object.assign(error, { externalApiAttemptId: attemptId });
    throw error;
  }
}
