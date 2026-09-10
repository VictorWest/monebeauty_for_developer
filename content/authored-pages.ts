// Relative imports (not `@/` aliases): this module is also loaded by
// `scripts/sync-cms-from-generated.ts` under tsx, which does not resolve path aliases.
import type { Locale } from "../i18n/routing";
import type { PageContent } from "./pages";

/**
 * Hand-authored page copy: the counterpart to `content/generated/pages.json`.
 *
 * `scripts/gen-content.mjs` rebuilds `generated/pages.json` wholesale from its own `PAGES`
 * list, so anything written by hand in there disappears on the next regeneration. These two
 * SCOPE services have no `scraped_content/` source to generate from, so their copy lives here
 * instead and is merged in by `content/pages.ts` and `scripts/sync-cms-from-generated.ts`.
 *
 * Content rule for these pages (see the content-sourcing rule in CLAUDE.md / REQUIREMENTS.md):
 * the copy below describes process and logistics only: what an appointment is, how long it
 * takes, where it happens and what happens during it. Every clinical specific: the procedures
 * offered, what they are suitable for, indications, contraindications, medicines, outcomes and
 * prices: is left as `[CLINIC TO PROVIDE]` for the clinic to fill in and review. Do not
 * replace those markers with drafted text.
 */
export const AUTHORED_PAGES: Record<
  string,
  Partial<Record<Locale, PageContent>>
