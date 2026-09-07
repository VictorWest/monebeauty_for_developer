import { BRAND, CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import { siteUrl } from "@/lib/seo";

export type EmailMessage = {
  subject: string;
  text: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
};

export type EmailDetail = {
  label: string;
  value: string;
};

export type EmailOrderItem = {
  name: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
};

type ShellCopy = {
  contact: string;
  hours: string;
  hoursValue: string;
  copyright: string;
};

const SHELL_COPY: Record<Locale, ShellCopy> = {
  fi: {
    contact: "Yhteystiedot",
    hours: "Aukiolo",
    hoursValue: "Sopimuksen mukaan",
    copyright: "Kaikki oikeudet pidätetään.",
  },
  en: {
    contact: "Contact",
    hours: "Opening hours",
    hoursValue: "By appointment",
    copyright: "All rights reserved.",
  },
  ru: {
    contact: "Контакты",
    hours: "Часы работы",
    hoursValue: "По предварительной записи",
    copyright: "Все права защищены.",
  },
};

export function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteAssetUrl(path: string): string {
  return new URL(path, `${siteUrl()}/`).toString();
}

export function renderDetailsTable(details: EmailDetail[]): string {
  const rows = details
    .map(
      ({ label, value }) => `
        <tr>
          <td class="detail-label" style="padding:10px 12px;border-bottom:1px solid #E7DECF;color:#8A7E70;font-size:13px;line-height:1.45;vertical-align:top;width:36%;">${escapeHtml(label)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #E7DECF;color:#3A322B;font-size:14px;font-weight:600;line-height:1.45;vertical-align:top;">${escapeHtml(value)}</td>
        </tr>`,
    )
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E7DECF;border-collapse:collapse;border-radius:4px;">${rows}</table>`;
}

export function renderOrderItemsTable({
  items,
  labels,
}: {
  items: EmailOrderItem[];
  labels: { item: string; unitPrice: string; total: string };
}): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:12px 10px;border-bottom:1px solid #E7DECF;color:#3A322B;font-size:14px;line-height:1.45;">${escapeHtml(item.quantity)} × ${escapeHtml(item.name)}</td>
          <td class="order-number" style="padding:12px 10px;border-bottom:1px solid #E7DECF;color:#6B6056;font-size:13px;line-height:1.45;text-align:right;white-space:nowrap;">${escapeHtml(item.unitPrice)}</td>
          <td class="order-number" style="padding:12px 10px;border-bottom:1px solid #E7DECF;color:#3A322B;font-size:14px;font-weight:600;line-height:1.45;text-align:right;white-space:nowrap;">${escapeHtml(item.lineTotal)}</td>
        </tr>`,
    )
    .join("");

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #E7DECF;border-collapse:collapse;">
      <thead>
        <tr style="background:#F5EFE4;">
          <th style="padding:10px;text-align:left;color:#6B6056;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(labels.item)}</th>
          <th class="order-number" style="padding:10px;text-align:right;color:#6B6056;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(labels.unitPrice)}</th>
          <th class="order-number" style="padding:10px;text-align:right;color:#6B6056;font-size:11px;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(labels.total)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

export function renderCta(label: string, href: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:28px 0 4px;">
      <tr>
        <td style="background:#97785A;border-radius:4px;text-align:center;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 22px;color:#FFFFFF;font-size:12px;font-weight:600;letter-spacing:.12em;line-height:1.2;text-decoration:none;text-transform:uppercase;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderNotice(text: string): string {
  return `<div style="margin:24px 0 0;padding:16px 18px;border-left:3px solid #97785A;background:#F5EFE4;color:#6B6056;font-size:13px;line-height:1.65;">${escapeHtml(text)}</div>`;
}

export function renderEmailShell({
  locale,
  preheader,
  heading,
  body,
}: {
  locale: Locale;
  preheader: string;
  heading: string;
  body: string;
}): string {
  const copy = SHELL_COPY[locale];
  const year = new Date().getUTCFullYear();
  const logoUrl = absoluteAssetUrl(BRAND.logo);
  const address = `${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}, ${CONTACT.address.country}`;

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="x-apple-disable-message-reformatting">
    <title>${escapeHtml(heading)}</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-container { width:100% !important; }
        .email-card { padding:28px 20px !important; }
        .email-header { padding:24px 20px !important; }
        .email-footer { padding:24px 20px !important; }
        .detail-label { width:42% !important; }
        .order-number { font-size:12px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#FBF8F3;color:#3A322B;font-family:Jost,'Helvetica Neue',Arial,sans-serif;-webkit-text-size-adjust:100%;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#FBF8F3;border-collapse:collapse;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" class="email-container" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;border-collapse:separate;">
            <tr>
              <td class="email-header" style="padding:28px 36px;background:#F5EFE4;border:1px solid #E7DECF;border-bottom:0;border-radius:16px 16px 0 0;text-align:center;">
                <a href="${escapeHtml(siteUrl())}" style="color:#3A322B;text-decoration:none;">
                  <img src="${escapeHtml(logoUrl)}" width="180" alt="${escapeHtml(BRAND.name)}" style="display:block;width:180px;max-width:100%;height:auto;margin:0 auto 8px;border:0;">
                  <span style="display:block;color:#3A322B;font-family:Georgia,'Times New Roman',serif;font-size:18px;font-weight:600;letter-spacing:.04em;line-height:1.2;">${escapeHtml(BRAND.name)}</span>
                </a>
              </td>
            </tr>
            <tr>
              <td class="email-card" style="padding:38px 42px;background:#FCFAF6;border:1px solid #E7DECF;border-bottom:0;">
                <h1 style="margin:0 0 22px;color:#3A322B;font-family:Georgia,'Times New Roman',serif;font-size:31px;font-weight:500;line-height:1.15;">${escapeHtml(heading)}</h1>
                ${body}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:28px 36px;background:#221E1B;border-radius:0 0 16px 16px;color:#CFC6BA;font-size:12px;line-height:1.7;">
                <div style="margin-bottom:10px;color:#857A6C;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;">${escapeHtml(copy.contact)}</div>
                <div>${escapeHtml(address)}</div>
                <div><a href="${escapeHtml(CONTACT.phoneHref)}" style="color:#CFC6BA;text-decoration:none;">${escapeHtml(CONTACT.phone)}</a> · <a href="${escapeHtml(CONTACT.emailHref)}" style="color:#CFC6BA;text-decoration:none;">${escapeHtml(CONTACT.email)}</a></div>
                <div>${escapeHtml(copy.hours)}: ${escapeHtml(copy.hoursValue)}</div>
                <div style="margin-top:18px;padding-top:16px;border-top:1px solid #38322C;color:#8A7F71;">© ${year} ${escapeHtml(BRAND.name)}. ${escapeHtml(copy.copyright)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function plainTextFooter(locale: Locale): string {
  const copy = SHELL_COPY[locale];
  const year = new Date().getUTCFullYear();
  const address = `${CONTACT.address.street}, ${CONTACT.address.postalCode} ${CONTACT.address.city}, ${CONTACT.address.country}`;
  return [
    BRAND.name,
    address,
    `${CONTACT.phone} · ${CONTACT.email}`,
    `${copy.hours}: ${copy.hoursValue}`,
    `© ${year} ${BRAND.name}. ${copy.copyright}`,
  ].join("\n");
}
