# Зурхай

Монгол хэрэглэгчдэд зориулсан зурхайн mobile-first PWA. Дэлгэрэнгүй: [docs/SPEC.md](docs/SPEC.md), ажлын дараалал: [docs/PHASES.md](docs/PHASES.md), дүрэм: [CLAUDE.md](CLAUDE.md).

## Шаардлага

- Node.js ≥ 22, pnpm (`corepack enable pnpm`)
- Docker (Docker Desktop эсвэл OrbStack) — Postgres 16 + Mailpit

## Эхлүүлэх

```bash
cp .env.example .env          # нууц утгуудыг бөглөнө (openssl rand ...)
pnpm install
docker compose up -d          # Postgres :5432, Mailpit http://localhost:8025
pnpm db:migrate
pnpm db:seed                  # орд, 48 үе (placeholder), бүтээгдэхүүн, 1,668 placeholder текст
pnpm dev                      # http://localhost:3000
```

Утсаар (LAN): `pnpm dev -H 0.0.0.0` → `http://<LAN-IP>:3000`.

## Командууд

|                                                |                                                                 |
| ---------------------------------------------- | --------------------------------------------------------------- |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | Чанарын шалгалт                                                 |
| `pnpm test`                                    | Vitest unit тест                                                |
| `pnpm test:e2e`                                | Playwright (эхний удаа `pnpm exec playwright install chromium`) |
| `pnpm db:generate`                             | Схемийн өөрчлөлтөөс migration үүсгэх (`drizzle/`)               |
| `pnpm db:studio`                               | Drizzle Studio                                                  |

`/dev/ui` — компонентуудын галерей, `/dev/mail` — илгээсэн имэйлүүд (зөвхөн dev).

## Бүтэц

```
src/app/            маршрутууд ((app) = tab bar-тай хэсэг)
src/components/ui   shadcn/ui (base-ui)
src/components/app  апп-ын компонентууд (Header, TabBar, BottomSheet, Avatar, DatePicker)
src/server/         бизнес логик (UI-гүй, тестлэгдэхүйц) — db/, astro/, content/
src/lib/            client/server хоёуланд нь хэрэглэгдэх helper-ууд
src/i18n/mn.ts      бүх UI текст
drizzle/            migration-ууд
```
