import { prisma } from "@/lib/db";
import { BRAND, CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import {
  renderAppointmentLifecycleEmail,
  renderCustomerAppointmentEmail,
  renderCustomerOrderEmail,
  renderCustomEmail,
  renderOrderLifecycleEmail,
  renderStaffAppointmentEmail,
  renderStaffOrderEmail,
  type AppointmentEmailData,
  type EmailMessage,
  type OrderEmailData,
} from "@/lib/email";
import {
  appointmentSms,
  orderSms,
  smsSegments,
  staffAppointmentSms,
  staffOrderSms,
} from "@/lib/sms";
import {
  runExternalApiAttempt,
  type ExternalApiContext,
} from "@/lib/external-api";
import { appointmentContact } from "@/lib/appointment-contact";

export type NotifyResult = {
  channel: "email" | "sms";
  status: "accepted" | "skipped" | "failed";
  provider?: string;
  providerMessageId?: string;
  detail?: string;
  externalApiAttemptId?: string;
};

type AppointmentNotification = AppointmentEmailData;
type OrderNotification = OrderEmailData;
type Parent =
  | { orderId: string; appointmentId?: never }
  | { appointmentId: string; orderId?: never }
  | { chatSessionId: string; orderId?: never; appointmentId?: never };

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function enabled() {
  return env("NOTIFICATIONS_ENABLED") !== "false";
}

function fromEmail() {
  return (
    env("NOTIFICATION_FROM_EMAIL") || `Mone Beauty Clinic <${CONTACT.email}>`
  );
}

function staffEmails() {
  return env("STAFF_NOTIFICATION_EMAILS")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function staffPhones() {
  return env("STAFF_NOTIFICATION_PHONES")
    .split(",")
    .map((phone) => phone.trim())
    .filter(Boolean);
}

class ProviderHttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public requestId?: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function postJson(
  provider: string,
  operation: string,
  url: string,
  headers: HeadersInit,
  body: unknown,
  context: ExternalApiContext,
) {
  const result = await runExternalApiAttempt({
    provider,
    operation,
    context,
    requestMetadata: {
      recipientCount: Array.isArray((body as { to?: unknown })?.to)
        ? (body as { to: unknown[] }).to.length
        : 1,
    },
    run: async () => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "monebeauty/1.0",
          ...headers,
        },
        body: JSON.stringify(body),
      });
      const raw = await res.text().catch(() => "");
      let data: Record<string, unknown> = {};
      try {
        data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        data = { responsePreview: raw.slice(0, 800) };
      }
      const requestId =
        res.headers.get("x-request-id") ??
        res.headers.get("request-id") ??
        undefined;
      if (!res.ok) {
        const error =
          data.error && typeof data.error === "object"
            ? (data.error as Record<string, unknown>)
            : data;
        throw new ProviderHttpError(
          res.status,
          String(error.message ?? raw ?? `HTTP ${res.status}`).slice(0, 1200),
          requestId,
          typeof error.name === "string"
            ? error.name
            : typeof error.code === "string"
              ? error.code
              : undefined,
        );
      }
      return { ...data, status: res.status, requestId } as Record<
        string,
        unknown
      > & { status: number; requestId?: string };
    },
    responseMetadata: (value) => ({
      status: value.status,
      requestId: value.requestId,
      id: value.id ?? value.MessageID,
    }),
  });
  return { response: result.value, attemptId: result.attemptId };
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  attachments,
  idempotencyKey,
  context = {},
}: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailMessage["attachments"];
  idempotencyKey?: string;
  context?: ExternalApiContext;
}): Promise<NotifyResult> {
  if (!enabled())
    return { channel: "email", status: "skipped", detail: "disabled" };
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length)
    return { channel: "email", status: "skipped", detail: "no_recipient" };
  const resendKey = env("RESEND_API_KEY") || env("EMAIL_API_KEY");
  const postmarkKey = env("POSTMARK_SERVER_TOKEN");
  try {
    if (resendKey) {
      const { response, attemptId } = await postJson(
        "resend",
        "email.send",
        "https://api.resend.com/emails",
        {
          Authorization: `Bearer ${resendKey}`,
          ...(idempotencyKey
            ? { "Idempotency-Key": idempotencyKey.slice(0, 256) }
            : {}),
        },
        {
          from: fromEmail(),
          to: recipients,
          subject,
          text,
          ...(html ? { html } : {}),
          ...(attachments?.length
            ? {
                attachments: attachments.map((item) => ({
                  filename: item.filename,
                  content: item.content,
                })),
              }
            : {}),
        },
        context,
      );
      return {
        channel: "email",
        status: "accepted",
        provider: "resend",
        providerMessageId:
          typeof response.id === "string" ? response.id : undefined,
        externalApiAttemptId: attemptId,
      };
    }
    if (postmarkKey) {
      const { response, attemptId } = await postJson(
        "postmark",
        "email.send",
        "https://api.postmarkapp.com/email",
        { "X-Postmark-Server-Token": postmarkKey },
        {
          From: fromEmail(),
          To: recipients.join(","),
          Subject: subject,
          TextBody: text,
          ...(html ? { HtmlBody: html } : {}),
          ...(attachments?.length
            ? {
                Attachments: attachments.map((item) => ({
                  Name: item.filename,
                  Content: item.content,
                  ContentType: item.contentType,
                })),
              }
            : {}),
        },
        context,
      );
      return {
        channel: "email",
        status: "accepted",
        provider: "postmark",
        providerMessageId:
          typeof response.MessageID === "string"
            ? response.MessageID
            : undefined,
        externalApiAttemptId: attemptId,
      };
    }
    return { channel: "email", status: "skipped", detail: "no_provider" };
  } catch (error) {
    return {
      channel: "email",
      status: "failed",
      detail: sanitizeError(error),
      externalApiAttemptId: externalAttemptId(error),
    };
  }
}

