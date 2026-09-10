/**
 * Clinic-approved Endospheres copy and pricing.
 *
 * Source: the two repository-root client PDFs delivered 2026-07-30, which are
 * English only.
 *
 * Finnish and Russian are translations of that same approved English text,
 * promoted from `content/drafts/endospheres.{fi,ru}.md` on 2026-08-07 at the
 * client's request. They replace the shorter summaries previously shown in
 * those locales, so all three now describe the treatment in the same depth.
 *
 * PENDING_CLINIC_SIGNOFF: the translations are published and editable in the
 * admin, but the clinic has not yet countersigned the medical wording. Ask for
 * confirmation before treating the FI/RU text as approved.
 */
import type { Locale } from "../i18n/routing";

export const ENDOSPHERES_BOOKING_FAMILY = "endospheres";

export const ENDOSPHERES_SERVICES = [
  {
    key: "endospheres-intro-75",
    durationMin: 75,
    price: 99,
    offer: true,
    labels: {
      en: "Introductory Endospheres Therapy®: 75 min Full Body Protocol",
      fi: "Endospheres Therapy® -tutustumishoito: 75 min koko vartalon protokolla",
      ru: "Знакомство с Endospheres Therapy®: протокол для всего тела, 75 мин",
    },
  },
  {
    key: "endospheres-30",
    durationMin: 30,
    price: 65,
    offer: false,
    labels: {
      en: "Endospheres Therapy®: 30 min",
      fi: "Endospheres-terapia 30 min",
      ru: "Терапия Endospheres 30 мин",
    },
  },
  {
    key: "endospheres-45",
    durationMin: 45,
    price: 85,
    offer: false,
    labels: {
      en: "Endospheres Therapy®: 45 min",
      fi: "Endospheres-terapia 45 min",
      ru: "Терапия Endospheres 45 мин",
    },
  },
  {
    key: "endospheres-60",
    durationMin: 60,
    price: 105,
    offer: false,
    labels: {
      en: "Endospheres Therapy®: 60 min",
      fi: "Endospheres-terapia 60 min",
      ru: "Терапия Endospheres 60 мин",
    },
  },
  {
    key: "endospheres-75",
    durationMin: 75,
    price: 125,
    offer: false,
    labels: {
      en: "Endospheres Therapy®: 75 min Full Body Protocol",
      fi: "Endospheres-terapia koko vartalolle 75 min",
      ru: "Endospheres для всего тела 75 мин",
    },
  },
] as const;

export const ENDOSPHERES_PACKAGES = [
  { durationMin: 30, single: 65, six: 350, twelve: 650 },
  { durationMin: 45, single: 85, six: 450, twelve: 850 },
  { durationMin: 60, single: 105, six: 570, twelve: 1050 },
  { durationMin: 75, single: 125, six: 650, twelve: 1250 },
] as const;

