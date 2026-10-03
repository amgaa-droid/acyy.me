CREATE TABLE "ai_knowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "faq_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "help_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"conversation_id" uuid NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"source" text NOT NULL,
	"faq_id" uuid,
	"provider" text,
	"model" text,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"cached_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"ms" integer,
	"feedback" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "help_chats_source" CHECK (source IN ('ai', 'faq')),
	CONSTRAINT "help_chats_feedback" CHECK ("help_chats"."feedback" IN (-1, 1))
);
--> statement-breakpoint
ALTER TABLE "ai_knowledge" ADD CONSTRAINT "ai_knowledge_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq_entries" ADD CONSTRAINT "faq_entries_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_chats" ADD CONSTRAINT "help_chats_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "help_chats" ADD CONSTRAINT "help_chats_faq_id_faq_entries_id_fk" FOREIGN KEY ("faq_id") REFERENCES "public"."faq_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faq_entries_sort_idx" ON "faq_entries" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "help_chats_user_idx" ON "help_chats" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "help_chats_conversation_idx" ON "help_chats" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "help_chats_created_idx" ON "help_chats" USING btree ("created_at");--> statement-breakpoint
INSERT INTO "faq_entries" ("question", "answer", "sort") VALUES
('Зурхайг хэрхэн худалдаж авах вэ?', 'Нүүрэнд хүн (гараг) дээр дараад хүссэн зурхайгаа сонгоно уу. Эсвэл «Цэс» → «Зурхай» → бүтээгдэхүүнээ сонгоод хүнээ сонгоно. Эхлээд үнэгүй хэсгийг урьдчилан харж, «Нээх» товчийг дарж баталгаажуулна. Үнэ нь хэтэвчнээс тань хасагдана.', 1),
('Хэтэвчээ хэрхэн цэнэглэх вэ?', 'Баруун дээд буланд байгаа үлдэгдлийн товч (+) эсвэл «Цэс» → «Хэтэвч» → «Цэнэглэх»-ийг дарна. Багцаа сонгоод «QPay-ээр төлөх»-ийг дарвал утсан дээр QPay эсвэл банкны апп нээгдэнэ, компьютер дээр QR кодыг утсаараа уншуулна. Их дүнгээр цэнэглэх тусам бонус нэмэгдэнэ.', 2),
('Төлбөр төлсөн ч үлдэгдэл нэмэгдээгүй. Яах вэ?', 'Ихэвчлэн хэдхэн секундэд орж ирдэг. Төлбөрийн дэлгэц дээрх «Төлсөн, шалгах» товчийг дарна уу. Систем төлбөрийг 24 цагийн турш автоматаар дахин шалгадаг тул дахин төлөх шаардлагагүй. «Хэтэвч»-ийн гүйлгээний түүхээс шалгаарай. 24 цагийн дараа ч орж ирээгүй бол гүйлгээний баримттайгаа бидэнтэй холбогдоно уу.', 3),
('Төрсөн огноог буруу оруулсан. Яаж засах вэ?', 'Зурхай төрсөн огноогоор тооцогддог тул огноог дараа нь засах боломжгүй. Нэмсэн хүний огноо буруу бол тэр хүнийг устгаад зөв огноотой нь дахин нэмнэ үү. Өмнө нь авсан зурхай «Миний зурхайнууд»-д хэвээр үлдэнэ. Өөрийн («Би») огноо буруу бол бидэнтэй холбогдоно уу.', 4),
('Худалдаж авсан зурхай маань хаана хадгалагдах вэ?', '«Цэс» → «Зурхай» → «Миний зурхайнууд» хэсэгт үүрд хадгалагдана — хүнээр эсвэл төрлөөр нь шүүж, хүссэн үедээ хэдэн ч удаа уншина. Нүүрэнд тухайн хүн дээр дарж ч нээж болно.', 5),
('Нийцлийн зурхайг яаж үзэх вэ?', 'Нүүрэнд нэг хүнийг нөгөө хүн дээр чирж тавина, эсвэл хүний хуудаснаас «Хэнтэй нийцэх вэ?»-г дарна. Дурын хоёр хүн байж болно (жишээ нь Ээж × Аав). Нэг худалдан авалтаар төрсөн үеийн нийцэл болон ордны нийцэл хоёулаа нээгдэнэ. Нэг хосын нийцлийг нэг л удаа авна.', 6),
('Хуучин acyy.me сайтад авсан зурхай маань хаана байна?', 'Хуучин сайтад нэвтэрдэг байсан Facebook-ээрээ нэвтэрнэ үү — авсан төрсөн өдрийн болон нийцлийн зурхай, хүмүүс, үлдэгдэл тань автоматаар шилжиж ирнэ. Анх нэвтрэхэд «Та аль нь вэ?» гэж асуухад өөрийгөө сонгоно. Олдохгүй бол бидэнтэй холбогдоно уу.', 7),
('Найзаа хэрхэн урих вэ? Ямар давуу талтай вэ?', 'Хүний хуудасны «Урих» хэсгээс «Линк хуулах» эсвэл «Имэйлээр урих»-ыг сонгоно. Урилга 7 хоног хүчинтэй, нэг удаа ашиглагдана. Урьсан хүн тань бүртгүүлбэл та хоёрын нийцлийн зурхайг тэр үнэгүй уншина.', 8),
('Цэнэглэсэн мөнгөө буцааж авч болох уу?', 'Хэтэвчийн үлдэгдлийг бэлэн мөнгөөр буцаадаггүй. Харин үлдэгдэл хугацаагүй тул дараа нь хүссэн зурхайгаа авахад ашиглагдана. Алдаатай гүйлгээ гарсан бол бидэнтэй холбогдоно уу.', 9),
('Секс зурхай яагаад харагдахгүй байна вэ?', 'Энэ нь 18+ зурхай. Таны «Би»-ийн нас болон тухайн хүний нас 18 хүрсэн байх ба «Би» хуудаснаас «Би 18 нас хүрсэн» гэж нэг удаа баталгаажуулна. Мөн зөвхөн өөртөө болон «Хайрт», «Краш» харилцаатай хүнд харагдана.', 10);
