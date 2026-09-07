-- Install the owner-approved first-registration consultation form only on an
-- otherwise unconfigured consultation form. Existing admin-authored questions
-- and wording are deliberately left untouched.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "ConsultationQuestion") THEN
    UPDATE "ConsultationForm"
    SET
      "requiredVersion" = GREATEST("requiredVersion", 2),
      "contentVersion" = GREATEST("contentVersion", 2),
      "accuracyVersion" = GREATEST("accuracyVersion", 2),
      "accuracyWording" = '{"fi":"Vahvistan lukeneeni pakolliset tiedot ja että antamani tiedot ovat parhaan tietoni mukaan oikeat ja ajantasaiset.","en":"I confirm that I have read the required information and that the information I provided is accurate and current to the best of my knowledge.","ru":"Я подтверждаю, что прочитал(а) обязательную информацию и что предоставленные мной сведения являются точными и актуальными, насколько мне известно."}'::jsonb,
      "requiredInformationVersion" = GREATEST("requiredInformationVersion", 2),
      "requiredInformationWording" = '{"fi":"Lue pakolliset tiedot huolellisesti ja vastaa kaikkiin kysymyksiin. Jos sinulla ei ole ilmoitettavaa, kirjoita ”Ei mitään”.","en":"Read the required information carefully and answer every question. If you have nothing to report, enter “None”.","ru":"Внимательно прочитайте обязательную информацию и ответьте на каждый вопрос. Если вам нечего сообщить, укажите «Нет»."}'::jsonb,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = 'current';

    INSERT INTO "ConsultationQuestion" (
      "id", "formId", "key", "type", "required", "active",
      "displayOrder", "version", "requiredSinceVersion", "createdAt", "updatedAt"
    ) VALUES
      ('consultation-default-allergies-reactions', 'current', 'allergies_reactions', 'LONG_TEXT', true, true, 10, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('consultation-default-relevant-health', 'current', 'relevant_health_information', 'LONG_TEXT', true, true, 20, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
      ('consultation-default-contraindications-other', 'current', 'contraindications_other', 'LONG_TEXT', true, true, 30, 1, 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

    INSERT INTO "ConsultationQuestionContent" ("id", "questionId", "locale", "prompt") VALUES
      ('consultation-default-allergies-reactions-fi', 'consultation-default-allergies-reactions', 'fi', 'Allergiat ja tunnetut reaktiot (kirjoita ”Ei mitään”, jos niitä ei ole).'),
      ('consultation-default-allergies-reactions-en', 'consultation-default-allergies-reactions', 'en', 'Allergies and known reactions (enter “None” if there are none).'),
      ('consultation-default-allergies-reactions-ru', 'consultation-default-allergies-reactions', 'ru', 'Аллергии и известные реакции (укажите «Нет», если их нет).'),
      ('consultation-default-relevant-health-fi', 'consultation-default-relevant-health', 'fi', 'Ajanvarauksen kannalta olennaiset terveystiedot (kirjoita ”Ei mitään”, jos niitä ei ole).'),
      ('consultation-default-relevant-health-en', 'consultation-default-relevant-health', 'en', 'Health information relevant to your appointment (enter “None” if there is none).'),
      ('consultation-default-relevant-health-ru', 'consultation-default-relevant-health', 'ru', 'Сведения о здоровье, имеющие значение для записи (укажите «Нет», если таких сведений нет).'),
      ('consultation-default-contraindications-other-fi', 'consultation-default-contraindications-other', 'fi', 'Tiedossasi olevat vasta-aiheet tai muut tärkeät tiedot (kirjoita ”Ei mitään”, jos niitä ei ole).'),
      ('consultation-default-contraindications-other-en', 'consultation-default-contraindications-other', 'en', 'Known contraindications or other important information (enter “None” if there is none).'),
      ('consultation-default-contraindications-other-ru', 'consultation-default-contraindications-other', 'ru', 'Известные противопоказания или другая важная информация (укажите «Нет», если такой информации нет).');
  END IF;
END $$;
