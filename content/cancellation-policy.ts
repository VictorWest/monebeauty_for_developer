import type { Locale } from "@/i18n/routing";

export const CANCELLATION_POLICY_ANCHOR = "peruutusehdot";

export type CancellationPolicyCopy = {
  title: string;
  deadline: string;
  lateChange: string;
  sameDayOrNoShow: string;
  linkLabel: string;
};

export const CANCELLATION_POLICY = {
  fi: {
    title: "Peruutusehdot",
    deadline:
      "Ajanvaraus on peruutettava tai siirrettävä viimeistään 24 tuntia ennen varattua aikaa.",
    lateChange:
      "Alle 24 tuntia ennen, mutta ennen varauspäivää tehdystä peruutuksesta tai siirrosta perimme 50 % palvelun hinnasta.",
    sameDayOrNoShow:
      "Samana päivänä peruutetusta tai siirretystä sekä peruuttamattomasta ajasta perimme 100 % palvelun hinnasta.",
    linkLabel: "Lue peruutusehdot",
  },
  en: {
    title: "Cancellation policy",
    deadline:
      "Appointments must be cancelled or rescheduled at least 24 hours before the booked time.",
    lateChange:
      "For cancellations or rescheduling made less than 24 hours in advance but before the appointment date, we charge 50% of the service price.",
    sameDayOrNoShow:
      "For same-day cancellations or rescheduling, and for no-shows, we charge 100% of the service price.",
    linkLabel: "Read the cancellation policy",
  },
  ru: {
    title: "Условия отмены",
    deadline:
      "Запись необходимо отменить или перенести не позднее чем за 24 часа до назначенного времени.",
    lateChange:
      "При отмене или переносе менее чем за 24 часа, но до дня визита, взимается 50% стоимости услуги.",
    sameDayOrNoShow:
      "При отмене или переносе в день визита, а также при неявке, взимается 100% стоимости услуги.",
    linkLabel: "Прочитать условия отмены",
  },
} as const satisfies Record<Locale, CancellationPolicyCopy>;

export function cancellationPolicyText(locale: Locale): string {
  const policy = CANCELLATION_POLICY[locale];
  return [policy.deadline, policy.lateChange, policy.sameDayOrNoShow].join(" ");
}

export function cancellationPolicyMarkdown(locale: Locale): string {
  const policy = CANCELLATION_POLICY[locale];
  return [
    `## **${policy.title}**`,
    "",
    `- ${policy.deadline}`,
    "",
    `- ${policy.lateChange}`,
    "",
    `- ${policy.sameDayOrNoShow}`,
  ].join("\n");
}

const ABOUT_POLICY_BOUNDARIES: Record<Locale, { start: string; next: string }> =
  {
    fi: {
      start: "## **Peruutus- ja ajanmuutossäännöt**",
      next: "## **Tuotteiden palautussäännöt**",
    },
    en: {
      start: "## **Cancellation & Rescheduling Rules**",
      next: "## **Product Return Rules**",
    },
    ru: {
      start: "## **Отмена и перенос записи**",
      next: "## **Возврат товаров**",
    },
  };

/** Replaces only the known scraped clinic-rules section, preserving all other CMS copy. */
export function applyCancellationPolicyToAboutBody(
  body: string,
  locale: Locale,
): string {
  const { start, next } = ABOUT_POLICY_BOUNDARIES[locale];
  const startIndex = body.indexOf(start);
  const nextIndex = body.indexOf(next, startIndex + start.length);
  if (startIndex < 0 || nextIndex < 0) return body;
  return `${body.slice(0, startIndex)}${cancellationPolicyMarkdown(locale)}\n\n${body.slice(nextIndex)}`;
}
