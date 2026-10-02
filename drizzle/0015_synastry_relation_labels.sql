-- Period-pair relation sub-sections are renamed: "Тохиромжтой" → "Нийцтэй", "Анхаарах" → "Сорилттой".
UPDATE "product_fields" SET "name_mn" = 'Нийцтэй харилцаа'
WHERE "product_code" = 'synastry' AND "part_code" = 'period_pair' AND "code" = 'good_for' AND "name_mn" = 'Тохиромжтой харилцаа';--> statement-breakpoint
UPDATE "product_fields" SET "name_mn" = 'Сорилттой харилцаа'
WHERE "product_code" = 'synastry' AND "part_code" = 'period_pair' AND "code" = 'caution_for' AND "name_mn" = 'Анхаарах харилцаа';