export const ENDOSPHERES_EN = {
  eyebrow: "Italian Compressive Microvibration® technology",
  title: "ENDOSPHERES THERAPY®",
  heroCta: "Book Your First Treatment",
  sections: [
    {
      title: "What is Endospheres Therapy®?",
      paragraphs: [
        "Endospheres Therapy® is an innovative Italian technology based on Compressive Microvibration®, designed to improve lymphatic drainage, stimulate blood circulation, reduce fluid retention, and restore healthy tissue function.",
        "Unlike traditional massage techniques or treatments that focus only on the skin’s surface, Endospheres Therapy® works with the body’s natural physiological processes. Improved body contours and healthier-looking skin are the result of restoring proper circulation, lymphatic flow, and tissue metabolism.",
        "Today, Endospheres Therapy® is widely used in aesthetic medicine, sports rehabilitation, and wellness programs around the world.",
        "The primary goal of the treatment is not only to improve appearance but also to support the body’s natural ability to recover, regenerate, and maintain healthy tissue function.",
        "Many clients notice visible aesthetic improvements together with lighter legs, reduced swelling, improved circulation, and an overall feeling of wellbeing after the very first session.",
      ],
    },
    {
      title: "The History of Endospheres Therapy®",
      paragraphs: [
        "Developed in Italy by biomedical engineers and medical specialists, the patented Compressive Microvibration® technology provides a safe, non-invasive alternative to aggressive body contouring procedures. Today it is used in more than 60 countries in aesthetic medicine, physiotherapy, sports recovery and rehabilitation.",
      ],
    },
    {
      title: "How Does It Work?",
      paragraphs: [
        "The rotating silicone spheres generate rhythmic compressive microvibrations that stimulate lymphatic drainage, venous circulation, microcirculation, tissue oxygenation, cellular metabolism, reduce fluid retention and support regeneration—without tissue trauma or downtime.",
      ],
    },
    {
      title: "Why Does Every Treatment Begin with the Lymphatic System?",
      paragraphs: [
        "Every treatment follows the original manufacturer protocol, beginning with activation of the major lymphatic pathways before treating target areas. This approach maximizes both therapeutic and aesthetic results.",
      ],
    },
    {
      title: "Clinical Evidence",
      paragraphs: [
        "Clinical observations demonstrate improvements in circulation, oxygenation, skin elasticity, reduction of swelling and cellulite after a complete treatment course. The technology is non-invasive and can be combined with other treatments when recommended by a qualified specialist.",
      ],
    },
  ],
  benefits: [
    "Reduced swelling",
    "Lighter legs",
    "Improved lymphatic drainage",
    "Firmer skin",
    "Smoother body contours",
    "Reduced cellulite appearance",
    "Healthier skin quality",
    "Improved tissue elasticity",
    "Better circulation",
    "Faster muscle recovery",
  ],
  offer: {
    eyebrow: "Special Offer for New Clients",
    title: "Original Endospheres Therapy®",
    subtitle: "75-minute Full Body Protocol",
    details:
      "Complete original treatment protocol • Full-body lymphatic activation • Deep tissue stimulation • Comprehensive body treatment",
    price: "€99",
    regularPrice: "regular price €125",
    accountNote:
      "Create an account or sign in to use this introductory offer. Eligibility is confirmed when you book.",
  },
  packagesNote:
    "Manufacturer recommendation: 12-treatment course, minimum twice per week (or every other day).",
  durations: [
    {
      durationMin: 30,
      text: "One target area (abdomen, buttocks, thighs, back).",
    },
    { durationMin: 45, text: "Legs, buttocks and abdomen." },
    {
      durationMin: 60,
      text: "Legs, buttocks, abdomen and additional focus areas.",
    },
    {
      durationMin: 75,
      title: "75 min Full Body Protocol",
      text: "Complete original protocol including lymphatic activation, back, legs, buttocks and abdomen. Recommended for the best long-term clinical and aesthetic results.",
    },
  ],
} as const;

