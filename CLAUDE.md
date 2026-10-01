# CLAUDE.md

Монгол хэрэглэгчдэд зориулсан **зурхайн web app** (mobile-first PWA). Хэрэглэгч өөрийгөө болон хамаатай хүмүүсээ (ээж, найз, хайрт…) нэмээд, хэтэвчээ QPay-ээр цэнэглэж, бэлэн текст сангаас зурхай худалдаж авч уншина.

- Бизнесийн дүрэм, схем, дэлгэцүүд: **[docs/SPEC.md](docs/SPEC.md)** — эх сурвалж энэ.
- Хийх ажлын дараалал: **[docs/PHASES.md](docs/PHASES.md)** — нэг удаад нэг phase.
- `docs/archive/` — хуучин судалгаа (AI, өдрийн зурхай гэх мэт **хэрэгжүүлэхгүй**). SPEC-тэй зөрвөл SPEC дагана.

## Стек
- **Next.js** (App Router, хамгийн сүүлийн тогтвортой хувилбар) + **TypeScript strict** + **Tailwind CSS** + shadcn/ui
- **PostgreSQL 16** + **Drizzle ORM** (migration-уудыг `drizzle/` дотор commit хийнэ)
- **Better Auth** — имэйл+нууц үг (зөвхөн dev/staging), Google, Facebook, имэйл OTP, account linking
- **Zod** (бүх оролтын шалгалт), **exceljs** (Excel импорт/экспорт), **@dicebear/core** (avatar, локалд render)
- **next/og** (хуваалцах карт), **Resend** (prod имэйл), **Mailpit** (локал имэйл)
- **Vitest** (unit), **Playwright** (E2E), **pnpm**, **Docker Compose**, **Caddy** (reverse proxy + SSL)
- AI/LLM, queue, Redis **ашиглахгүй**. Нэг Next.js app (monorepo биш).
- Next.js 16: `middleware` → `proxy.ts`, request API-ууд async. Код бичихээс өмнө `node_modules/next/dist/docs/`-ийг шалга ([AGENTS.md](AGENTS.md)).

## Командууд
```bash
docker compose up -d          # Postgres + Mailpit (http://localhost:8025)
pnpm db:local                 # Docker-гүй: PGlite Postgres :54320 (DATABASE_POOL_MAX=1, имэйл → /dev/mail)
pnpm dev                      # http://localhost:3000
pnpm db:generate              # схемээс migration үүсгэх
pnpm db:migrate
pnpm db:seed                  # орд, 48 үе, бүтээгдэхүүн, тестийн хэрэглэгчид, placeholder текст
pnpm db:seed:demo [--reset]   # dev: 90 хоногийн demo хэрэглэгч/цэнэглэлт/худалдан авалт (admin самбарт)
pnpm db:clean:e2e             # dev: E2E-ийн үүсгэсэн *@test.local хэрэглэгчдийг устгана (seed-ийн 4 данс үлдэнэ)
pnpm lint && pnpm typecheck
pnpm test                     # Vitest
pnpm test:e2e                 # Playwright
```
PGlite (`db:local`) нь бүх холболтыг нэг session-д нийлүүлдэг тул `db:*` script-үүдийг dev server зогссон үед ажиллуулна.
Гар утсаар тестлэх: `pnpm dev -H 0.0.0.0` → `http://<LAN-IP>:3000`. In-app browser тест: `cloudflared tunnel --url http://localhost:3000`.

