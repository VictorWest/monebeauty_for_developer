-- Replace only the known cancellation-policy section in database-owned clinic copy.
-- Other administrator-owned About page content remains byte-for-byte unchanged.

UPDATE "ContentPage"
SET "body" =
      left("body", position('## **Peruutus- ja ajanmuutossäännöt**' in "body") - 1) ||
      $policy$## **Peruutusehdot**

- Ajanvaraus on peruutettava tai siirrettävä viimeistään 24 tuntia ennen varattua aikaa.

- Alle 24 tuntia ennen, mutta ennen varauspäivää tehdystä peruutuksesta tai siirrosta perimme 50 % palvelun hinnasta.

- Samana päivänä peruutetusta tai siirretystä sekä peruuttamattomasta ajasta perimme 100 % palvelun hinnasta.

$policy$ ||
      substring("body" from position('## **Tuotteiden palautussäännöt**' in "body")),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'about'
  AND "locale" = 'fi'
  AND position('## **Peruutus- ja ajanmuutossäännöt**' in "body") > 0
  AND position('## **Tuotteiden palautussäännöt**' in "body") > 0;

UPDATE "ContentPage"
SET "body" =
      left("body", position('## **Cancellation & Rescheduling Rules**' in "body") - 1) ||
      $policy$## **Cancellation policy**

- Appointments must be cancelled or rescheduled at least 24 hours before the booked time.

- For cancellations or rescheduling made less than 24 hours in advance but before the appointment date, we charge 50% of the service price.

- For same-day cancellations or rescheduling, and for no-shows, we charge 100% of the service price.

$policy$ ||
      substring("body" from position('## **Product Return Rules**' in "body")),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'about'
  AND "locale" = 'en'
  AND position('## **Cancellation & Rescheduling Rules**' in "body") > 0
  AND position('## **Product Return Rules**' in "body") > 0;

UPDATE "ContentPage"
SET "body" =
      left("body", position('## **Отмена и перенос записи**' in "body") - 1) ||
      $policy$## **Условия отмены**

- Запись необходимо отменить или перенести не позднее чем за 24 часа до назначенного времени.

- При отмене или переносе менее чем за 24 часа, но до дня визита, взимается 50% стоимости услуги.

- При отмене или переносе в день визита, а также при неявке, взимается 100% стоимости услуги.

$policy$ ||
      substring("body" from position('## **Возврат товаров**' in "body")),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "slug" = 'about'
  AND "locale" = 'ru'
  AND position('## **Отмена и перенос записи**' in "body") > 0
  AND position('## **Возврат товаров**' in "body") > 0;
