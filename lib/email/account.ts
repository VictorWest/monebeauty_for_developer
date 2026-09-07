import { CONTACT } from "@/content/site";
import type { Locale } from "@/i18n/routing";
import {
  escapeHtml,
  plainTextFooter,
  renderCta,
  renderEmailShell,
  renderNotice,
  type EmailMessage,
} from "./template";

type AccountEmailKind = "verification" | "password-reset";

const COPY = {
  fi: {
    greeting: (name: string) => `Hei ${name},`,
    verification: {
      subject: "Vahvista Mone Beauty -tilisi",
      preheader:
        "Vahvista sähköpostiosoitteesi viimeistelläksesi asiakastilisi.",
      heading: "Vahvista sähköpostiosoitteesi",
      intro:
        "Kiitos asiakastilin luomisesta. Vahvista sähköpostiosoitteesi jatkaaksesi.",
      action: "Vahvista sähköposti",
      notice:
        "Linkki on voimassa 24 tuntia. Jos et luonut tiliä, voit jättää tämän viestin huomiotta.",
    },
    "password-reset": {
      subject: "Palauta Mone Beauty -salasanasi",
      preheader: "Aseta uusi salasana Mone Beauty -asiakastilillesi.",
      heading: "Aseta uusi salasana",
      intro:
        "Saimme pyynnön vaihtaa asiakastilisi salasanan. Jatka turvallisesti alla olevasta painikkeesta.",
      action: "Aseta uusi salasana",
      notice:
        "Linkki on voimassa yhden tunnin. Jos et pyytänyt salasanan vaihtoa, voit jättää tämän viestin huomiotta.",
    },
    fallback: "Jos painike ei toimi, avaa tämä linkki selaimessasi:",
    questions: "Tarvitsetko apua?",
  },
  en: {
    greeting: (name: string) => `Hello ${name},`,
    verification: {
      subject: "Verify your Mone Beauty account",
      preheader: "Verify your email address to complete your client account.",
      heading: "Verify your email address",
      intro:
        "Thank you for creating a client account. Verify your email address to continue.",
      action: "Verify email",
      notice:
        "This link is valid for 24 hours. If you did not create this account, you can ignore this message.",
    },
    "password-reset": {
      subject: "Reset your Mone Beauty password",
      preheader: "Set a new password for your Mone Beauty client account.",
      heading: "Set a new password",
      intro:
        "We received a request to change your client-account password. Continue securely using the button below.",
      action: "Set new password",
      notice:
        "This link is valid for one hour. If you did not request a password change, you can ignore this message.",
    },
    fallback: "If the button does not work, open this link in your browser:",
    questions: "Need help?",
  },
  ru: {
    greeting: (name: string) => `Здравствуйте, ${name}!`,
    verification: {
      subject: "Подтвердите аккаунт Mone Beauty",
      preheader:
        "Подтвердите электронную почту, чтобы завершить создание аккаунта.",
      heading: "Подтвердите электронную почту",
      intro:
        "Спасибо за создание аккаунта клиента. Подтвердите электронную почту, чтобы продолжить.",
      action: "Подтвердить почту",
      notice:
        "Ссылка действительна 24 часа. Если вы не создавали аккаунт, просто проигнорируйте это письмо.",
    },
    "password-reset": {
      subject: "Сброс пароля Mone Beauty",
      preheader: "Установите новый пароль для аккаунта Mone Beauty.",
      heading: "Установите новый пароль",
      intro:
        "Мы получили запрос на смену пароля вашего аккаунта. Безопасно продолжите с помощью кнопки ниже.",
      action: "Установить новый пароль",
      notice:
        "Ссылка действительна один час. Если вы не запрашивали смену пароля, просто проигнорируйте это письмо.",
    },
    fallback: "Если кнопка не работает, откройте эту ссылку в браузере:",
    questions: "Нужна помощь?",
  },
} satisfies Record<Locale, unknown>;

function paragraph(value: string, muted = false): string {
  return `<p style="margin:0 0 22px;color:${muted ? "#6B6056" : "#3A322B"};font-size:15px;line-height:1.7;">${escapeHtml(value)}</p>`;
}

export function renderAccountActionEmail({
  locale,
  kind,
  href,
  name,
}: {
  locale: Locale;
  kind: AccountEmailKind;
  href: string;
  name?: string | null;
}): EmailMessage {
  const copy = COPY[locale];
  const message = copy[kind];
  const body = [
    ...(name ? [paragraph(copy.greeting(name))] : []),
    paragraph(message.intro, true),
    renderCta(message.action, href),
    renderNotice(message.notice),
    paragraph(`${copy.questions} ${CONTACT.email} · ${CONTACT.phone}`, true),
  ].join("");
  const text = [
    ...(name ? [copy.greeting(name)] : []),
    message.intro,
    "",
    `${message.action}: ${href}`,
    "",
    message.notice,
    "",
    `${copy.fallback}\n${href}`,
    "",
    `${copy.questions} ${CONTACT.email} / ${CONTACT.phone}`,
    "",
    plainTextFooter(locale),
  ].join("\n");

  return {
    subject: message.subject,
    text,
    html: renderEmailShell({
      locale,
      preheader: message.preheader,
      heading: message.heading,
      body,
    }),
  };
}