let sinchToken: { value: string; expiresAt: number } | null = null;

async function sinchAccessToken(
  force = false,
  context: ExternalApiContext = {},
) {
  if (!force && sinchToken && sinchToken.expiresAt > Date.now() + 60_000)
    return sinchToken.value;
  const id = env("SINCH_ACCESS_KEY_ID");
  const secret = env("SINCH_ACCESS_KEY_SECRET");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const logged = await runExternalApiAttempt({
    provider: "sinch",
    operation: "oauth.token",
    context,
    run: async () => {
      const res = await fetch("https://auth.sinch.com/oauth2/token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "monebeauty/1.0",
        },
        body: new URLSearchParams({ grant_type: "client_credentials" }),
      });
      const raw = await res.text();
      const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      if (!res.ok)
        throw new ProviderHttpError(
          res.status,
          String(data.error_description ?? data.error ?? raw).slice(0, 1200),
          res.headers.get("x-request-id") ?? undefined,
          typeof data.error === "string" ? data.error : undefined,
        );
      return { ...data, status: res.status } as Record<string, unknown> & {
        status: number;
      };
    },
    responseMetadata: (value) => ({
      status: value.status,
      expiresIn: value.expires_in,
    }),
  });
  const data = logged.value as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) throw new Error("sinch_missing_access_token");
  sinchToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, data.expires_in ?? 3600) * 1000,
  };
  return sinchToken.value;
}