## Хатуу дүрмүүд (зөрчихгүй)
1. **Мөнгө** — төгрөгөөр бүхэл тоо (`bigint`, mode number). `float` хэзээ ч үгүй. Хэтэвчийн бүх өөрчлөлт **зөвхөн** `src/server/wallet.ts`-ийн `credit()` / `debit()`-ээр, DB transaction + `SELECT … FOR UPDATE` + `idempotency_key`-тэй. `wallets.balance`-г шууд UPDATE хийхгүй.
2. **Төрсөн огноо засагдахгүй.** `persons.birth_date`-г үүсгэсний дараа өөрчлөх API, UI байхгүй. Нэр, avatar, харилцаа, хүйс засагдана.
3. **Paywall** — худалдаж аваагүй зурхайн бүтэн текст **серверээс хэзээ ч гарахгүй**. Preview = эхний 2 өгүүлбэр, серверт таслаад илгээнэ (CSS blur-д найдахгүй).
4. **Эрх** — хэрэглэгчийн өгөгдөлд хандах бүрт `owner_user_id = session.user.id` серверт шалгана. Admin route-ууд role шалгана (Owner/Editor).
5. **Нэвтрэлт** — `AUTH_PASSWORD_ENABLED=false` үед нууц үгийн нэвтрэлт бүрэн идэвхгүй (production). Username биш, **имэйл** нь танигч.
6. **QPay callback-д итгэхгүй** — callback ирэхэд `checkPayment()`-ээр дахин баталгаажуулна. QPay-тэй бүх харилцаа `QPayProvider` интерфейсээр (`mock` | `sandbox` | `production`).
7. **Орд / 48 үеийг** DB-ийн хүснэгтээс (`zodiac_signs`, `periods48`) тооцно, hard-code хийхгүй. Жилийн заагийг (12→01) зөв шийдэж, 02-29-ийг тестлэнэ.
8. Нууц түлхүүр кодонд байхгүй. Шинэ env нэмбэл `.env.example`-д заавал нэмнэ.

## Кодын хэв маяг
- UI текст **монгол** хэлээр, код/нэршил/commit **англи**. UI мөрүүдийг `src/i18n/mn.ts`-д төвлөрүүлнэ (дараа нь i18n хийхэд бэлэн).
- Mutation → **Server Actions** (Zod-оор шалгана). Гадны callback/cron → Route Handlers (`src/app/api/...`).
- Бизнес логик `src/server/*` (UI-гүй, тестлэгдэхүйц цэвэр функц), React компонентод биш.
- Mobile-first: 360–390px-ээс эхэлж зурна, товч ≥ 44px, гол үйлдэл доод хэсэгт, сонголтуудыг bottom sheet-ээр.
- Desktop (`lg` ≥ 1024px): доод tab bar + header → зүүн **sidebar** (nav + хэтэвч), контент олон баганаар (`lg:grid-cols-…`), `BottomSheet` автоматаар төвийн **dialog** болно, унших текст ≤ 680px. Загвар: [Cosmic soft v2](https://claude.ai/artifact/UsPJUf9XeTrS72tBih7hHD).
- Нүүр (`/home`) — бүтэн дэлгэцийн **гараг систем** (`src/components/home/planet-system.tsx`, логик `src/lib/planet-system.ts`). Нүүрнээс нээсэн дэлгэрэнгүй хуудсууд `src/app/(app)/home/@modal/(..)*` intercept-ээр **popup** болж гарна; шууд URL / refresh → `(shell)` дотор бүтэн хуудас. Шинэ дэлгэрэнгүй хуудас нэмбэл `@modal/(..)`-д intercept-ийг нь нэмнэ.
- Дизайн: **Cosmic soft** бүтэц (том орд hero, пастел хавтан, хөвөгч pill tab bar, дугуй карт). Хэрэглэгч **Cosmic** ба **White** гэсэн 2 өнгөний горимоос сонгоно (`src/lib/theme.ts`, cookie `theme`), тус бүр OS dark mode-ыг дагана. Өнгийг зөвхөн CSS token-оор (`--bg`, `--surface`, `--fg`, `--muted`, `--highlight`, `--tint-1..3`, `--nav-*` — `globals.css`), hex-ийг компонентод бичихгүй.
- Шинэ бизнес логик бүрт unit тест. Мөнгө, эрх, импортын логикт тест **заавал**.

## Ажлын урсгал
- Бүх ажлыг **`main` branch дээр** шууд хийнэ (тусдаа branch, PR үүсгэхгүй). Remote: `origin` → `github.com/amgaa-droid/acyy.me`. Push-ийг хэрэглэгч хүссэн үед хийнэ.
- PHASES.md-ийн "Дууссаны шалгуур" бүгд биелсэн үед л phase дууссан гэнэ.
- Phase дуусахад: `pnpm lint && pnpm typecheck && pnpm test` ногоон, PHASES.md дахь checkbox-уудыг тэмдэглэнэ.
- SPEC-д байхгүй шийдвэр гаргах шаардлага гарвал хэрэглэгчээс асууна; жижиг зүйлд боломжийн default сонгоод PR тайлбарт бичнэ.
- Хэрэглэгчээс шаардлагатай зүйл (түлхүүр, файл, SSH) дутвал mock/placeholder-оор үргэлжлүүлж, дутууг PR-д жагсаана.
