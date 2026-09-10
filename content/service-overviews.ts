import type { Locale } from "../i18n/routing";

/**
 * Concise category introductions. Existing categories are distilled from the
 * matching 2026-06-30 scraped service page; Endospheres English follows the
 * clinic-approved July PDFs. Injectable and consultation retain only the
 * non-clinical framing allowed in content/authored-pages.ts.
 */
export const SERVICE_OVERVIEWS: Record<string, Record<Locale, string>> = {
  facial: {
    en: `Facial care begins with the skin in front of us. The selection includes a cosmetologist consultation and cleansing treatments, peelings, fractional mesotherapy, biorevitalisation and Endospheres facial care.

Each option has its own purpose, duration and course recommendation. Open a treatment to read the complete source description, then reserve that specific appointment directly.`,
    fi: `Kasvohoito alkaa ihon tämänhetkisestä tilanteesta. Valikoimaan kuuluvat kosmetologin konsultaatio ja ihonpuhdistukset, kuorinnat, fraktionaalinen mesoterapia, biorevitalisaatio sekä Endospheres-hoito kasvoille.

Jokaisella vaihtoehdolla on oma tarkoituksensa, kestonsa ja hoitosarjasuosituksensa. Avaa hoito lukeaksesi koko kuvauksen ja varaa sen jälkeen juuri kyseinen aika.`,
    ru: `Уход за лицом начинается с оценки текущего состояния кожи. В подборку входят консультация косметолога и чистки, пилинги, фракционная мезотерапия, биоревитализация и уход Endospheres для лица.

У каждого варианта свои назначение, продолжительность и рекомендации по курсу. Откройте процедуру, чтобы прочитать полное описание и записаться именно на неё.`,
  },
  body: {
    en: `Body treatments range from a single-area or full-body Endospheres protocol to anti-cellulite programmes, AROSHA wraps and pressotherapy. Published options identify the areas included and the time reserved for the visit.

Choose between individual treatments and combined programmes according to the source descriptions. Course options reserve the first visit online; the clinic arranges the remaining sessions with you.`,
    fi: `Vartalohoitoihin kuuluvat yhden alueen ja koko vartalon Endospheres-protokollat, selluliittihoito-ohjelmat, AROSHA-vartalokääreet ja pressoterapia. Jokaisessa vaihtoehdossa kerrotaan hoitoalueet ja käynnille varattu aika.

Voit valita yksittäisen hoidon tai yhdistelmäohjelman lähdekuvauksen perusteella. Hoitosarjasta varataan verkossa ensimmäinen käynti, ja klinikka sopii kanssasi loput hoitokerrat.`,
    ru: `В категории представлены процедуры Endospheres для одной зоны и всего тела, антицеллюлитные программы, обёртывания AROSHA и прессотерапия. Для каждого варианта указаны зоны и время, отведённое на визит.

Выберите отдельную процедуру или комбинированную программу по полному описанию. Для курса онлайн бронируется первое посещение, остальные сеансы согласуются с клиникой.`,
  },
  endospheres: {
    en: `Endospheres Therapy® is an Italian technology based on Compressive Microvibration®. Rotating silicone spheres create rhythmic compression intended to support lymphatic drainage, circulation and tissue function without downtime.

Treatments are offered in 30, 45, 60 and 75-minute protocols, alongside six- and twelve-session courses. Every appointment begins with activation of the major lymphatic pathways before the selected areas are treated.`,
    fi: `Endospheres Therapy perustuu kompressiiviseen mikrovärähtelyyn: pyörivien silikonipallojen liike kohdistaa kudokseen vuorottelevaa painetta. Vanhan sivun mukaan menetelmää käytetään lymfakierron, mikroverenkierron ja kudosten aineenvaihdunnan tukemiseen.

Hoitoja on tarjolla 30, 45, 60 ja 75 minuutin vaihtoehtoina sekä kuuden ja kahdentoista kerran sarjoina. Valitse aika hoidettavan alueen ja julkaistun protokollan mukaan.`,
    ru: `Endospheres Therapy основана на компрессионной микровибрации: вращающиеся силиконовые сферы создают чередующееся давление на ткани. На прежней странице метод описан как поддержка лимфотока, микроциркуляции и обменных процессов в тканях.

Доступны протоколы продолжительностью 30, 45, 60 и 75 минут, а также курсы из шести и двенадцати сеансов. Выберите время с учётом зоны и опубликованного протокола.`,
  },
  laser: {
    en: `Laser hair removal is available for individual facial and body areas as well as combined areas and full-body sessions. The published catalog covers options from the upper lip and chin to underarms, bikini areas, legs and larger combinations.

Treatment times and course recommendations vary by area. Read the complete localized description for the option you are considering before reserving that exact visit.`,
    fi: `Laserkarvanpoistoa on saatavana yksittäisille kasvojen ja vartalon alueille, alueyhdistelmille sekä koko keholle. Valikoima ulottuu ylähuulesta ja leuasta kainaloihin, bikinialueille, jalkoihin ja laajempiin yhdistelmiin.

Hoidon kesto ja hoitosarjasuositus vaihtelevat alueen mukaan. Lue harkitsemasi vaihtoehdon koko suomenkielinen kuvaus ennen juuri sen ajan varaamista.`,
    ru: `Лазерная эпиляция доступна для отдельных зон лица и тела, комбинаций зон и всего тела. В каталоге есть варианты от верхней губы и подбородка до подмышек, зоны бикини, ног и более крупных сочетаний.

Продолжительность и рекомендуемый курс зависят от зоны. Перед записью откройте выбранный вариант и прочитайте его полное описание на русском языке.`,
  },
  rf: {
    en: `Microneedle RF lifting combines microneedling with radiofrequency energy in the source treatment descriptions. Options cover the full face and individual areas including the forehead, eye area, neck, décolleté, abdomen, thighs and buttocks.

Each area has its own published duration, price and course guidance. Open the relevant option for the complete description, expected course and aftercare information before booking.`,
    fi: `Mikroneulan RF-nostossa yhdistyvät lähdekuvausten mukaan mikroneulaus ja radiofrekvenssienergia. Vaihtoehtoina ovat koko kasvot sekä yksittäiset alueet, kuten otsa, silmänympärys, kaula, dekoltee, vatsa, reidet ja pakarat.

Jokaisella alueella on oma julkaistu kestonsa, hintansa ja hoitosarjasuosituksensa. Avaa sopiva vaihtoehto ja lue koko kuvaus, hoitosarja sekä jälkihoito-ohjeet ennen varaamista.`,
    ru: `Согласно исходным описаниям, микроигольчатый RF-лифтинг сочетает микроигольчатое воздействие и радиочастотную энергию. Есть варианты для всего лица и отдельных зон: лба, области вокруг глаз, шеи, декольте, живота, бёдер и ягодиц.

Для каждой зоны опубликованы свои продолжительность, цена и рекомендации по курсу. Перед записью откройте нужный вариант и прочитайте полное описание и информацию об уходе.`,
  },
  trichology: {
    en: `Trichology services include computerised scalp and hair analysis, LED scalp therapy, peeling, scalp mesotherapy and hair fillers. The analysis uses a specialised camera and is offered as a starting point for individual care recommendations.

The treatment descriptions set out the purpose, visit length and any recommended series for each option. Select a service to review that information and book the matching appointment.`,
    fi: `Trikologiapalveluihin kuuluvat päänahan ja hiusten tietokoneellinen analyysi, LED-valohoito, kuorinta, päänahan mesoterapia ja hiusten filler-hoito. Erikoiskameralla tehtävä analyysi toimii lähtökohtana yksilöllisille hoitosuosituksille.

Kunkin vaihtoehdon kuvauksessa kerrotaan hoidon tarkoitus, käynnin kesto ja mahdollinen hoitosarjasuositus. Valitse palvelu, tutustu tietoihin ja varaa sitä vastaava aika.`,
    ru: `Трихологические услуги включают компьютерную диагностику кожи головы и волос, LED-терапию, пилинг, мезотерапию кожи головы и филлеры для волос. Диагностика специальной камерой служит отправной точкой для индивидуальных рекомендаций.

В описании каждого варианта указаны его назначение, длительность визита и рекомендуемый курс. Выберите услугу, ознакомьтесь с информацией и запишитесь на соответствующий приём.`,
  },
  brows: {
    en: `Lash and brow services include VELVET lamination, brow shaping and tinting, and lash tinting. The lamination descriptions explain the included care, published duration and intended finish for lashes or brows.

Shorter shaping and tinting appointments can also be booked separately. Open an option to compare its complete description, duration and price before choosing your time.`,
    fi: `Ripsi- ja kulmapalveluihin kuuluvat VELVET-laminointi, kulmakarvojen muotoilu ja värjäys sekä ripsien värjäys. Laminointikuvauksissa kerrotaan hoidon sisältö, julkaistu kesto ja tavoiteltu viimeistely ripsille tai kulmille.

Lyhyemmät muotoilu- ja värjäysajat voi varata myös erikseen. Avaa vaihtoehto vertaillaksesi koko kuvausta, kestoa ja hintaa ennen ajan valintaa.`,
    ru: `Услуги для ресниц и бровей включают ламинирование VELVET, моделирование и окрашивание бровей, а также окрашивание ресниц. В описаниях ламинирования указаны состав ухода, продолжительность и предполагаемый результат оформления.

Более короткие процедуры моделирования и окрашивания можно записать отдельно. Откройте вариант, чтобы сравнить полное описание, длительность и цену.`,
  },
  packages: {
    en: `Treatment courses bring published multi-session options into one catalog: the Reset programme, Endospheres courses, AROSHA wraps, fractional mesotherapy and laser hair removal packages. The card price is the complete source price for that course.

Online booking reserves only the first visit for the selected course. Its duration and required treatment resources are assigned by the clinic's scheduling configuration; remaining sessions are arranged directly with the clinic.`,
    fi: `Hoitosarjat kokoavat samaan valikoimaan julkaistut monen käynnin vaihtoehdot: Uudistuminen-ohjelman, Endospheres-sarjat, AROSHA-vartalokääreet, fraktionaalisen mesoterapian ja laserkarvanpoistopaketit. Kortin hinta on koko sarjan lähdehinta.

Verkossa varataan valitun hoitosarjan ensimmäinen käynti. Sen kesto ja tarvittavat hoitoresurssit määräytyvät klinikan ajanvarausasetuksista, ja loput käynnit sovitaan suoraan klinikan kanssa.`,
    ru: `В одном каталоге собраны опубликованные курсы: программа «Перезагрузка», курсы Endospheres, обёртывания AROSHA, фракционная мезотерапия и пакеты лазерной эпиляции. Цена на карточке относится ко всему курсу.

Онлайн бронируется только первое посещение выбранного курса. Его длительность и необходимые ресурсы задаются системой клиники, а остальные сеансы согласуются непосредственно с клиникой.`,
  },
  injectable: {
    en: `Injectable treatments are planned individually and begin with an in-person assessment. You describe what you would like to change, the specialist reviews the relevant history and area, and you discuss whether any next step is appropriate.

The clinic will publish named treatments, indications, contraindications, expected outcomes and prices only after clinical review. Until then, those details remain [CLINIC TO PROVIDE].`,
    fi: `Injektiohoidot suunnitellaan yksilöllisesti ja käynti alkaa henkilökohtaisella arviolla. Kerrot, mitä haluaisit muuttaa, asiantuntija käy läpi tarvittavat taustatiedot ja alueen, ja keskustelette siitä, onko jokin seuraava askel tarkoituksenmukainen.

Klinikka julkaisee nimetyt hoidot, käyttöaiheet, vasta-aiheet, odotettavat tulokset ja hinnat vasta kliinisen tarkastuksen jälkeen. Siihen asti tiedot säilyvät merkinnällä [CLINIC TO PROVIDE].`,
    ru: `Инъекционные процедуры планируются индивидуально и начинаются с очной оценки. Вы рассказываете, что хотели бы изменить, специалист изучает необходимые сведения и соответствующую область, после чего вы обсуждаете уместность дальнейших шагов.

Названия процедур, показания, противопоказания, ожидаемые результаты и цены будут опубликованы клиникой только после медицинской проверки. До этого они остаются с пометкой [CLINIC TO PROVIDE].`,
  },
  consultation: {
    en: `A medical consultation is a 30-minute one-to-one appointment at the Helsinki clinic. You explain what you would like to change, the specialist assesses the relevant area in person, and you discuss the available next steps together.

The consultation is a standalone visit and does not oblige you to book a treatment. If you decide to continue, the specialist explains the proposed timing and cost before anything is agreed.`,
    fi: `Lääketieteellinen konsultaatio on 30 minuutin henkilökohtainen vastaanotto Helsingin klinikalla. Kerrot, mitä haluaisit muuttaa, asiantuntija arvioi kyseisen alueen paikan päällä ja keskustelette mahdollisista jatkoaskelista.

Konsultaatio on itsenäinen käynti eikä velvoita varaamaan hoitoa. Jos päätät jatkaa, asiantuntija kertoo ehdotetun aikataulun ja kustannukset ennen kuin mistään sovitaan.`,
    ru: `Медицинская консультация: это индивидуальный 30-минутный приём в клинике в Хельсинки. Вы рассказываете, что хотели бы изменить, специалист очно оценивает соответствующую область, и вы вместе обсуждаете возможные дальнейшие шаги.

Консультация является самостоятельным визитом и не обязывает записываться на процедуру. Если вы решите продолжить, специалист заранее объяснит предполагаемые сроки и стоимость.`,
  },
};
