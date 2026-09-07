-- Canonical user-facing URLs use Finnish segments in every locale.
UPDATE "Service"
SET "publicPath" = CASE "slug"
  WHEN 'facial' THEN '/palvelut/kasvohoidot'
  WHEN 'body' THEN '/palvelut/vartalohoidot'
  WHEN 'endospheres' THEN '/palvelut/endospheres-terapia'
  WHEN 'laser' THEN '/palvelut/laserkarvanpoisto'
  WHEN 'rf' THEN '/palvelut/mikroneula-rf'
  WHEN 'trichology' THEN '/palvelut/trikologia'
  WHEN 'brows' THEN '/palvelut/kulmat-ja-ripset'
  WHEN 'packages' THEN '/palvelut/hoitopaketit'
  WHEN 'injectable' THEN '/palvelut/injektiohoidot'
  WHEN 'consultation' THEN '/palvelut/konsultaatio'
  ELSE "publicPath"
END
WHERE "slug" IN (
  'facial', 'body', 'endospheres', 'laser', 'rf', 'trichology', 'brows',
  'packages', 'injectable', 'consultation'
);

UPDATE "Technology"
SET "publicPath" = CASE "slug"
  WHEN 'endospheres' THEN '/laitehoidot/endospheres'
  WHEN 'laser' THEN '/laitehoidot/laserkarvanpoisto'
  WHEN 'rf' THEN '/laitehoidot/mikroneula-rf'
  WHEN 'trichology' THEN '/trikologia'
  ELSE "publicPath"
END
WHERE "slug" IN ('endospheres', 'laser', 'rf', 'trichology');