const ENDOSPHERES_LOCALIZED = {
  fi: {
    eyebrow: "Italialainen Compressive Microvibration® -teknologia",
    title: "Tutustu Endospheres Therapy® -hoitoon",
    sections: [
      {
        title: "Mitä Endospheres Therapy® on?",
        paragraphs: [
          "Endospheres Therapy® on innovatiivinen italialainen Compressive Microvibration® -teknologia, joka on suunniteltu parantamaan imunestekiertoa, stimuloimaan verenkiertoa, vähentämään nesteen kertymistä ja palauttamaan kudosten tervettä toimintaa.",
          "Toisin kuin perinteiset hierontatekniikat tai hoidot, jotka kohdistuvat vain ihon pintaan, Endospheres Therapy® toimii kehon luonnollisten fysiologisten prosessien kanssa. Vartalon muotojen paraneminen ja ihon terveempi ulkonäkö ovat seurausta asianmukaisen verenkierron, imunestevirtauksen ja kudosaineenvaihdunnan palautumisesta.",
          "Nykyään Endospheres Therapy® -hoitoa käytetään laajalti esteettisessä lääketieteessä, urheilukuntoutuksessa ja hyvinvointiohjelmissa kaikkialla maailmassa.",
          "Hoidon ensisijainen tavoite ei ole ainoastaan ulkonäön parantaminen, vaan myös kehon luonnollisen palautumis-, uusiutumis- ja terveiden kudostoimintojen ylläpitokyvyn tukeminen.",
          "Monet asiakkaat huomaavat näkyviä esteettisiä parannuksia sekä jalkojen keveyttä, turvotuksen vähenemistä, verenkierron paranemista ja yleistä hyvän olon tunnetta jo ensimmäisen hoitokerran jälkeen.",
        ],
      },
      {
        title: "Endospheres Therapy® -hoidon historia",
        paragraphs: [
          "Italiassa biolääketieteen insinöörien ja lääketieteen asiantuntijoiden kehittämä patentoitu Compressive Microvibration® -teknologia tarjoaa turvallisen ja ei-invasiivisen vaihtoehdon voimakkaille vartalonmuokkaustoimenpiteille. Nykyään sitä käytetään yli 60 maassa esteettisessä lääketieteessä, fysioterapiassa, urheilusta palautumisessa ja kuntoutuksessa.",
        ],
      },
      {
        title: "Miten se toimii?",
        paragraphs: [
          "Pyörivät silikonipallot tuottavat rytmisiä kompressiivisia mikrovärähtelyjä, jotka stimuloivat imunestekiertoa, laskimoverenkiertoa, mikroverenkiertoa, kudosten hapensaantia ja soluaineenvaihduntaa, vähentävät nesteen kertymistä ja tukevat uusiutumista: ilman kudosvaurioita tai toipumisaikaa.",
        ],
      },
      {
        title: "Miksi jokainen hoito aloitetaan imunestejärjestelmästä?",
        paragraphs: [
          "Jokainen hoito noudattaa valmistajan alkuperäistä protokollaa ja alkaa tärkeimpien imunestereittien aktivoinnilla ennen kohdealueiden käsittelyä. Tämä lähestymistapa maksimoi sekä terapeuttiset että esteettiset tulokset.",
        ],
      },
      {
        title: "Kliininen näyttö",
        paragraphs: [
          "Kliinisissä havainnoissa on todettu verenkierron, hapensaannin ja ihon kimmoisuuden paranemista sekä turvotuksen ja selluliitin vähenemistä kokonaisen hoitosarjan jälkeen. Teknologia on ei-invasiivinen, ja sitä voidaan yhdistää muihin hoitoihin pätevän asiantuntijan suosituksesta.",
        ],
      },
    ],
    benefits: [
      "Turvotuksen väheneminen",
      "Jalkojen keveys",
      "Imunestekierron paraneminen",
      "Kiinteämpi iho",
      "Tasaisemmat vartalon muodot",
      "Selluliitin näkyvyyden väheneminen",
      "Terveemmän näköinen iho",
      "Kudosten kimmoisuuden paraneminen",
      "Parempi verenkierto",
      "Nopeampi lihasten palautuminen",
    ],
  },
  ru: {
    eyebrow: "Итальянская технология Compressive Microvibration®",
    title: "Познакомьтесь с Endospheres Therapy®",
    sections: [
      {
        title: "Что такое Endospheres Therapy®?",
        paragraphs: [
          "Endospheres Therapy®: это инновационная итальянская технология на основе Compressive Microvibration®, разработанная для улучшения лимфодренажа, стимуляции кровообращения, уменьшения задержки жидкости и восстановления здорового функционирования тканей.",
          "В отличие от традиционных техник массажа и процедур, воздействующих только на поверхность кожи, Endospheres Therapy® работает с естественными физиологическими процессами организма. Улучшение контуров тела и более здоровый вид кожи являются результатом восстановления правильного кровообращения, лимфотока и тканевого обмена веществ.",
          "Сегодня Endospheres Therapy® широко применяется в эстетической медицине, спортивной реабилитации и оздоровительных программах по всему миру.",
          "Основная цель процедуры: не только улучшить внешний вид, но и поддержать естественную способность организма восстанавливаться, регенерировать и поддерживать здоровое функционирование тканей.",
          "Многие клиенты отмечают видимые эстетические улучшения, а также лёгкость в ногах, уменьшение отёчности, улучшение кровообращения и общее ощущение хорошего самочувствия уже после первого сеанса.",
        ],
      },
      {
        title: "История Endospheres Therapy®",
        paragraphs: [
          "Запатентованная технология Compressive Microvibration®, разработанная в Италии инженерами-биомедиками и медицинскими специалистами, предлагает безопасную и неинвазивную альтернативу агрессивным процедурам коррекции контуров тела. Сегодня она применяется более чем в 60 странах в эстетической медицине, физиотерапии, спортивном восстановлении и реабилитации.",
        ],
      },
      {
        title: "Как это работает?",
        paragraphs: [
          "Вращающиеся силиконовые сферы создают ритмичные компрессионные микровибрации, которые стимулируют лимфодренаж, венозное кровообращение, микроциркуляцию, насыщение тканей кислородом и клеточный метаболизм, уменьшают задержку жидкости и поддерживают регенерацию: без травмирования тканей и периода восстановления.",
        ],
      },
      {
        title: "Почему каждая процедура начинается с лимфатической системы?",
        paragraphs: [
          "Каждая процедура следует оригинальному протоколу производителя и начинается с активации основных лимфатических путей до обработки целевых зон. Такой подход максимизирует как терапевтические, так и эстетические результаты.",
        ],
      },
      {
        title: "Клинические данные",
        paragraphs: [
          "Клинические наблюдения демонстрируют улучшение кровообращения, оксигенации и эластичности кожи, а также уменьшение отёчности и целлюлита после полного курса процедур. Технология является неинвазивной и может сочетаться с другими процедурами по рекомендации квалифицированного специалиста.",
        ],
      },
    ],
    benefits: [
      "Уменьшение отёчности",
      "Лёгкость в ногах",
      "Улучшение лимфодренажа",
      "Более упругая кожа",
      "Более гладкие контуры тела",
      "Уменьшение видимости целлюлита",
      "Более здоровое качество кожи",
      "Улучшение эластичности тканей",
      "Улучшение кровообращения",
      "Более быстрое восстановление мышц",
    ],
  },
} as const;

