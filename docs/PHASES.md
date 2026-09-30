# PHASES — Хөгжүүлэлтийн дараалал

> Дүрэм: [CLAUDE.md](../CLAUDE.md) · Бизнесийн дүрэм: [SPEC.md](SPEC.md)
> **C1–C7 локал** дээр логикийг бүрэн ажиллуулж тестэлнэ → **C8** deploy → **C9** жинхэнэ нэвтрэлт/төлбөр → **C10** нээлт.
> Нэг phase = нэг branch = нэг PR. "Дууссаны шалгуур" бүгд ✅ болсон үед дараагийнх руу шилжинэ.

| # | Phase | Орчин | Хэрэглэгчээс хэрэгтэй |
|---|---|---|---|
| C0 | Хуулийн хуудас + OAuth review эхлүүлэх (зэрэгцээ) | Сервер | SSH хандалт |
| C1 | Суурь | Локал | — |
| C2 | Нэвтрэлт v1 (имэйл + нууц үг) + onboarding | Локал | — |
| C3 | Хүмүүс + орд/48 үеийн тооцоо | Локал | — |
| C4 | Админ + текст сан + Excel импорт | Локал | Текстийн файлууд (байхгүй бол placeholder) |
| C5 | Хэтэвч + QPay mock | Локал | — |
| C6 | Худалдан авалт + унших | Локал | — |
| C7 | Урилга + хуваалцах карт | Локал | — |
| C8 | Deploy (сервер, CI/CD, SSL) | Сервер | SSH, GitHub repo |
| C9 | Нэвтрэлт v2 (Google, FB, OTP) + QPay sandbox | Сервер | Google/FB/Resend/QPay түлхүүрүүд |
| C10 | Хууль, аюулгүй байдал, E2E, нээлт | Сервер | Хуулийн текстийг шалгуулах |

---

## C0 — Хуулийн хуудас + OAuth review (зэрэгцээ, ~0.5 өдөр)

**Зорилго:** Facebook App Review, Google OAuth verification нь 1–3 долоо хоног шаарддаг. Амьд URL дээр Нууцлалын бодлого хэрэгтэй тул хамгийн эхэнд эхлүүлнэ.

- [ ] Сервер: `deploy` хэрэглэгч, SSH key, UFW (22/80/443), Docker + Compose суулгах
- [ ] Caddy контейнер: `2-28-197-187.sslip.io` → статик `privacy.html`, `terms.html`, `data-deletion.html` (SSL автоматаар)
- [ ] Нууцлалын бодлого, Үйлчилгээний нөхцөлийн **ноорог** (монгол), SPEC §4.1, §9-ийн дүрмүүдийг тусгасан
- [ ] `docs/SETUP-OAUTH.md`: хэрэглэгч Google Cloud Console, Meta for Developers дээр юу хийхийг алхам алхмаар (redirect URI-ууд: `{APP_URL}/api/auth/callback/google|facebook`)

**Дууссаны шалгуур:** `https://2-28-197-187.sslip.io/privacy` HTTPS-ээр нээгдэнэ. Хэрэглэгч OAuth app-уудаа үүсгэж review-д илгээх боломжтой.

> Prompt: *"docs/PHASES.md-ийн C0-г хий. Серверийн SSH: `ssh root@2.28.197.187`."*

---

## C1 — Суурь (~2 өдөр)

- [x] `git init`, `.gitignore`, `README.md` — GitHub private repo: _хүлээгдэж байна (repo URL өгөхөд push)_
- [x] Next.js (App Router, TS strict, `src/` dir), Tailwind, shadcn/ui, ESLint + Prettier, pnpm
- [x] `docker-compose.yml` (dev): Postgres 16, Mailpit. `docker-compose.prod.yml`-ийн ноорог (C8-д дуусгана)
- [x] Drizzle тохиргоо + SPEC §9-ийн бүх хүснэгт (Better Auth-ын хүснэгтээс бусад — C2-д) + migration
- [x] Seed: `zodiac_signs` (SPEC §2.4), `periods48` placeholder (1 = 12-26–01-02), `products` (SPEC §3), placeholder `content_entries` (бүх түлхүүрт "[Placeholder] …" текст — нийт 366+48+78+1176)
- [x] `src/i18n/mn.ts`, design token-ууд (цагаан хар, dark = урвуу), фонт (кирилл дэмждэг: Inter + serif гарчигт)
- [x] Үндсэн компонентууд: Button, Card, BottomSheet, Avatar, TabBar, Header (хэтэвчний чип placeholder), DatePicker (Он/Сар/Өдөр 3 scroll)
- [x] PWA manifest + icon-ууд
- [x] Vitest, Playwright тохиргоо, 1 жишээ тест
- [x] `.env.example` (SPEC §11)

