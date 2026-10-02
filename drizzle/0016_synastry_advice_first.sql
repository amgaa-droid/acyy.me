-- Synastry: the period-pair part becomes "Харилцааны зөвлөмж" and reads before the sign pairs.
UPDATE "product_parts" SET "name_mn" = 'Харилцааны зөвлөмж'
WHERE "product_code" = 'synastry' AND "code" = 'period_pair' AND "name_mn" = 'Төрсөн үеийн нийцэл';--> statement-breakpoint
UPDATE "product_parts" SET "sort" = 1 WHERE "product_code" = 'synastry' AND "code" = 'period_pair';--> statement-breakpoint
UPDATE "product_parts" SET "sort" = 2 WHERE "product_code" = 'synastry' AND "code" = 'sign_pair';
