CREATE TABLE "daily_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind_code" text NOT NULL,
	"date" date NOT NULL,
	"sign_code" text NOT NULL,
	"text" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_entries_kind_date_sign" UNIQUE("kind_code","date","sign_code")
);
--> statement-breakpoint
CREATE TABLE "daily_kinds" (
	"code" text PRIMARY KEY NOT NULL,
	"name_mn" text NOT NULL,
	"icon" text DEFAULT 'sun' NOT NULL,
	"tint" text DEFAULT 'tint-2' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_kinds_icon" CHECK (icon IN ('calendar', 'sparkles', 'heart', 'flame', 'coffee', 'blend', 'moon', 'sun', 'star', 'gem', 'baby', 'briefcase', 'leaf', 'users')),
	CONSTRAINT "daily_kinds_tint" CHECK (tint IN ('highlight', 'tint-1', 'tint-2', 'tint-3', 'dark', 'nav'))
);
--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_kind_code_daily_kinds_code_fk" FOREIGN KEY ("kind_code") REFERENCES "public"."daily_kinds"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_sign_code_zodiac_signs_code_fk" FOREIGN KEY ("sign_code") REFERENCES "public"."zodiac_signs"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "daily_entries" ADD CONSTRAINT "daily_entries_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_entries_date_idx" ON "daily_entries" USING btree ("date");--> statement-breakpoint
-- The three daily horoscopes the app starts with; admins add more on /admin/daily.
INSERT INTO "daily_kinds" ("code", "name_mn", "icon", "tint", "sort") VALUES
  ('general', 'Өнөөдрийн зурхай', 'sun', 'tint-2', 1),
  ('love', 'Өнөөдрийн хайрын зурхай', 'heart', 'tint-3', 2),
  ('work', 'Өнөөдрийн ажлын зурхай', 'briefcase', 'tint-1', 3)
ON CONFLICT ("code") DO NOTHING;