**Дууссаны шалгуур:** `docker compose up -d && pnpm db:migrate && pnpm db:seed && pnpm dev` → утсан дээр (LAN) 4 табтай хоосон app харагдана. lint/typecheck/test ногоон.

> Prompt: *"CLAUDE.md, docs/SPEC.md-ийг уншаад docs/PHASES.md-ийн C1-ийг хий."*

---

## C2 — Нэвтрэлт v1 + onboarding (~2 өдөр)

- [x] Better Auth: Drizzle adapter, `emailAndPassword` (`AUTH_PASSWORD_ENABLED` flag-аар), DB session 30 хоног
- [x] Social provider-уудыг env байвал л идэвхжүүлэх бүтэц (Google/FB-ийн код C9-д), `emailOTP` plugin-ийн суурь (Mailpit-ээр илгээнэ)
- [x] `/login`: dev үед имэйл+нууц үг форм + "Имэйлээр код авах"
- [x] Middleware: `(app)` route-уудыг хамгаалах, "Би" байхгүй бол → `/onboarding`
- [x] `/onboarding`: нэр → огноо (засагдахгүй гэсэн анхааруулга) → хүйс → avatar → "Таны орд" дэлгэц → хүн нэмэх санал
- [x] Админ role helper (`ADMIN_OWNER_EMAILS`, `ADMIN_EDITOR_EMAILS`)
- [x] Seed: тестийн 4 данс (SPEC §5) — `user@test.local`-ийн 5,000₮ үлдэгдэл C5-д `wallet.credit()`-ээр
- [x] `/me`: профайл харах, гарах

**Дууссаны шалгуур:** `user@test.local`-аар нэвтэрнэ; шинэ данс → onboarding → "Би" үүснэ. OTP имэйл Mailpit-д ирж нэвтэрч болно. Нэвтрээгүй хүн `/home` руу орж чадахгүй.

---

## C3 — Хүмүүс + тооцоо (~3 өдөр)

- [x] `src/server/astro/zodiac.ts`: `getSign(date, signs)`, `src/server/astro/period48.ts`: `getPeriod(date, periods)` — жилийн заагтай, 02-29 (C2-д onboarding-д зориулж эхэлсэн)
- [x] `validateCoverage(ranges)`: 366 өдөр бүр яг нэг мужид (давхцал/цоорхой) — админ засвар, импортод ашиглана
- [x] **Unit тест:** бүх 12 ордын хил (эхлэл/төгсгөл), 12-26/01-02/01-03, 02-29, 12-31, coverage алдаа
- [x] `src/server/persons.ts`: create / update (огноо **хасагдсан** schema) / soft delete, эрхийн шалгалт
- [x] `src/lib/avatars.ts`: 30 seed, DiceBear render; AvatarPicker grid
- [x] `/people`, `/people/new` (харилцаа → avatar → мэдээлэл), `/people/[id]` (орд, үе, засах, устгах)
- [x] `/home`: миний карт, хүмүүсийн жагсаалт
- [x] **Unit тест:** өөр хэрэглэгчийн person-ийг засах/устгах → хориглогдоно; birth_date шинэчлэх оролдлого → үл тоомсорлогдоно/алдаа

**Дууссаны шалгуур:** Хүн нэмэхэд орд зөв гарна, огноо засах UI/API байхгүй, бүх тест ногоон.

---

## C4 — Админ + текст сан + Excel импорт (~4 өдөр)

- [x] `/admin` layout (role guard), dashboard (одоохондоо контентын бүрдэл `366/366` гэх мэт, placeholder-уудыг тусад нь тоолно)
- [x] `/admin/content`: бүтээгдэхүүн/хэсгээр жагсаалт, хайх, дутуу түлхүүр, засах (title/body/score/status)
- [x] `/admin/zodiac`, `/admin/periods`: муж засах + `validateCoverage`
- [x] `/admin/products` (Owner): үнэ, идэвх, бүлэг, 18+
- [x] `src/server/import/`: загвар үүсгэгч (SPEC §10), parser (column mapping-тай, монгол ордын нэр ↔ code), validator, dry-run тайлан, transaction upsert, audit log
- [x] `/admin/import`: загвар татах → upload → тайлан → [Импортлох]
- [x] **Unit тест:** validator — дутуу/давхар (A|B vs B|A)/үл мэдэгдэх түлхүүр/хоосон body/муж цоорхой; 78 ба 1,176 хосын бүрэн жагсаалт үүсгэгч
- [ ] Хэрэглэгчийн жинхэнэ файл `content/` хавтаст байвал форматыг шинжилж parser-ийг тааруулах, импортлож туршиx — _файл ирээгүй; parser нь монгол/англи баганын нэр, Excel огноо нүдийг танина_

