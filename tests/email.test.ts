import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  renderCustomerAppointmentEmail,
  renderCustomerOrderEmail,
  renderAccountActionEmail,
  renderStaffAppointmentEmail,
  renderStaffOrderEmail,
  renderAppointmentLifecycleEmail,
  type AppointmentEmailData,
  type OrderEmailData,
} from "../lib/email";
import { appointmentManageUrl } from "../lib/email/messages";
import { sendEmail, sendSms } from "../lib/notifications";
import type { Locale } from "../i18n/routing";
import {
  CANCELLATION_POLICY,
  CANCELLATION_POLICY_ANCHOR,
  cancellationPolicyText,
} from "../content/cancellation-policy";

process.env.NEXT_PUBLIC_SITE_URL = "https://clinic.example";

const appointment: AppointmentEmailData = {
  id: "appointment-abcdefgh",
  start: new Date("2026-07-16T10:00:00.000Z"),
  end: new Date("2026-07-16T11:00:00.000Z"),
  client: {
    fullName: "Ada <script>alert('x')</script> & Co",
    email: "ada@example.com",
    phone: "+358 40 000 0000",
  },
  service: {
    slug: "facial",
    title: "Customer facial <care>",
    staffTitle: "Kasvohoito",
  },
  procedureIndex: 2,
  procedureTitle: "Approved procedure <care>",
  procedurePrice: "95 € / 60 minutes",
};

const order: OrderEmailData = {
  id: "order-12345678",
  email: "ada@example.com",
  phone: "+358 40 000 0000",
  total: 79,
  currency: "EUR",
  client: { fullName: "Ada <Admin>" },
  items: [
    {
      name: "Body <Slim> & Care",
      qty: 2,
      unitPrice: 39.5,
    },
  ],
};

const localeExpectations: Record<
  Locale,
  { booking: string; reminder24: string; reminder2: string; order: string }
> = {
  fi: {
    booking: "ajanvaraus vahvistettu",
    reminder24: "muistutus huomisesta ajasta",
    reminder2: "ajanvarausmuistutus",
    order: "maksuvahvistus",
  },
  en: {
    booking: "appointment confirmed",
    reminder24: "appointment reminder for tomorrow",
    reminder2: "appointment reminder",
    order: "payment confirmation",
  },
  ru: {
    booking: "запись подтверждена",
    reminder24: "напоминание о завтрашнем визите",
    reminder2: "напоминание о визите",
    order: "подтверждение оплаты",
  },
};

test("shared shell has an absolute logo, responsive 600px structure, contact footer, and text fallback", () => {
  const message = renderCustomerAppointmentEmail(
    appointment,
    "en",
    "confirmation",
  );

  assert.match(message.html, /<!doctype html>/i);
  assert.match(message.html, /width="600"/);
  assert.match(message.html, /max-width:620px/);
  assert.match(message.html, /https:\/\/clinic\.example\/logo\.svg/);
  assert.match(message.html, /alt="Mone Beauty Clinic"/);
  assert.match(message.html, /Solvikinkatu 5/);
  assert.match(message.html, /info@monebeauty\.fi/);
  assert.match(message.text, /Mone Beauty Clinic/);
  assert.match(message.text, /Solvikinkatu 5/);
  assert.match(message.text, /https:\/\/clinic\.example\/en\/ajanvaraus/);
});

