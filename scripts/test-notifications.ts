import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function recipients(name: string) {
  return (process.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

async function main() {
  const emailRecipients = recipients("TEST_EMAIL_RECIPIENTS");
  const smsRecipients = recipients("TEST_SMS_RECIPIENTS");

  if (emailRecipients.length === 0 && smsRecipients.length === 0) {
    throw new Error(
      "Set TEST_EMAIL_RECIPIENTS and/or TEST_SMS_RECIPIENTS before running this command.",
    );
  }

  const { sendEmail, sendSms } = await import("../lib/notifications");
  const { renderDeliveryTestEmail } = await import("../lib/email");
  const sentAt = new Date();
  const testEmail = renderDeliveryTestEmail(sentAt);
  const results: Array<{
    recipient: string;
    channel: "email" | "sms";
    status: "accepted" | "skipped" | "failed";
    provider?: string;
    detail?: string;
  }> = [];

  for (const recipient of emailRecipients) {
    const result = await sendEmail({
      to: recipient,
      ...testEmail,
    });
    results.push({
      recipient,
      channel: result.channel,
      status: result.status,
      provider: result.status === "accepted" ? result.provider : undefined,
      detail: result.status === "accepted" ? undefined : result.detail,
    });
  }

  for (const recipient of smsRecipients) {
    const result = await sendSms({
      to: recipient,
      text: `Mone Beauty Clinic delivery test (${sentAt.toISOString()}). No action required.`,
    });
    results.push({
      recipient,
      channel: result.channel,
      status: result.status,
      provider: result.status === "accepted" ? result.provider : undefined,
      detail: result.status === "accepted" ? undefined : result.detail,
    });
  }

  console.log(
    JSON.stringify(
      { ok: results.every((result) => result.status === "accepted"), results },
      null,
      2,
    ),
  );

  if (results.some((result) => result.status !== "accepted")) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