**Дууссаны шалгуур:** Загвар татаж бөглөөд upload хийхэд dry-run тайлан зөв гарна; алдаагүй файл бүрэн импортлогдоно; Editor нь `/admin/products` руу орж чадахгүй.

---

## C5 — Хэтэвч + QPay mock (~3 өдөр)

- [x] `src/server/wallet.ts`: `getBalance`, `credit`, `debit` (SPEC §4.2)
- [x] **Unit/integration тест (жинхэнэ Postgres):** 100 зэрэгцээ debit → сөрөг үлдэгдэлгүй; ижил `idempotency_key` 2 удаа → 1 л бичлэг — _embedded Postgres 16 (`src/test/real-pg.ts`), `FOR UPDATE`-гүйгээр тест унадгийг шалгасан_
- [x] `src/server/qpay/`: `QPayProvider` интерфейс, `MockQPayProvider`, `QPayV2Provider` (sandbox/prod — кодыг бичээд mock-оор тестлэнэ)
- [x] `src/config/topup.ts` шатлал; Цэнэглэх bottom sheet (Header чип, `/wallet`-ээс)
- [x] Invoice дэлгэц: утсан дээр deeplink товчнууд, desktop дээр QR; 3 сек poll
- [x] `/api/qpay/callback` (HMAC + `checkPayment` + idempotent credit + bonus), `/api/cron/qpay-check`
- [x] `/dev/qpay/[invoiceId]` mock төлбөрийн хуудас (зөвхөн `QPAY_MODE=mock`; товч нь `/api/dev/qpay` руу энгийн form POST)
- [x] `/wallet`: үлдэгдэл, гүйлгээний түүх
- [x] Админ `/admin/users/[id]`, `/admin/topups` (Owner): хэтэвч, adjust (шалтгаантай), дахин шалгах

**Дууссаны шалгуур:** Mock-оор 10,000₮ цэнэглэхэд 11,000 нэмэгдэнэ; callback-ийг 2 удаа дуудахад 1 л удаа нэмэгдэнэ; callback-гүйгээр cron шалгаж нэмнэ.

---

## C6 — Худалдан авалт + унших (~4 өдөр)

- [x] `src/server/catalog.ts`: хүнд боломжтой бүтээгдэхүүн (бүлэг, 18+, идэвхтэй, авсан эсэх)
- [x] `src/server/purchase.ts`: `purchase(userId, productCode, personIds)` — шалгалт → subject_key → snapshot → debit + insert нэг transaction; аль хэдийн авсан бол одоогийнхыг буцаах
- [x] `src/server/reading.ts`: `getReading(viewer, purchaseId)` (эзэмшигч эсвэл synastry-д холбогдсон хэрэглэгч), `getPreview(product, persons)` — **2 өгүүлбэр серверт таслах**
- [x] **Unit тест:** sex — насанд хүрээгүй хэрэглэгч/хүн → хориглогдоно; ээж дээр dating → хориглогдоно; A×B дараа B×A → давхар төлбөргүй; үлдэгдэл хүрэлцэхгүй → rollback; preview-д бүтэн текст гарахгүй; өөр хүний purchase-ийг унших → 404
- [x] `/readings` каталог + Миний зурхайнууд, `/buy/[product]` (хүн сонгох → 2 дахь хүн → preview → баталгаажуулах sheet)
- [x] Үлдэгдэл хүрэлцэхгүй → цэнэглэх sheet → амжилттай → баталгаажуулах sheet руу буцах
- [x] `/r/[purchaseId]` унших дэлгэц (нийцэлд 2 хэсэг + оноо), анхааруулга
- [x] `/people/[id]`: боломжтой бүтээгдэхүүнүүд, "Нийцэл харах" → хүн сонгох
- [x] `/me`: 18+ баталгаажуулалт; `/home`: санал болгох карт, сүүлийн зурхайнууд

**Дууссаны шалгуур:** `user@test.local` 6 бүтээгдэхүүнийг бүгдийг худалдаж аваад уншина; `minor@test.local`-д секс зурхай харагдахгүй; бүх тест ногоон.

---

## C7 — Урилга + хуваалцах карт (~3 өдөр)