> = {
  "services/consultation": {
    en: {
      title: "Medical consultation in Helsinki",
      hero: null,
      body: `## What a consultation is

A consultation is a scheduled one-to-one appointment with a Mone Beauty Clinic specialist. You
describe what you would like to change, the specialist assesses your situation in person, and
together you agree what to do next.

It is a standalone appointment. You are under no obligation to book a treatment afterwards.

## What happens during the appointment

- We go through what you would like to achieve and what you have tried before.
- The specialist examines the relevant area in person.
- You talk through the options open to you, including doing nothing for now.
- You agree the next step together.

## What you leave with

- A clear picture of your options and what each one would involve.
- An estimate of cost and time for anything you decide to go ahead with.
- Answers to the questions you came in with.

## When a consultation is required first

Some treatments can only be planned after an in-person assessment: injectable aesthetic
medicine among them. If that applies to what you are interested in, the consultation is the
first step.

## Practical details

- **Duration:** 30 minutes.
- **Where:** Solvikinkatu 5, 00990 Helsinki.
- **Languages:** Finnish, English and Russian.
- **Booking:** online, or by phone on +358 40 129 3800.
- **Changes:** you can move or cancel your appointment from the link in your confirmation email.

Consultation fee: [CLINIC TO PROVIDE]

## Your information

What you tell us during a consultation is health data. It is handled as set out in our privacy
policy and is visible only to the staff involved in your care.`,
    },
    fi: {
      title: "Lääketieteellinen konsultaatio Helsingissä",
      hero: null,
      body: `## Mikä konsultaatio on

Konsultaatio on henkilökohtainen vastaanottoaika Mone Beauty Clinicin asiantuntijan kanssa.
Kerrot, mitä haluaisit muuttaa, asiantuntija arvioi tilanteesi paikan päällä, ja sovitte
yhdessä jatkosta.

Konsultaatio on itsenäinen käynti. Sinun ei tarvitse varata hoitoa sen jälkeen.

## Mitä vastaanotolla tapahtuu

- Käymme läpi, mitä haluaisit saavuttaa ja mitä olet aiemmin kokeillut.
- Asiantuntija tutkii kyseisen alueen paikan päällä.
- Käytte läpi vaihtoehdot, myös sen, ettei juuri nyt tehdä mitään.
- Sovitte seuraavan askeleen yhdessä.

## Mitä saat mukaasi

- Selkeän kuvan vaihtoehdoistasi ja siitä, mitä kukin niistä tarkoittaisi.
- Arvion kustannuksista ja ajankäytöstä, jos päätät edetä.
- Vastaukset kysymyksiin, joiden kanssa tulit.

## Milloin konsultaatio vaaditaan ensin

Osa hoidoista voidaan suunnitella vasta henkilökohtaisen arvion jälkeen: esteettiset
injektiohoidot niiden joukossa. Jos tämä koskee sinua kiinnostavaa hoitoa, konsultaatio on
ensimmäinen askel.

## Käytännön tiedot

- **Kesto:** 30 minuuttia.
- **Osoite:** Solvikinkatu 5, 00990 Helsinki.
- **Kielet:** suomi, englanti ja venäjä.
- **Ajanvaraus:** verkossa tai puhelimitse numerosta +358 40 129 3800.
- **Muutokset:** voit siirtää tai perua ajan vahvistusviestin linkistä.

Konsultaation hinta: [CLINIC TO PROVIDE]

## Tietosi

Konsultaatiossa kertomasi tiedot ovat terveystietoja. Niitä käsitellään tietosuojaselosteemme
mukaisesti, ja ne näkyvät vain hoitoosi osallistuvalle henkilökunnalle.`,
    },
    ru: {
      title: "Медицинская консультация в Хельсинки",
      hero: null,
      body: `## Что такое консультация

Консультация: это индивидуальный приём у специалиста Mone Beauty Clinic. Вы рассказываете,
что хотели бы изменить, специалист оценивает ситуацию очно, и вместе вы намечаете дальнейшие
шаги.

Это самостоятельный приём. Записываться на процедуру после него вы не обязаны.

## Как проходит приём

- Обсуждаем, чего вы хотели бы достичь и что уже пробовали раньше.
- Специалист осматривает интересующую вас зону очно.
- Разбираем доступные варианты, включая вариант ничего пока не делать.
- Вместе намечаем следующий шаг.

## С чем вы уходите

- С ясным пониманием вариантов и того, что каждый из них предполагает.
- С оценкой стоимости и времени, если вы решите продолжить.
- С ответами на вопросы, с которыми вы пришли.

## Когда консультация нужна в первую очередь

Часть процедур можно спланировать только после очной оценки: в том числе инъекционную
эстетическую медицину. Если это касается интересующей вас процедуры, консультация будет
первым шагом.

## Практическая информация

- **Длительность:** 30 минут.
- **Адрес:** Solvikinkatu 5, 00990 Helsinki.
- **Языки:** финский, английский и русский.
- **Запись:** онлайн или по телефону +358 40 129 3800.
- **Изменения:** перенести или отменить приём можно по ссылке из письма-подтверждения.

Стоимость консультации: [CLINIC TO PROVIDE]

## Ваши данные

То, что вы сообщаете на консультации, относится к данным о здоровье. Мы обрабатываем их в
соответствии с нашей политикой конфиденциальности, и они доступны только персоналу,
участвующему в вашем обслуживании.`,
    },
  },
  "services/injectable": {
    en: {
      title: "Injectable aesthetic medicine in Helsinki",
      hero: null,
      body: `## Assessment comes first

Injectable treatments are planned individually. Your first appointment begins with an in-person
assessment: a specialist goes through your history, examines the area concerned and explains
what is and is not possible. Treatment goes ahead only if it is appropriate and you agree to it.

Which treatments are offered and what each one is suitable for: [CLINIC TO PROVIDE]

## How the process works

1. **Assessment.** You describe what you would like to change and the specialist examines the
   area in person.
2. **Plan.** If treatment is appropriate, you agree a plan, the cost and the timing together.
3. **Consent.** You are told what the treatment involves and what to expect afterwards, and you
   give written consent before anything is carried out.
4. **Treatment.** Carried out at the clinic in the same visit or at a later appointment,
   depending on the plan.
5. **Follow-up.** You are told how to reach us afterwards and when to come back.

## What the specialist will ask you

To plan safely, the specialist needs a full picture before treatment. Expect questions about:

- your general health and any conditions you are treated for
- medicines and supplements you take
- allergies and previous reactions
- injectable or aesthetic treatments you have had before, and when
- whether you are pregnant or breastfeeding

Answer these as completely as you can. Full contraindications and safety criteria:
[CLINIC TO PROVIDE]

## Aftercare

Aftercare instructions and expected recovery: [CLINIC TO PROVIDE]

## Practical details

- **Appointment length:** 45 minutes.
- **Where:** Solvikinkatu 5, 00990 Helsinki.
- **Languages:** Finnish, English and Russian.
- **Booking:** online, or by phone on +358 40 129 3800.
- **Changes:** you can move or cancel your appointment from the link in your confirmation email.

Prices: [CLINIC TO PROVIDE]`,
    },
    fi: {
      title: "Esteettiset injektiohoidot Helsingissä",
      hero: null,
      body: `## Arvio ensin

Injektiohoidot suunnitellaan yksilöllisesti. Ensimmäinen käyntisi alkaa henkilökohtaisella
arviolla: asiantuntija käy läpi taustatietosi, tutkii kyseisen alueen ja kertoo, mikä on
mahdollista ja mikä ei. Hoito toteutetaan vain, jos se on tarkoituksenmukainen ja suostut
siihen.

Mitä hoitoja tarjotaan ja mihin kukin niistä soveltuu: [CLINIC TO PROVIDE]

## Miten hoitopolku etenee

1. **Arvio.** Kerrot, mitä haluaisit muuttaa, ja asiantuntija tutkii alueen paikan päällä.
2. **Suunnitelma.** Jos hoito on tarkoituksenmukainen, sovitte yhdessä suunnitelman,
   kustannukset ja aikataulun.
3. **Suostumus.** Sinulle kerrotaan, mitä hoito sisältää ja mitä sen jälkeen on odotettavissa,
   ja annat kirjallisen suostumuksen ennen toimenpidettä.
4. **Hoito.** Toteutetaan klinikalla joko samalla käynnillä tai myöhemmällä ajalla
   suunnitelman mukaan.
5. **Seuranta.** Saat ohjeet siitä, miten tavoitat meidät jälkikäteen ja milloin tulla
   uudelleen.

## Mitä asiantuntija kysyy sinulta

Turvallinen suunnittelu edellyttää kokonaiskuvaa ennen hoitoa. Varaudu kysymyksiin, jotka
koskevat seuraavia:

- yleinen terveydentilasi ja hoidossa olevat sairaudet
- käyttämäsi lääkkeet ja ravintolisät
- allergiat ja aiemmat reaktiot
- aiemmat injektio- tai kauneushoidot ja niiden ajankohdat
- mahdollinen raskaus tai imetys

Vastaa näihin mahdollisimman kattavasti. Täydelliset vasta-aiheet ja turvallisuuskriteerit:
[CLINIC TO PROVIDE]

## Jälkihoito

Jälkihoito-ohjeet ja odotettavissa oleva toipuminen: [CLINIC TO PROVIDE]

## Käytännön tiedot

- **Käynnin kesto:** 45 minuuttia.
- **Osoite:** Solvikinkatu 5, 00990 Helsinki.
- **Kielet:** suomi, englanti ja venäjä.
- **Ajanvaraus:** verkossa tai puhelimitse numerosta +358 40 129 3800.
- **Muutokset:** voit siirtää tai perua ajan vahvistusviestin linkistä.

Hinnat: [CLINIC TO PROVIDE]`,
    },
    ru: {
      title: "Инъекционная эстетическая медицина в Хельсинки",
      hero: null,
      body: `## Сначала: оценка

Инъекционные процедуры планируются индивидуально. Первый приём начинается с очной оценки:
специалист изучает вашу историю, осматривает интересующую зону и объясняет, что возможно, а
что нет. Процедура проводится только в том случае, если она уместна и вы на неё согласны.

Какие процедуры предлагаются и кому какая подходит: [CLINIC TO PROVIDE]

## Как устроен процесс

1. **Оценка.** Вы рассказываете, что хотели бы изменить, специалист осматривает зону очно.
2. **План.** Если процедура уместна, вы вместе согласуете план, стоимость и сроки.
3. **Согласие.** Вам объясняют, что включает процедура и чего ожидать после неё, и вы даёте
   письменное согласие до её проведения.
4. **Процедура.** Проводится в клинике: в тот же визит или на отдельном приёме, в
   зависимости от плана.
5. **Наблюдение.** Вам объясняют, как связаться с нами после процедуры и когда прийти снова.

## О чём спросит специалист

Для безопасного планирования специалисту нужна полная картина. Будьте готовы к вопросам о
следующем:

- общее состояние здоровья и заболевания, по которым вы наблюдаетесь
- принимаемые лекарства и добавки
- аллергии и прежние реакции
- ранее сделанные инъекционные и эстетические процедуры и их давность
- беременность или грудное вскармливание

Отвечайте на них как можно полнее. Полный перечень противопоказаний и критериев
безопасности: [CLINIC TO PROVIDE]

## Уход после процедуры

Рекомендации по уходу и ожидаемое восстановление: [CLINIC TO PROVIDE]

## Практическая информация

- **Длительность приёма:** 45 минут.
- **Адрес:** Solvikinkatu 5, 00990 Helsinki.
- **Языки:** финский, английский и русский.
- **Запись:** онлайн или по телефону +358 40 129 3800.
- **Изменения:** перенести или отменить приём можно по ссылке из письма-подтверждения.

Цены: [CLINIC TO PROVIDE]`,
    },
  },
};