async function sendSinch(
  recipient: string,
  text: string,
  context: ExternalApiContext,
  retry = true,
) {
  const projectId = env("SINCH_PROJECT_ID");
  const appId = env("SINCH_APP_ID");
  const region = env("SINCH_REGION").toLowerCase();
  const sender = env("SINCH_SMS_SENDER") || env("SMS_FROM");
  if (!sender) throw new Error("sinch_missing_sender");
  if (!["eu", "us", "br"].includes(region))
    throw new Error("sinch_invalid_region");
  const token = await sinchAccessToken(!retry, context);
  const url = `https://${region}.conversation.api.sinch.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  try {
    const logged = await runExternalApiAttempt({
      provider: "sinch",
      operation: "sms.send",
      context: { ...context, retryNumber: retry ? 0 : 1 },
      requestMetadata: { channel: "SMS" },
      run: async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "monebeauty/1.0",
          },
          body: JSON.stringify({
            app_id: appId,
            recipient: {
              identified_by: {
                channel_identities: [{ channel: "SMS", identity: recipient }],
              },
            },
            message: { text_message: { text } },
            channel_priority_order: ["SMS"],
            channel_properties: { SMS_SENDER: sender },
          }),
        });
        const raw = await res.text().catch(() => "");
        const data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        if (!res.ok)
          throw new ProviderHttpError(
            res.status,
            String((data.error as { message?: unknown })?.message ?? raw).slice(
              0,
              1200,
            ),
            res.headers.get("x-request-id") ?? undefined,
          );
        return { ...data, status: res.status } as Record<string, unknown> & {
          status: number;
        };
      },
      responseMetadata: (value) => ({
        status: value.status,
        id: value.message_id ?? value.accepted_message_id ?? value.id,
      }),
    });
    const data = logged.value;
    return {
      id: [data.message_id, data.accepted_message_id, data.id].find(
        (value) => typeof value === "string",
      ) as string | undefined,
      attemptId: logged.attemptId,
    };
  } catch (error) {
    if (error instanceof ProviderHttpError && error.status === 401 && retry) {
      sinchToken = null;
      return sendSinch(recipient, text, context, false);
    }
    throw error;
  }
}

export async function sendSms({
  to,
  text,
  context = {},
}: {
  to: string | string[];
  text: string;
  context?: ExternalApiContext;
}): Promise<NotifyResult> {
  if (!enabled())
    return { channel: "sms", status: "skipped", detail: "disabled" };
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  if (!recipients.length)
    return { channel: "sms", status: "skipped", detail: "no_recipient" };
  const message = smsSegments(text);
  if (message.segments > 3)
    return { channel: "sms", status: "failed", detail: "message_too_long" };
  const hasSinch =
    env("SINCH_PROJECT_ID") &&
    env("SINCH_APP_ID") &&
    env("SINCH_ACCESS_KEY_ID") &&
    env("SINCH_ACCESS_KEY_SECRET");
  const accountSid = env("TWILIO_ACCOUNT_SID");
  const authToken = env("TWILIO_AUTH_TOKEN") || env("SMS_API_KEY");
  const from = env("TWILIO_FROM") || env("SMS_FROM");
  const webhook = env("SMS_WEBHOOK_URL");
  try {
    if (hasSinch) {
      const sent = await Promise.all(
        recipients.map((recipient) =>
          sendSinch(recipient, message.text, context),
        ),
      );
      return {
        channel: "sms",
        status: "accepted",
        provider: "sinch",
        providerMessageId:
          sent
            .map((item) => item.id)
            .filter(Boolean)
            .join(",") || undefined,
        externalApiAttemptId: sent.at(-1)?.attemptId,
      };
    }
    if (accountSid && authToken && from) {
      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
      const ids: string[] = [];
      let externalApiAttemptId: string | undefined;
      for (const recipient of recipients) {
        const body = new URLSearchParams({
          From: from,
          To: recipient,
          Body: message.text,
        });
        const logged = await runExternalApiAttempt({
          provider: "twilio",
          operation: "sms.send",
          context,
          requestMetadata: { segments: message.segments },
          run: async () => {
            const res = await fetch(
              `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
              {
                method: "POST",
                headers: {
                  Authorization: `Basic ${auth}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body,
              },
            );
            const raw = await res.text();
            const data = raw
              ? (JSON.parse(raw) as {
                  sid?: string;
                  code?: string;
                  message?: string;
                })
              : {};
            if (!res.ok)
              throw new ProviderHttpError(
                res.status,
                data.message ?? raw.slice(0, 1200),
                res.headers.get("x-request-id") ?? undefined,
                data.code ? String(data.code) : undefined,
              );
            return { ...data, id: data.sid, status: res.status };
          },
          responseMetadata: (value) => ({
            id: value.sid,
            status: value.status,
          }),
        });
        externalApiAttemptId = logged.attemptId;
        const data = logged.value;
        if (data.sid) ids.push(data.sid);
      }
      return {
        channel: "sms",
        status: "accepted",
        provider: "twilio",
        providerMessageId: ids.join(",") || undefined,
        externalApiAttemptId,
      };
    }
    if (webhook) {
      const { response, attemptId } = await postJson(
        "sms_webhook",
        "sms.send",
        webhook,
        env("SMS_API_KEY")
          ? { Authorization: `Bearer ${env("SMS_API_KEY")}` }
          : {},
        { to: recipients, text: message.text },
        context,
      );
      return {
        channel: "sms",
        status: "accepted",
        provider: "webhook",
        providerMessageId:
          typeof response.id === "string" ? response.id : undefined,
        externalApiAttemptId: attemptId,
      };
    }
    return { channel: "sms", status: "skipped", detail: "no_provider" };
  } catch (error) {
    return {
      channel: "sms",
      status: "failed",
      detail: sanitizeError(error),
      externalApiAttemptId: externalAttemptId(error),
    };
  }
}

function externalAttemptId(error: unknown) {
  return error &&
    typeof error === "object" &&
    typeof (error as { externalApiAttemptId?: unknown })
      .externalApiAttemptId === "string"
    ? (error as { externalApiAttemptId: string }).externalApiAttemptId
    : undefined;
}

function sanitizeError(error: unknown) {
  return (error instanceof Error ? error.message : "unknown_error")
    .replace(/[\r\n]+/g, " ")
    .slice(0, 180);
}

async function latestAccepted(messageId: string) {
  return prisma.deliveryAttempt.findFirst({
    where: { messageId, status: "ACCEPTED" },
    orderBy: { attemptedAt: "desc" },
  });
}

async function persistDelivery({
  parent,
  kind,
  channel,
  locale,
  recipient,
  message,
  actor,
  dedupeKey,
}: {
  parent: Parent;
  kind: string;
  channel: "EMAIL" | "SMS";
  locale: Locale;
  recipient: string | string[];
  message: EmailMessage | { text: string };
  actor: string;
  dedupeKey?: string;
}) {
  const recipients = Array.isArray(recipient) ? recipient : [recipient];
  const stored = dedupeKey
    ? await prisma.outboundMessage.upsert({
        where: { dedupeKey },
        update: {},
        create: {
          ...parent,
          kind: kind as never,
          channel,
          locale,
          recipient: recipients.join(", "),
          subject: "subject" in message ? message.subject : null,
          body: "text" in message ? message.text : "",
          html: "html" in message ? message.html : null,
          actor,
          dedupeKey,
        },
      })
    : await prisma.outboundMessage.create({
        data: {
          ...parent,
          kind: kind as never,
          channel,
          locale,
          recipient: recipients.join(", "),
          subject: "subject" in message ? message.subject : null,
          body: "text" in message ? message.text : "",
          html: "html" in message ? message.html : null,
          actor,
        },
      });
  const accepted = await latestAccepted(stored.id);
  if (accepted)
    return {
      messageId: stored.id,
      channel: channel.toLowerCase() as "email" | "sms",
      status: "accepted" as const,
      provider: accepted.provider ?? undefined,
      providerMessageId: accepted.providerMessageId ?? undefined,
      detail: "already_accepted",
    };
  const result =
    channel === "EMAIL"
      ? await sendEmail({
          to: recipients,
          subject: stored.subject ?? BRAND.name,
          text: stored.body,
          html: stored.html ?? undefined,
          attachments:
            "attachments" in message ? message.attachments : undefined,
          idempotencyKey: dedupeKey ?? stored.id,
          context: { ...parent, messageId: stored.id },
        })
      : await sendSms({
          to: recipients,
          text: stored.body,
          context: { ...parent, messageId: stored.id },
        });
  await prisma.deliveryAttempt.create({
    data: {
      messageId: stored.id,
      status: result.status.toUpperCase() as never,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      errorDetail: result.detail,
      externalApiAttemptId: result.externalApiAttemptId,
    },
  });
  return { ...result, messageId: stored.id };
}

async function appointmentServiceTitle(slug: string, locale: Locale) {
  const content = await prisma.treatmentContent.findFirst({
    where: { locale, status: "PUBLISHED", service: { slug } },
    select: { h1: true },
  });
  return content?.h1 ?? slug;
}

function localizedAppointment(
  appointment: AppointmentNotification,
  title: string,
  staffTitle?: string,
) {
  return {
    ...appointment,
    client: appointmentContact(appointment),
    service: { ...appointment.service, title, staffTitle },
  };
}

export async function notifyAppointmentReceipt(
  appointment: AppointmentNotification,
  locale: Locale = "fi",
) {
  const [service, staffService] = await Promise.all([
    appointmentServiceTitle(appointment.service.slug, locale),
    appointmentServiceTitle(appointment.service.slug, "fi"),
  ]);
  const localized = localizedAppointment(appointment, service, staffService);
  const customer = renderCustomerAppointmentEmail(
    localized,
    locale,
    "confirmation",
  );
  const staff = renderStaffAppointmentEmail(localized);
  return Promise.all([
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: "APPOINTMENT_RECEIPT",
      channel: "EMAIL",
      locale,
      recipient: localized.client.email,
      message: customer,
      actor: "system",
      dedupeKey: `appointment:${appointment.id}:receipt:customer:email`,
    }),
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: "APPOINTMENT_RECEIPT",
      channel: "EMAIL",
      locale: "fi",
      recipient: staffEmails(),
      message: staff,
      actor: "system",
      dedupeKey: `appointment:${appointment.id}:receipt:staff:email`,
    }),
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: "APPOINTMENT_RECEIPT",
      channel: "SMS",
      locale: "fi",
      recipient: staffPhones(),
      message: { text: staffAppointmentSms(localized, staffService) },
      actor: "system",
      dedupeKey: `appointment:${appointment.id}:receipt:staff:sms`,
    }),
  ]);
}

export async function notifyAppointmentConfirmation(
  appointment: AppointmentNotification,
  locale: Locale = "fi",
  actor = "system",
) {
  const service = await appointmentServiceTitle(
    appointment.service.slug,
    locale,
  );
  const localized = localizedAppointment(appointment, service);
  // The booking receipt already told the client they are confirmed; this one, sent when staff
  // review the appointment in the internal calendar, restates the practical details instead.
  const email = renderAppointmentLifecycleEmail(localized, locale, "details");
  return Promise.all([
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: "APPOINTMENT_CONFIRMATION",
      channel: "EMAIL",
      locale,
      recipient: localized.client.email,
      message: email,
      actor,
      dedupeKey: `appointment:${appointment.id}:confirmation:email`,
    }),
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: "APPOINTMENT_CONFIRMATION",
      channel: "SMS",
      locale,
      recipient: localized.client.phone,
      message: {
        text: appointmentSms(localized, locale, "confirmation", service),
      },
      actor,
      dedupeKey: `appointment:${appointment.id}:confirmation:sms`,
    }),
  ]);
}

export async function notifyAppointmentChange(
  appointment: AppointmentNotification,
  kind: "rescheduled" | "cancellation",
  locale: Locale = "fi",
  reason?: string | null,
  actor = "system",
  eventKey?: string,
) {
  const service = await appointmentServiceTitle(
    appointment.service.slug,
    locale,
  );
  const localized = localizedAppointment(appointment, service);
  const email = renderAppointmentLifecycleEmail(
    localized,
    locale,
    kind,
    reason,
  );
  const key = eventKey
    ? `appointment:${appointment.id}:${kind}:${eventKey}`
    : kind === "rescheduled"
      ? `appointment:${appointment.id}:rescheduled:${appointment.start.toISOString()}`
      : `appointment:${appointment.id}:cancellation`;
  const results = await Promise.all([
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind:
        kind === "rescheduled"
          ? "APPOINTMENT_RESCHEDULED"
          : "APPOINTMENT_CANCELLATION",
      channel: "EMAIL",
      locale,
      recipient: localized.client.email,
      message: email,
      actor,
      dedupeKey: `${key}:email`,
    }),
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind:
        kind === "rescheduled"
          ? "APPOINTMENT_RESCHEDULED"
          : "APPOINTMENT_CANCELLATION",
      channel: "SMS",
      locale,
      recipient: localized.client.phone,
      message: {
        text: appointmentSms(localized, locale, kind, service, reason),
      },
      actor,
      dedupeKey: `${key}:sms`,
    }),
  ]);
  const staffKind = kind === "rescheduled" ? "rescheduled" : "cancelled";
  const staffSubject =
    kind === "rescheduled" ? "Ajanvaraus siirretty" : "Ajanvaraus peruttu";
  const staffBody = `${localized.client.fullName}\n${appointment.procedureTitle ?? service}\n${appointment.start.toISOString()}${reason ? `\n${reason}` : ""}`;
  results.push(
    await persistDelivery({
      parent: { appointmentId: appointment.id },
      kind:
        kind === "rescheduled"
          ? "APPOINTMENT_RESCHEDULED"
          : "APPOINTMENT_CANCELLATION",
      channel: "EMAIL",
      locale: "fi",
      recipient: staffEmails(),
      message: renderCustomEmail({
        locale: "fi",
        subject: staffSubject,
        bodyText: staffBody,
        reference: appointment.id.slice(-8).toUpperCase(),
      }),
      actor,
      dedupeKey: `${key}:staff:email`,
    }),
    await persistDelivery({
      parent: { appointmentId: appointment.id },
      kind:
        kind === "rescheduled"
          ? "APPOINTMENT_RESCHEDULED"
          : "APPOINTMENT_CANCELLATION",
      channel: "SMS",
      locale: "fi",
      recipient: staffPhones(),
      message: { text: staffAppointmentSms(localized, service, staffKind) },
      actor,
      dedupeKey: `${key}:staff:sms`,
    }),
  );
  return results;
}

export async function notifyAppointmentReminder(
  appointment: AppointmentNotification,
  kind: "reminder_24h" | "reminder_2h",
  locale: Locale = "fi",
) {
  const service = await appointmentServiceTitle(
    appointment.service.slug,
    locale,
  );
  const localized = localizedAppointment(appointment, service);
  const email = renderCustomerAppointmentEmail(localized, locale, kind);
  const messageKind =
    kind === "reminder_24h"
      ? "APPOINTMENT_REMINDER_24H"
      : "APPOINTMENT_REMINDER_2H";
  return Promise.all([
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: messageKind,
      channel: "EMAIL",
      locale,
      recipient: localized.client.email,
      message: email,
      actor: "system",
      dedupeKey: `appointment:${appointment.id}:${kind}:email`,
    }),
    persistDelivery({
      parent: { appointmentId: appointment.id },
      kind: messageKind,
      channel: "SMS",
      locale,
      recipient: localized.client.phone,
      message: { text: appointmentSms(localized, locale, kind, service) },
      actor: "system",
      dedupeKey: `appointment:${appointment.id}:${kind}:sms`,
    }),
  ]);
}

export async function notifyOrderReceipt(
  order: OrderNotification,
  locale: Locale = "fi",
) {
  const customer = renderCustomerOrderEmail(order, locale);
  const staff = renderStaffOrderEmail(order);
  return Promise.all([
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_RECEIPT",
      channel: "EMAIL",
      locale,
      recipient: order.email,
      message: customer,
      actor: "system",
      dedupeKey: `order:${order.id}:receipt:customer:email`,
    }),
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_RECEIPT",
      channel: "EMAIL",
      locale: "fi",
      recipient: staffEmails(),
      message: staff,
      actor: "system",
      dedupeKey: `order:${order.id}:receipt:staff:email`,
    }),
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_RECEIPT",
      channel: "SMS",
      locale: "fi",
      recipient: staffPhones(),
      message: { text: staffOrderSms(order, order.client?.fullName ?? "-") },
      actor: "system",
      dedupeKey: `order:${order.id}:receipt:staff:sms`,
    }),
  ]);
}

export async function notifyOrderConfirmation(
  order: OrderNotification,
  locale: Locale = "fi",
  actor = "system",
) {
  const email = renderOrderLifecycleEmail(order, locale, "confirmation");
  return Promise.all([
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_CONFIRMATION",
      channel: "EMAIL",
      locale,
      recipient: order.email,
      message: email,
      actor,
      dedupeKey: `order:${order.id}:confirmation:email`,
    }),
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_CONFIRMATION",
      channel: "SMS",
      locale,
      recipient: order.phone ?? "",
      message: { text: orderSms(order, locale, "confirmation") },
      actor,
      dedupeKey: `order:${order.id}:confirmation:sms`,
    }),
  ]);
}

export async function notifyOrderCancellation(
  order: OrderNotification,
  locale: Locale = "fi",
  reason: string,
  actor = "system",
) {
  const email = renderOrderLifecycleEmail(
    order,
    locale,
    "cancellation",
    reason,
  );
  return Promise.all([
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_CANCELLATION",
      channel: "EMAIL",
      locale,
      recipient: order.email,
      message: email,
      actor,
      dedupeKey: `order:${order.id}:cancellation:email`,
    }),
    persistDelivery({
      parent: { orderId: order.id },
      kind: "ORDER_CANCELLATION",
      channel: "SMS",
      locale,
      recipient: order.phone ?? "",
      message: { text: orderSms(order, locale, "cancellation", reason) },
      actor,
      dedupeKey: `order:${order.id}:cancellation:sms`,
    }),
  ]);
}

export async function notifyOrderCancellationRequest(
  order: Pick<OrderNotification, "id" | "email" | "phone">,
  locale: Locale,
  state: "requested" | "approved" | "rejected",
  detail: string,
  eventKey: string,
  actor = "system",
) {
  const copy = {
    fi: {
      requested:
        "Tilauksen peruutuspyyntö on vastaanotettu ja odottaa käsittelyä.",
      approved: "Tilauksen peruutuspyyntö on hyväksytty.",
      rejected: "Tilauksen peruutuspyyntö on hylätty.",
    },
    en: {
      requested:
        "Your order cancellation request was received and is awaiting review.",
      approved: "Your order cancellation request was approved.",
      rejected: "Your order cancellation request was rejected.",
    },
    ru: {
      requested: "Запрос на отмену заказа получен и ожидает рассмотрения.",
      approved: "Запрос на отмену заказа одобрен.",
      rejected: "Запрос на отмену заказа отклонён.",
    },
  }[locale][state];
  const reference = order.id.slice(-8).toUpperCase();
  const body = `${copy}\n\n${detail}\n\n${BRAND.name} · ${CONTACT.phone} · ${CONTACT.email}`;
  const kind =
    state === "requested"
      ? "ORDER_CANCELLATION_REQUESTED"
      : "ORDER_CANCELLATION_REQUEST_DECIDED";
  return Promise.all([
    persistDelivery({
      parent: { orderId: order.id },
      kind,
      channel: "EMAIL",
      locale,
      recipient: order.email,
      message: { subject: `${BRAND.name}: ${copy} ${reference}`, text: body },
      actor,
      dedupeKey: `order:${order.id}:cancellation-request:${eventKey}:email`,
    }),
    persistDelivery({
      parent: { orderId: order.id },
      kind,
      channel: "SMS",
      locale,
      recipient: order.phone ?? "",
      message: { text: `${BRAND.shortName}: ${copy} ${reference}.` },
      actor,
      dedupeKey: `order:${order.id}:cancellation-request:${eventKey}:sms`,
    }),
  ]);
}

export async function notifyOrderPaymentUpdate(
  order: OrderNotification,
  locale: Locale,
  kind:
    | "payment_failed"
    | "ready_for_pickup"
    | "shipped"
    | "fulfilled"
    | "refund"
    | "refund_failed",
  detail?: string,
  eventKey: string = kind,
  actor = "system",
) {
  const copy = {
    fi: {
      payment_failed:
        "Maksua ei voitu vahvistaa. Palaa kassalle ja yritä uudelleen.",
      ready_for_pickup:
        "Tilauksesi on valmis noudettavaksi Mone Beauty Cliniciltä.",
      shipped: "Tilauksesi on lähetetty toimitukseen.",
      fulfilled: "Tilauksesi on merkitty toimitetuksi.",
      refund: "Stripen hyvitys on vahvistettu.",
      refund_failed:
        "Stripen hyvitys epäonnistui. Klinikka tarkistaa tilanteen.",
    },
    en: {
      payment_failed:
        "Your payment could not be confirmed. Return to checkout and try again.",
      ready_for_pickup:
        "Your order is ready to collect from Mone Beauty Clinic.",
      shipped: "Your order has been dispatched.",
      fulfilled: "Your order has been marked fulfilled.",
      refund: "Your Stripe refund has been confirmed.",
      refund_failed: "Your Stripe refund failed. The clinic will review it.",
    },
    ru: {
      payment_failed:
        "Не удалось подтвердить оплату. Вернитесь к оформлению и попробуйте снова.",
      ready_for_pickup: "Ваш заказ готов к получению в Mone Beauty Clinic.",
      shipped: "Ваш заказ отправлен.",
      fulfilled: "Ваш заказ отмечен как выполненный.",
      refund: "Возврат через Stripe подтверждён.",
      refund_failed:
        "Возврат через Stripe не выполнен. Клиника проверит ситуацию.",
    },
  }[locale][kind];
  const reference = order.id.slice(-8).toUpperCase();
  const body = `${copy}${detail ? ` ${detail}` : ""}\n\n${BRAND.name} · ${CONTACT.phone} · ${CONTACT.email}`;
  const messageKind =
    kind === "payment_failed"
      ? "ORDER_PAYMENT_FAILED"
      : kind === "ready_for_pickup"
        ? "ORDER_READY_FOR_PICKUP"
        : kind === "shipped"
          ? "ORDER_SHIPPED"
          : kind === "fulfilled"
            ? "ORDER_FULFILLED"
            : kind === "refund"
              ? "ORDER_REFUND"
              : "ORDER_REFUND_FAILED";
  return Promise.all([
    persistDelivery({
      parent: { orderId: order.id },
      kind: messageKind,
      channel: "EMAIL",
      locale,
      recipient: order.email,
      message: {
        subject: `${BRAND.name}: ${copy} ${reference}`,
        text: body,
      },
      actor,
      dedupeKey: `order:${order.id}:${eventKey}:customer:email`,
    }),
    ...(kind === "payment_failed"
      ? []
      : [
          persistDelivery({
            parent: { orderId: order.id },
            kind: messageKind,
            channel: "SMS",
            locale,
            recipient: order.phone ?? "",
            message: { text: `${BRAND.shortName}: ${copy} ${reference}.` },
            actor,
            dedupeKey: `order:${order.id}:${eventKey}:customer:sms`,
          }),
        ]),
    ...(["refund", "refund_failed"].includes(kind)
      ? [
          persistDelivery({
            parent: { orderId: order.id },
            kind: messageKind,
            channel: "EMAIL",
            locale: "fi",
            recipient: staffEmails(),
            message: {
              subject: `${BRAND.name}: Stripe ${kind === "refund" ? "hyvitys" : "hyvitys epäonnistui"} ${reference}`,
              text: body,
            },
            actor,
            dedupeKey: `order:${order.id}:${eventKey}:staff:email`,
          }),
        ]
      : []),
  ]);
}

export async function sendCustomMessage({
  parent,
  channel,
  locale,
  recipient,
  subject,
  body,
  actor,
  reference,
}: {
  parent: Parent;
  channel: "EMAIL" | "SMS";
  locale: Locale;
  recipient: string;
  subject?: string;
  body: string;
  actor: string;
  reference: string;
}) {
  const message =
    channel === "EMAIL"
      ? renderCustomEmail({
          locale,
          subject: subject ?? BRAND.name,
          bodyText: body,
          reference,
        })
      : { text: body };
  return persistDelivery({
    parent,
    kind: "CUSTOM",
    channel,
    locale,
    recipient,
    message,
    actor,
  });
}

export async function retryOutboundMessage(id: string, actor: string) {
  const message = await prisma.outboundMessage.findUnique({
    where: { id },
    include: { attempts: true },
  });
  if (!message) throw new Error("message_not_found");
  if (message.attempts.some((attempt) => attempt.status === "ACCEPTED"))
    throw new Error("message_already_accepted");
  const result =
    message.channel === "EMAIL"
      ? await sendEmail({
          to: message.recipient
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          subject: message.subject ?? BRAND.name,
          text: message.body,
          html: message.html ?? undefined,
          idempotencyKey: message.dedupeKey ?? message.id,
          context: {
            orderId: message.orderId ?? undefined,
            appointmentId: message.appointmentId ?? undefined,
            messageId: message.id,
          },
        })
      : await sendSms({
          to: message.recipient
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          text: message.body,
          context: {
            orderId: message.orderId ?? undefined,
            appointmentId: message.appointmentId ?? undefined,
            messageId: message.id,
          },
        });
  await prisma.deliveryAttempt.create({
    data: {
      messageId: message.id,
      status: result.status.toUpperCase() as never,
      provider: result.provider,
      providerMessageId: result.providerMessageId,
      errorDetail: result.detail,
      externalApiAttemptId: result.externalApiAttemptId,
    },
  });
  const entity = message.orderId
    ? "Order"
    : message.appointmentId
      ? "Appointment"
      : "ChatSession";
  await prisma.auditLog.create({
    data: {
      actor,
      action: `communication_retry_${result.status}`,
      entity,
      entityId:
        message.orderId ??
        message.appointmentId ??
        message.chatSessionId ??
        message.id,
    },
  });
  return result;
}

// Backward-compatible name used by older callers during rolling deployment.
export const notifyLegacyOrderConfirmation = notifyOrderReceipt;