test("account verification and password reset use the branded localized email shell", () => {
  const paths: Record<Locale, string> = {
    fi: "/oma-tili/vahvista",
    en: "/en/oma-tili/vahvista",
    ru: "/ru/oma-tili/vahvista",
  };
  for (const locale of ["fi", "en", "ru"] as const) {
    const href = `https://clinic.example${paths[locale]}?token=secret-token`;
    const verification = renderAccountActionEmail({
      locale,
      kind: "verification",
      href,
      name: "Ada <Client>",
    });
    const reset = renderAccountActionEmail({
      locale,
      kind: "password-reset",
      href: href.replace("vahvista", "palauta-salasana"),
      name: "Ada <Client>",
    });

    for (const message of [verification, reset]) {
      assert.match(message.html, /<!doctype html>/i);
      assert.match(message.html, /https:\/\/clinic\.example\/logo\.svg/);
      assert.match(message.html, /background:#97785A/);
      assert.match(message.html, /Solvikinkatu 5/);
      assert.match(message.html, /Ada &lt;Client&gt;/);
      assert.doesNotMatch(message.html, /Ada <Client>/);
      assert.match(message.text, /Ada <Client>/);
      assert.match(message.text, /secret-token/);
      assert.ok(message.html.length > message.text.length);
    }
  }
});

test("all customer appointment messages are localized and use Helsinki time", () => {
  for (const locale of ["fi", "en", "ru"] as const) {
    const expected = localeExpectations[locale];
    const messages = [
      {
        message: renderCustomerAppointmentEmail(
          appointment,
          locale,
          "confirmation",
        ),
        subject: expected.booking,
      },
      {
        message: renderCustomerAppointmentEmail(
          appointment,
          locale,
          "reminder_24h",
        ),
        subject: expected.reminder24,
      },
      {
        message: renderCustomerAppointmentEmail(
          appointment,
          locale,
          "reminder_2h",
        ),
        subject: expected.reminder2,
      },
    ];

    for (const { message, subject } of messages) {
      assert.match(message.subject, new RegExp(subject, "i"));
      assert.ok(message.text.length > 100);
      assert.ok(message.html.length > message.text.length);
      assert.match(message.text, /13[:.]00/);
      assert.match(message.text, /ABCDEFGH/);
      assert.match(message.text, /Approved procedure <care>/);
      assert.match(message.text, /95 €/);
    }
  }
});

test("booking confirmation reads as a confirmation and carries a signed manage link", () => {
  for (const locale of ["fi", "en", "ru"] as const) {
    const message = renderCustomerAppointmentEmail(
      appointment,
      locale,
      "confirmation",
    );
    const expectedPrefix = new RegExp(
      `^https://clinic\\.example${locale === "fi" ? "" : `/${locale}`}/ajanvaraus/hallinta\\?token=`,
    );
    assert.match(appointmentManageUrl(appointment.id, locale), expectedPrefix);
    // The token embeds a second-resolution expiry, so a URL minted here need not
    // be byte-identical to the one minted while rendering. Read the link out of
    // the message instead, and require the two bodies to agree on it.
    const manageUrl = message.text.match(
      /https:\/\/clinic\.example\S*\/ajanvaraus\/hallinta\?token=\S+/,
    )?.[0];
    assert.ok(manageUrl, `${locale} text is missing the manage link`);
    assert.match(manageUrl, expectedPrefix);
    assert.ok(
      message.html.includes(manageUrl),
      `${locale} html does not carry the same manage link as the text body`,
    );
    // The old copy framed the booking as a pending request; it is a real, held slot.
    assert.doesNotMatch(message.text, /pyyntö|request|запрос/i);
    assert.match(message.text, new RegExp(CANCELLATION_POLICY_ANCHOR));
    assert.ok(message.text.includes(cancellationPolicyText(locale)));
    assert.ok(message.html.includes(CANCELLATION_POLICY[locale].linkLabel));
    assert.doesNotMatch(
      message.text,
      /milloin tahansa|at any time|в любой момент/i,
    );
  }
});

test("guest booking confirmation offers the account-claim link instead of a second email", () => {
  const claimUrl =
    "https://clinic.example/en/oma-tili/lunasta-varaus?token=xyz";
  const withClaim = renderCustomerAppointmentEmail(
    { ...appointment, claimUrl },
    "en",
    "confirmation",
  );
  assert.ok(withClaim.html.includes(claimUrl));
  assert.match(withClaim.html, /Save this appointment to a client account/);

  const withoutClaim = renderCustomerAppointmentEmail(
    appointment,
    "en",
    "confirmation",
  );
  assert.doesNotMatch(withoutClaim.html, /Save this appointment/);
});

test("staff confirmation restates the details instead of confirming a second time", () => {
  const message = renderAppointmentLifecycleEmail(appointment, "en", "details");
  assert.match(message.subject, /Your appointment details/);
  assert.doesNotMatch(message.subject, /confirmed/i);
});

test("cancellation email drops the manage call to action", () => {
  const message = renderAppointmentLifecycleEmail(
    appointment,
    "en",
    "cancellation",
  );
  assert.doesNotMatch(message.html, /Cancel or reschedule/);
  assert.doesNotMatch(message.text, /Cancel or reschedule/);
});

test("confirmed booking email contains calendar, clinic, policy, payment, and management details", () => {
  const message = renderAppointmentLifecycleEmail(
    {
      ...appointment,
      practitioner: { name: "Ada Specialist" },
      manageUrl: "https://clinic.example/en/oma-tili?view=appointments",
    },
    "en",
    "confirmation",
  );
  assert.match(message.html, /Google Calendar/);
  assert.match(message.html, /Apple Calendar/);
  assert.match(message.html, /Outlook/);
  assert.match(message.html, /Solvikinkatu 5/);
  assert.match(message.html, /Pay at the clinic/);
  assert.match(message.html, /less than 24 hours/);
  assert.match(message.html, /same-day/);
  assert.match(message.html, /100%/);
  assert.match(message.html, /#peruutusehdot/);
  assert.match(message.html, /Cancel or reschedule/);
  assert.match(message.html, /Ada Specialist/);
  assert.equal(
    message.attachments?.[0]?.contentType,
    "text/calendar; charset=utf-8",
  );
});

test("customer and database values are escaped in HTML without damaging plain text", () => {
  const appointmentMessage = renderCustomerAppointmentEmail(
    appointment,
    "en",
    "confirmation",
  );
  const orderMessage = renderCustomerOrderEmail(order, "en");

  assert.doesNotMatch(appointmentMessage.html, /<script>/);
  assert.match(appointmentMessage.html, /&lt;script&gt;/);
  assert.match(appointmentMessage.html, /Approved procedure &lt;care&gt;/);
  assert.match(appointmentMessage.text, /Ada <script>/);
  assert.doesNotMatch(orderMessage.html, /Body <Slim>/);
  assert.match(orderMessage.html, /Body &lt;Slim&gt; &amp; Care/);
  assert.match(orderMessage.text, /Body <Slim> & Care/);
});

test("paid web orders are localized with itemized totals and localized links", () => {
  const expectedPaths: Record<Locale, string> = {
    fi: "/tilaus/order-12345678",
    en: "/en/tilaus/order-12345678",
    ru: "/ru/tilaus/order-12345678",
  };

  for (const locale of ["fi", "en", "ru"] as const) {
    const message = renderCustomerOrderEmail(order, locale);
    assert.match(
      message.subject,
      new RegExp(localeExpectations[locale].order, "i"),
    );
    assert.match(message.text, /2 × Body <Slim> & Care/);
    assert.match(message.text, /79/);
    assert.match(
      message.text,
      new RegExp(`https://clinic\\.example${expectedPaths[locale]}`),
    );
    assert.match(
      message.html,
      /appointments are still paid at the clinic|ajanvaraukset maksetaan edelleen klinikalla|записи на процедуры по-прежнему оплачиваются в клинике/i,
    );
  }
});

test("staff booking and order alerts stay Finnish and include contact details", () => {
  const booking = renderStaffAppointmentEmail(appointment);
  const staffOrder = renderStaffOrderEmail(order);

  assert.match(booking.subject, /Uusi ajanvaraus/);
  assert.match(booking.text, /Palvelu: Kasvohoito/);
  assert.match(booking.text, /Approved procedure <care>/);
  assert.match(booking.text, /Puhelin: \+358 40 000 0000/);
  assert.match(booking.text, /Sähköposti: ada@example\.com/);
  assert.doesNotMatch(booking.subject, /appointment request/i);

  assert.match(staffOrder.subject, /Uusi maksettu verkkotilaus/);
  assert.match(staffOrder.text, /Asiakas: Ada <Admin>/);
  assert.match(staffOrder.text, /Kokonaissumma/);
  assert.doesNotMatch(staffOrder.subject, /order request/i);
});

test("Resend receives both text and HTML payloads", async () => {
  const originalFetch = globalThis.fetch;
  const previous = {
    notifications: process.env.NOTIFICATIONS_ENABLED,
    resend: process.env.RESEND_API_KEY,
    emailApi: process.env.EMAIL_API_KEY,
    postmark: process.env.POSTMARK_SERVER_TOKEN,
  };
  let requestBody: Record<string, unknown> | undefined;
  process.env.NOTIFICATIONS_ENABLED = "true";
  process.env.RESEND_API_KEY = "resend-test-key";
  delete process.env.EMAIL_API_KEY;
  delete process.env.POSTMARK_SERVER_TOKEN;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(null, { status: 200 });
  };

  try {
    const result = await sendEmail({
      to: "customer@example.com",
      subject: "Subject",
      text: "Plain fallback",
      html: "<p>HTML body</p>",
    });
    assert.equal(result.status, "accepted");
    assert.equal(result.provider, "resend");
    assert.equal(requestBody?.text, "Plain fallback");
    assert.equal(requestBody?.html, "<p>HTML body</p>");
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NOTIFICATIONS_ENABLED", previous.notifications);
    restoreEnv("RESEND_API_KEY", previous.resend);
    restoreEnv("EMAIL_API_KEY", previous.emailApi);
    restoreEnv("POSTMARK_SERVER_TOKEN", previous.postmark);
  }
});

test("Postmark receives TextBody and HtmlBody while text-only calls remain compatible", async () => {
  const originalFetch = globalThis.fetch;
  const previous = {
    notifications: process.env.NOTIFICATIONS_ENABLED,
    resend: process.env.RESEND_API_KEY,
    emailApi: process.env.EMAIL_API_KEY,
    postmark: process.env.POSTMARK_SERVER_TOKEN,
  };
  const bodies: Array<Record<string, unknown>> = [];
  process.env.NOTIFICATIONS_ENABLED = "true";
  delete process.env.RESEND_API_KEY;
  delete process.env.EMAIL_API_KEY;
  process.env.POSTMARK_SERVER_TOKEN = "postmark-test-key";
  globalThis.fetch = async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(null, { status: 200 });
  };

  try {
    await sendEmail({
      to: ["one@example.com", "two@example.com"],
      subject: "Rich",
      text: "Plain fallback",
      html: "<p>HTML body</p>",
    });
    await sendEmail({
      to: "one@example.com",
      subject: "Text only",
      text: "Still supported",
    });
    assert.equal(bodies[0]?.TextBody, "Plain fallback");
    assert.equal(bodies[0]?.HtmlBody, "<p>HTML body</p>");
    assert.equal(bodies[0]?.To, "one@example.com,two@example.com");
    assert.equal(bodies[1]?.TextBody, "Still supported");
    assert.equal("HtmlBody" in bodies[1], false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv("NOTIFICATIONS_ENABLED", previous.notifications);
    restoreEnv("RESEND_API_KEY", previous.resend);
    restoreEnv("EMAIL_API_KEY", previous.emailApi);
    restoreEnv("POSTMARK_SERVER_TOKEN", previous.postmark);
  }
});

test("Sinch obtains an OAuth token and sends with bearer authentication", async () => {
  const originalFetch = globalThis.fetch;
  const names = [
    "NOTIFICATIONS_ENABLED",
    "SINCH_PROJECT_ID",
    "SINCH_APP_ID",
    "SINCH_ACCESS_KEY_ID",
    "SINCH_ACCESS_KEY_SECRET",
    "SINCH_REGION",
    "SINCH_SMS_SENDER",
  ] as const;
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );
  process.env.NOTIFICATIONS_ENABLED = "true";
  process.env.SINCH_PROJECT_ID = "project";
  process.env.SINCH_APP_ID = "app";
  process.env.SINCH_ACCESS_KEY_ID = "key";
  process.env.SINCH_ACCESS_KEY_SECRET = "secret";
  process.env.SINCH_REGION = "eu";
  process.env.SINCH_SMS_SENDER = "MoneBeauty";
  const requests: Array<{ url: string; authorization: string; body: string }> =
    [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    requests.push({
      url,
      authorization: String(new Headers(init?.headers).get("authorization")),
      body: String(init?.body ?? ""),
    });
    return url.includes("oauth2/token")
      ? new Response(
          JSON.stringify({ access_token: "oauth-token", expires_in: 3600 }),
        )
      : new Response(JSON.stringify({ message_id: "sinch-message-id" }));
  };

  try {
    const result = await sendSms({ to: "+358401234567", text: "Test message" });
    assert.equal(result.status, "accepted");
    assert.equal(result.provider, "sinch");
    assert.equal(result.providerMessageId, "sinch-message-id");
    assert.match(requests[0].authorization, /^Basic /);
    assert.match(requests[0].body, /grant_type=client_credentials/);
    assert.equal(requests[1].authorization, "Bearer oauth-token");
    assert.match(
      requests[1].url,
      /^https:\/\/eu\.conversation\.api\.sinch\.com/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    for (const name of names) restoreEnv(name, previous[name]);
  }
});

test("booking, checkout, migration, and reminders carry the persisted locale", () => {
  const bookingRoute = readFileSync("app/api/booking/route.ts", "utf8");
  const checkoutRoute = readFileSync("app/api/checkout/route.ts", "utf8");
  const reminderScript = readFileSync("scripts/send-reminders.ts", "utf8");
  const migration = readFileSync(
    "prisma/migrations/20260716190000_email_locales/migration.sql",
    "utf8",
  );

  assert.match(bookingRoute, /data:\s*{[\s\S]*?locale,[\s\S]*?start:/);
  assert.match(bookingRoute, /routing\.locales\.includes/);
  assert.match(checkoutRoute, /data:\s*{[\s\S]*?clientId:[\s\S]*?locale,/);
  assert.match(checkoutRoute, /routing\.locales\.includes/);
  assert.match(reminderScript, /appointment\.locale as Locale/);
  assert.match(migration, /"Appointment"[\s\S]*DEFAULT 'fi'/);
  assert.match(migration, /"Order"[\s\S]*DEFAULT 'fi'/);
});

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
