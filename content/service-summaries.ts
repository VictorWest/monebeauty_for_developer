import type { Locale } from "../i18n/routing";

/**
 * Card/summary copy for each service, per locale.
 *
 * The service pages in `content/generated/*` are price lists: excerpting them
 * yields a mid-sentence dump of procedure names, durations and "Into a basket"
 * buttons. These summaries restate what each page actually offers: treatment
 * names, areas and formats taken verbatim from the scraped copy: so the
 * homepage cards, `/palvelut` and meta descriptions read as sentences. No
 * medical claims beyond what the clinic already publishes.
 */
export const SERVICE_SUMMARIES: Record<string, Record<Locale, string>> = {
  facial: {
    en: "Cosmetologist consultation, facial cleansing, peelings, fractional mesotherapy, biorevitalisation and Endospheres facial care.",
    fi: "Kosmetologin konsultaatio, kasvojen puhdistus, kuorinnat, fraktionaalinen mesoterapia, biorevitalisaatio ja Endospheres-hoito kasvoille.",
    ru: "Консультация косметолога, чистка лица, пилинги, фракционная мезотерапия, биоревитализация и эндосферотерапия для лица.",
  },
  body: {
    en: "Endospheres therapy for a single area or the whole body, anti-cellulite programmes, AROSHA body wraps and pressotherapy.",
    fi: "Endospheres Therapy yhdelle alueelle tai koko vartalolle, selluliittihoito-ohjelmat, AROSHA-vartalokääreet ja pressoterapia.",
    ru: "Эндосфера-терапия на одну зону или всё тело, антицеллюлитные программы, обертывания AROSHA и прессотерапия.",
  },
  endospheres: {
    en: "Compressive microvibration therapy on the ENDOSPHERES® AK Sensor device from Italy, delivered as a four-stage full-body protocol.",
    fi: "Kompressiivinen mikrovärähtelyhoito italialaisella ENDOSPHERES® AK Sensor -laitteella, neljän vaiheen protokollana koko vartalolle.",
    ru: "Компрессионная микровибрационная терапия на итальянском аппарате ENDOSPHERES® AK SENSOR: протокол из четырёх этапов для всего тела.",
  },
  laser: {
    en: "Laser hair removal for face and body: from upper lip and underarms to bikini line, full legs and full-body sessions.",
    fi: "Laserkarvanpoisto kasvoille ja vartalolle: ylähuulesta ja kainaloista bikinilinjaan, jalkoihin ja koko kehoon.",
    ru: "Лазерная эпиляция лица и тела: от верхней губы и подмышек до линии бикини, ног целиком и всего тела.",
  },
  rf: {
    en: "Microneedle RF lifting for the full face or single zones: forehead, eye area, neck, décolleté, abdomen, thighs and buttocks.",
    fi: "Mikroneulan RF-nosto koko kasvoille tai yksittäisille alueille: otsa, silmänympärysalue, kaula, dekoltee, vatsa, reidet ja pakarat.",
    ru: "Микроигольчатый RF-лифтинг всего лица или отдельных зон: лоб, вокруг глаз, шея, декольте, живот, бёдра и ягодицы.",
  },
  trichology: {
    en: "Computerised scalp and hair analysis, LED scalp therapy, scalp peeling, scalp mesotherapy and hair fillers.",
    fi: "Päänahan ja hiusten tietokoneellinen analyysi, LED-valohoito, päänahan kuorinta ja mesoterapia sekä hiusten filler-hoito.",
    ru: "Компьютерная диагностика кожи головы и волос, LED-терапия, пилинг, мезотерапия кожи головы и филлеры для волос.",
  },
  brows: {
    en: "Lash and brow lamination with VELVET, brow shaping and tinting, and lash tinting.",
    fi: "Ripsien ja kulmakarvojen laminointi VELVET-tuotteilla, kulmakarvojen muotoilu ja värjäys sekä ripsien värjäys.",
    ru: "Ламинирование ресниц и бровей средствами VELVET, моделирование и окрашивание бровей, окрашивание ресниц.",
  },
  injectable: {
    en: "Physician-led injectable treatments, planned individually. Every appointment starts with an in-person assessment before anything is agreed.",
    fi: "Lääkärijohtoiset injektiohoidot suunnitellaan yksilöllisesti. Jokainen käynti alkaa henkilökohtaisella arviolla ennen kuin mitään sovitaan.",
    ru: "Инъекционные процедуры под руководством врача, планируются индивидуально. Каждый приём начинается с очной оценки специалиста.",
  },
  consultation: {
    en: "A 30-minute one-to-one appointment: you describe what you want to change, a specialist assesses it in person and you agree the next step.",
    fi: "30 minuutin henkilökohtainen vastaanotto: kerrot mitä haluaisit muuttaa, asiantuntija arvioi tilanteen paikan päällä ja sovitte jatkosta.",
    ru: "Индивидуальный приём на 30 минут: вы рассказываете, что хотите изменить, специалист оценивает это очно, и вы намечаете следующий шаг.",
  },
  packages: {
    en: "Multi-session courses: the “Reset” programme, Endospheres packages of 6 or 12 sessions, AROSHA wrap packages and laser hair removal courses.",
    fi: "Hoitosarjat: ”Uudistuminen”-paketti, Endospheres-hoitopaketit 6 tai 12 kerran sarjoina, AROSHA-vartalokäärepaketit ja laserkarvanpoiston sarjat.",
    ru: "Курсы процедур: программа «Перезагрузка», пакеты Endospheres на 6 или 12 процедур, пакеты обертываний AROSHA и курсы лазерной эпиляции.",
  },
};
