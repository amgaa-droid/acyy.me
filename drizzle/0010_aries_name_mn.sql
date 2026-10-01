-- Aries is called "Хонь" everywhere (texts, UI, import files), not "Хуц".
UPDATE "zodiac_signs" SET "name_mn" = 'Хонь' WHERE "code" = 'aries' AND "name_mn" = 'Хуц';