/**
 * The PDF's "Which Treatment Duration Should I Choose?" guide, keyed by the
 * duration it describes, plus the manufacturer's course recommendation.
 *
 * These cards used to publish nothing but a name, a duration and a price, so
 * the Endospheres page showed a column of empty boxes: the same emptiness the
 * clinic pointed out on the body page. The wording is the clinic's own.
 */
export const ENDOSPHERES_DURATION_SUMMARIES: Record<
  number,
  Record<Locale, string>
> = {
  30: {
    en: "One target area (abdomen, buttocks, thighs, back).",
    fi: "Yksi kohdealue (vatsa, pakarat, reidet, selkä).",
    ru: "Одна целевая зона (живот, ягодицы, бёдра, спина).",
  },
  45: {
    en: "Legs, buttocks and abdomen.",
    fi: "Jalat, pakarat ja vatsa.",
    ru: "Ноги, ягодицы и живот.",
  },
  60: {
    en: "Legs, buttocks, abdomen and additional focus areas.",
    fi: "Jalat, pakarat, vatsa ja muut painopistealueet.",
    ru: "Ноги, ягодицы, живот и дополнительные целевые зоны.",
  },
  75: {
    en: "Complete original protocol including lymphatic activation, back, legs, buttocks and abdomen. Recommended for the best long-term clinical and aesthetic results.",
    fi: "Täydellinen alkuperäinen protokolla, johon sisältyvät imunesteaktivointi, selkä, jalat, pakarat ja vatsa. Suositellaan parhaiden pitkäaikaisten kliinisten ja esteettisten tulosten saavuttamiseksi.",
    ru: "Полный оригинальный протокол, включая лимфатическую активацию, спину, ноги, ягодицы и живот. Рекомендуется для достижения наилучших долгосрочных клинических и эстетических результатов.",
  },
};