- [ ] `src/server/email/`: transport abstraction (SMTP/Mailpit ↔ Resend), урилгын имэйлийн загвар (монгол)
- [ ] `src/server/invitations.ts`: үүсгэх (token hash, 7 хоног), хүлээн авах, цуцлах
- [ ] UI: [Линк хуулах] (Web Share API), [Имэйлээр урих]; `/invite/[token]` урсгал (SPEC §7), onboarding урьдчилан бөглөх
- [ ] Холбогдсон хэрэглэгч synastry-г үнэгүй унших, "Надтай хийсэн нийцлүүд", "Намайг хасах"
- [ ] `/api/share/[purchaseId]` (story/square, кирилл фонт), [Хуваалцах] товч
- [ ] **Тест:** хугацаа дууссан/ашигласан токен; үнэгүй эрх зөвхөн synastry-д; хамааралгүй хэрэглэгч карт үүсгэж чадахгүй

**Дууссаны шалгуур:** A хэрэглэгч B-г урьж, нийцэл худалдаж авна → B Mailpit-ийн линкээр бүртгүүлээд тэр нийцлийг үнэгүй уншина. Story карт кириллээр зөв зурагдана.

---

## C8 — Deploy (~2 өдөр)

- [ ] `Dockerfile` (Next.js standalone, multi-stage), `docker-compose.prod.yml` (app, db, caddy), C0-ийн Caddy-г app руу proxy болгох
- [ ] Серверийн `.env` (QPAY_MODE=mock, AUTH_PASSWORD_ENABLED=true — staging шатанд)
- [ ] GitHub Actions: PR → lint/typecheck/test; `main` → image build (GHCR) → SSH deploy → migration → `/api/health` шалгах
- [ ] Өдөр тутмын `pg_dump` backup (14 хоног), host crontab → `/api/cron/qpay-check`
- [ ] `docs/DEPLOY.md`: rollback, лог харах, backup сэргээх

**Дууссаны шалгуур:** `main`-д merge хийхэд `https://2-28-197-187.sslip.io` автоматаар шинэчлэгдэнэ; утсан дээр бүх C1–C7 урсгал ажиллана.

---

## C9 — Нэвтрэлт v2 + QPay sandbox (~3 өдөр)

- [ ] Google, Facebook provider-ууд; account linking (ижил имэйл)
- [ ] Имэйл OTP-г Resend-ээр (домэйн баталгаажих хүртэл Resend-ийн тестийн горим)
- [ ] In-app browser илрүүлэх + "Browser-т нээх" заавар (SPEC §5)
- [ ] `/api/fb/data-deletion` (signed_request шалгах, устгалт, статус URL)
- [ ] `QPAY_MODE=sandbox`: жинхэнэ invoice, callback, банкны deeplink-ийг iOS/Android дээр туршиx
- [ ] Production-д `AUTH_PASSWORD_ENABLED=false`, `/dev/*` route идэвхгүйг шалгах

**Дууссаны шалгуур:** Утсан дээр Google, FB, OTP гурвуулаа ажиллана; Messenger-ээс нээхэд заавар гарна; QPay sandbox-оор цэнэглэлт бүрэн ажиллана.

---

## C10 — Хууль, аюулгүй байдал, нээлт (~3 өдөр)

- [ ] `/terms`, `/privacy` (C0-ийн ноорог → хэрэглэгчийн баталсан хувилбар), footer, анхааруулга
- [ ] Данс устгах (SPEC §9 anonymize), rate limit, security headers/CSP
- [ ] Эрхийн (IDOR) тест: бүх `[id]` route-ыг өөр хэрэглэгчээр
- [ ] Playwright E2E: onboarding → хүн нэмэх → цэнэглэх (mock) → худалдан авах → унших → урих
- [ ] Lighthouse mobile ≥ 90; iPhone Safari, Android Chrome, Messenger in-app тест
- [ ] Админ dashboard: хэрэглэгч, орлого, борлуулалт
- [ ] `docs/LAUNCH-CHECKLIST.md`: env (prod), QPay production түлхүүр, backup сэргээх тест, домэйн солих алхам (`APP_URL`, OAuth redirect URI, QPay callback)

**Дууссаны шалгуур:** E2E ногоон, checklist бүрэн → **нээлт 🚀**

---

## MVP-ийн дараа (backlog)
И-баримт (QPay ebarimt) · Промо код · Найз урих бонус · Багц үнэ · Өдрийн зурхай · Монгол зурхай (12 жил) · Web push · Жинхэнэ домэйн + брэнд нэр
