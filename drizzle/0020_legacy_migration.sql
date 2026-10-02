ALTER TABLE "persons" ADD COLUMN "legacy_key" text;--> statement-breakpoint
ALTER TABLE "purchases" ADD COLUMN "legacy_ref" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "legacy_user_id" integer;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "legacy_claimed_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "persons_owner_legacy_key" ON "persons" USING btree ("owner_user_id","legacy_key");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_legacyUserId_unique" UNIQUE("legacy_user_id");