export const ENDOSPHERES_PACKAGE_NOTE: Record<Locale, string> = {
  en: "Manufacturer recommendation: 12-treatment course, minimum twice per week (or every other day).",
  fi: "Valmistajan suositus: 12 hoitokerran sarja vähintään kaksi kertaa viikossa (tai joka toinen päivä).",
  ru: "Рекомендация производителя: курс из 12 процедур не реже двух раз в неделю (или через день).",
};

export const ENDOSPHERES_OFFER_SUMMARY: Record<Locale, string> = {
  en: "Complete original treatment protocol • Full-body lymphatic activation • Deep tissue stimulation • Comprehensive body treatment",
  fi: "Täydellinen alkuperäinen hoitoprotokolla • Koko vartalon imunesteaktivointi • Syväkudosstimulaatio • Kokonaisvaltainen vartalohoito",
  ru: "Полный оригинальный протокол процедуры • Лимфатическая активация всего тела • Глубокая стимуляция тканей • Комплексная процедура для тела",
};

export const ENDOSPHERES_EDITORIAL = {
  en: {
    eyebrow: ENDOSPHERES_EN.eyebrow,
    title: "Discover Endospheres Therapy®",
    sections: ENDOSPHERES_EN.sections,
    benefits: ENDOSPHERES_EN.benefits,
  },
  ...ENDOSPHERES_LOCALIZED,
} as const;

export const ENDOSPHERES_EDITORIAL_IMAGES = [
  {
    src: "/media/clinic/endospheres/endospheres-treatment.png",
    alt: {
      en: "Endospheres treatment at Mone Beauty Clinic",
      fi: "Endospheres-hoito Mone Beauty Clinicillä",
      ru: "Процедура Endospheres в Mone Beauty Clinic",
    },
  },
  {
    src: "/media/files/land/104/8c6f2e75d8051e304bca2fd6f22fa512.jpg",
    alt: {
      en: "Endospheres treatment handpiece in use",
      fi: "Endospheres-hoitokäsikappale käytössä",
      ru: "Манипула Endospheres во время процедуры",
    },
  },
  {
    src: "/media/files/land/99/e0e1d71833938c1a93b8b48246cfda7e.jpg",
    alt: {
      en: "Endospheres silicone sphere handpiece",
      fi: "Endospheres-käsikappaleen silikonipallot",
      ru: "Силиконовые сферы манипулы Endospheres",
    },
  },
] as const;

/**
 * Translation status, for the clinic's review queue.
 *
 * The Finnish and Russian copy above is published. It is a faithful
 * translation of the approved English PDF: no clinical claim was added,
 * removed or reworded: but the clinic has not yet countersigned the medical
 * wording in those languages.
 */
export const ENDOSPHERES_TRANSLATION_STATUS = {
  status: "PENDING_CLINIC_SIGNOFF",
  source: "Endospheres_Therapy_Website_Content_Mone_Beauty_Clinic.pdf",
  publishedOn: "2026-08-07",
  fi: { reviewNote: "Käännös julkaistu; odottaa klinikan vahvistusta." },
  ru: { reviewNote: "Перевод опубликован; ожидает подтверждения клиникой." },
} as const;

export function isEndospheresOffer(serviceKey: string) {
  return serviceKey === "endospheres-intro-75";
}
