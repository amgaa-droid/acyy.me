# SPEC — Зурхайн Web App

> Хувилбар 1.0 · 2026-09-30 · Энэ баримт бол бизнесийн дүрмийн **эх сурвалж**.
> App-ын нэр тодорхойгүй → `APP_NAME` env (default: "Зурхай").

---

## 1. Тойм

| | |
|---|---|
| Төрөл | Mobile-first web app (PWA), зөвхөн монгол хэл |
| Контент | **Бэлэн текст сан** (админ Excel-ээр оруулна). AI ашиглахгүй |
| Төлбөр | Дотоод хэтэвч, QPay-ээр цэнэглэнэ. Зурхайг хэтэвчнээс төлнө |
| Нэвтрэлт | Google, Facebook, имэйл OTP (+ dev/staging-д имэйл+нууц үг) |
| Сервер | `2.28.197.187` (Ubuntu), түр домэйн `2-28-197-187.sslip.io`, жинхэнэ домэйн дараа `APP_URL` env-ээр |

**MVP-д орохгүй:** өдрийн зурхай, Монгол зурхай (12 жил), AI текст, төрсөн цаг/газар, и-баримт, промо код, referral бонус, push мэдэгдэл.

---

## 2. Хэрэглэгч ба хүмүүс

### 2.1 Хүн (person)
Хэрэглэгч бүр өөрийн **"Би"** (`is_self=true`, яг нэг) болон хамаатай хүмүүстэй.

| Талбар | Заавал | Тайлбар |
|---|---|---|
| Нэр | ✅ | 1–40 тэмдэгт |
| Төрсөн огноо | ✅ | Он/Сар/Өдөр. **Үүсгэсний дараа засагдахгүй.** Ирээдүйн огноо, 1900-оос өмнөх огноо хориотой |
| Хүйс | ❌ | `male` / `female` / `unspecified` (default). Хүйсээс хамаарсан зурхай (`by_gender` хэсэгтэй) авсны дараа **засагдахгүй** |
| Харилцаа | ✅ (Би-д биш) | 2.2-г үз. `other` бол `relation_label` (өөрөө нэрлэнэ, ≤ 20) |
| Avatar | ✅ | DiceBear seed (2.3) |
| Урих имэйл | ❌ | Урилга илгээх (7-р хэсэг) |

- Огноо алдаатай бол → хүнийг **устгаад** дахин нэмнэ. Устгасан хүний өмнөх худалдан авалтууд "Миний зурхайнууд"-д хэвээр харагдана (snapshot-оор).
- Устгах = soft delete (`deleted_at`). Жагсаалтад харагдахгүй.
- **Засвар ба худалдан авалт:** нэр, хүйс, харилцаа, avatar засагдана, гэхдээ авсан зурхайн **текст** snapshot-оос (огноо, орд, үе, хүйс) тооцогдох тул хэзээ ч өөрчлөгдөхгүй (хүйсээ солиод нөгөө хувилбарыг үнэгүй уншихгүй). Хүйсээр хуваагдсан хэсэгтэй бүтээгдэхүүнийг хүйс заасан хүнд авсан бол (дараа нь нэмэгдсэн/архивласан хэсэг ч тооцогдоно) тэр хүний хүйс **түгжигдэнэ** — огноо шиг, алдаатай бол устгаад дахин нэмнэ. Эзэмшигчид уншлага, "Миний зурхайнууд", хуваалцах картад хүний **одоогийн** нэр, avatar, харилцаа харагдана; устгасан хүн эсвэл холбогдсон (урьсан) хэрэглэгчид snapshot-ын нэр. Харилцаа солих эсвэл бүтээгдэхүүн идэвхгүй болсны улмаас тохирохгүй болсон ч **авсан** зурхай хүний хуудсанд үлдэнэ.
- UI: огноо сонгохдоо "Энэ огноог дараа нь өөрчлөх боломжгүй" гэж анхааруулна.

### 2.2 Харилцааны төрөл ба бүлэг

| `relation` | Монгол | Бүлэг (`group`) |
|---|---|---|
| `self` | Би | `self` |
| `mother` | Ээж | `family` |
| `father` | Аав | `family` |
| `older_brother` | Ах | `family` |
| `older_sister` | Эгч | `family` |
| `younger_sibling` | Дүү | `family` |
| `child` | Хүүхэд | `family` |
| `partner` | Хайрт | `romantic` |
| `crush` | Краш | `romantic` |
| `friend` | Найз | `friend` |
| `coworker` | Хамт ажиллагч | `other` |
| `other` | Бусад (өөрөө нэрлэнэ) | `other` |
| `nobody` | Хэн ч биш | `other` — нүүрний гараг систем дээр үргэлж «+N» дотор байна |

### 2.3 Avatar
- `@dicebear/core` + `notionists` (эсвэл `lorelei`) style — хар цагаан шугаман зураг, minimal дизайнд тохирно.
- Урьдчилан тодорхойлсон **30 seed**-ийн grid-ээс сонгоно (`src/lib/avatars.ts`). Локалд SVG render хийнэ (гадны API дуудахгүй).
- `persons.avatar_seed` хадгална.

### 2.4 Орд ба 48 үе (тооцоо)
**Орд** — тогтмол хүснэгт (`zodiac_signs`, админаас засагдана). Seed утга:

| code | Монгол | Муж |
|---|---|---|
| aries | Хонь | 03-21 – 04-19 |
| taurus | Үхэр | 04-20 – 05-20 |
| gemini | Ихэр | 05-21 – 06-20 |
| cancer | Мэлхий | 06-21 – 07-22 |
| leo | Арслан | 07-23 – 08-22 |
| virgo | Охин | 08-23 – 09-22 |
| libra | Жинлүүр | 09-23 – 10-22 |
| scorpio | Хилэнц | 10-23 – 11-21 |
| sagittarius | Нум | 11-22 – 12-21 |
| capricorn | Матар | 12-22 – 01-19 |
| aquarius | Хумх | 01-20 – 02-18 |
| pisces | Загас | 02-19 – 03-20 |

**48 үе** (`periods48`, нийцлийн 2-р хэсэгт) — 1-р үе **12-26 – 01-02**-оор эхэлнэ. Жинхэнэ мужийг хэрэглэгчийн файлаас импортлоно; түүнээс өмнө seed нь жилийг 48 тэнцүү орчим хэсэгт хуваасан placeholder.

**Дүрэм:** `getSign(date)`, `getPeriod(date)` нь `MM-DD`-ээр харьцуулна, жилийн заагийг (end < start) дэмжинэ. 02-29 нь 02-28-тай ижил үе/ордод орно (мужид тусгайлан заагаагүй бол). Бүх 366 өдөр яг нэг орд, яг нэг үед хамаарах ёстой — импорт/засварын үед үүнийг шалгана (давхцал, цоорхой байвал хадгалахгүй).

---

## 3. Бүтээгдэхүүн

Бүтээгдэхүүнийг **админ (Owner) `/admin/products`-оос үүсгэж, тохируулна** — доорх 6 нь анхны каталог (seed). Бүтээгдэхүүн бүр:
- **1+ хэсэгтэй** (`product_parts`) — хэсэг бүр өөрийн **түлхүүрийн төрөлтэй**: `month_day` (366), `sign` (12), `period` (48), `sign_pair` (78, A×B = B×A), `period_pair` (1,176), `sign_pair_ordered` (144 чиглэлтэй текст: Хонь→Арслан ≠ Арслан→Хонь; худалдан авалт хосоороо нэг, уншлагад **хоёр чиглэл хоёулаа** гарна, орд ижил бол нэг). Түлхүүрийн хүний тоо = бүтээгдэхүүний хүний тоо.
- 1 хүнтэй хэсэг **эр/эм тусдаа** (`by_gender`) байж болно: түлхүүр `"{key}|male"`, `"{key}|female"` (2 дахин олон текст). Хүйс заагаагүй хүнд худалдан авахаас өмнө хүйсийг асууж, хүний мэдээлэлд хадгална.
- Хэсэг бүр **дэд хэсгүүдтэй** (`product_fields`): код (Excel багана, өөрчлөгдөхгүй), нэр, **харагдах хэлбэр** (`text` догол мөр · `quote` ишлэл карт · `cards` мөр бүр карт · `list` хавтан · `chips` онцлох товруу · `alert` анхааруулга), **үнэгүй** (preview-д бүтнээрээ), **заавал**. Хасвал **архивлана** — хадгалсан текст DB-д үлдэж, уншлага/засвар/импортод харагдахгүй.
- Код үүсгэсний дараа өөрчлөгдөхгүй. Худалдан авалттай бүтээгдэхүүнийг устгахгүй (идэвхгүй болгоно).
- **Хэсэг засах/устгах** (placeholder текстийг тоолохгүй, хамт устана):
  - Нэр, эрэмбэ — үргэлж.
  - Түлхүүрийн төрөл / эр-эм — зөвхөн худалдан авалтгүй үед. Хэсгийн текстүүд устана (жинхэнэ текст байвал "N текст устана" баталгаажуулалттай); зөвхөн эр/эм асаахад текст бүр эр, эм хоёуланд **ноорог** болж хуулагдана.
  - Устгах — худалдан авалтгүй үед (текстүүд хамт, баталгаажуулалттай). Худалдан авалттай бол **архивлана**: шинээр зарагдахгүй, импорт/бүрдэлд орохгүй, хуучин худалдан авагчид үргэлжлүүлэн уншина; сэргээж болно. Сүүлийн идэвхтэй хэсгийг устгах/архивлахгүй.
  - Худалдан авалтын дараа **нэмсэн хэсгийг** хуучин худалдан авагчид үнэгүй уншина — түлхүүрийг snapshot-ын хүний огноо, орд, үе, хүйсээс тооцно (эр/эм хэсэгт хүйс заагаагүй бол харагдахгүй).
- **Дэд хэсэг:** ямар ч текстэд утгагүй бол устгана, утгатай бол архивлана. Шинэ бүтээгдэхүүн идэвхгүй үүснэ; идэвхжүүлэхэд хэсэг бүр ≥ 1 дэд хэсэгтэй байх ёстой, дутуу текст байвал анхааруулна.

| code | Нэр | Үнэ | Хүн | Контентын түлхүүр | Текстийн тоо | Зөвшөөрөгдөх бүлэг | 18+ |
|---|---|---|---|---|---|---|---|
| `birthday` | Төрсөн өдрийн зурхай | 2000₮ | 1 | `MM-DD` | 366 | бүгд | |
| `sign` | Ордны зурхай | 1000₮ | 1 | орд | 12 | бүгд | |
| `love` | Хайр дурлалын зурхай | 1000₮ | 1 | орд | 12 | self, romantic, friend, other | |
| `sex` | Секс зурхай | 1000₮ | 1 | орд | 12 | self, romantic | ✅ |
| `dating` | Болзооны зурхай | 1000₮ | 1 | орд | 12 | self, romantic, other | |
| `synastry` | Нийцлийн зурхай | 1000₮ | 2 | 2 хэсэг ↓ | 144 + 1,176 | дурын 2 хүн | |

Анхны дэд хэсгүүд: `birthday` — Давуу тал, Сул тал (`list`, үнэгүй), Ерөнхий шинж, Бясалгах үг (`quote`), Зөвлөгөө (`cards`), Эрүүл мэнд, Тоон хэлээр, Таро хөзөр; `sign`/`love`/`sex`/`dating` — Ерөнхий; `synastry` үеийн хос — Ерөнхий, Давуу/Сул тал (`list`), Нийцтэй харилцаа (`chips`), Сорилттой харилцаа (`alert`).

**Нийцлийн зурхай** нэг худалдан авалтаар 2 хэсэг нээгдэнэ:
1. **Харилцааны зөвлөмж** — хэсэг `period_pair` (төрсөн үеийн нийцэл), key `"{pA}|{pB}"` (pA≤pB) → **1,176** (48×49/2). Уншлагад эхэнд гарна; гарчиг нь хоёр хүний хайрцаг дотор (migration 0016).
2. **Ордны нийцэл** — хэсэг `sign_pair` (түлхүүр `sign_pair_ordered`), key `"{signA}|{signB}"` сонгосон дарааллаар (A = 1-р хүн) → **144**. Уншлагад A→B ба B→A хоёр текст (орд ижил бол нэг); хоёулаа нийтлэгдсэн байж худалдаж авна (migration 0008).
- Оноо (`score` 0–100) файлд байвал харуулна, үгүй бол зөвхөн текст.

**Дүрмүүд:**
- Үнэ, `allowed_groups`, `adult_only`, `is_active`-ийг админ (Owner) өөрчилнө.
- Бүх худалдан авалт **үүрд** хадгалагдана.
- Нэг хүн (эсвэл нэг хос) дээр нэг бүтээгдэхүүнийг **нэг л удаа** худалдаж авна. Давхардлыг `purchases.subject_key` UNIQUE-ээр хамгаална:
  - single: `"{personId}"`; pair: `"{minPersonId}|{maxPersonId}"` (A×B = B×A, чиглэлтэй хостой ч мөн адил).
  - Аль хэдийн авсан бол "Нээх" товч → шууд уншина.
- Нийцэлд 2 **өөр** хүн сонгоно (Би байх албагүй: Ээж × Аав болно).
- **18+ (`sex`)**: хэрэглэгчийн "Би"-ийн нас ≥ 18 **ба** сонгосон хүний нас ≥ 18 **ба** хэрэглэгч "Би 18 нас хүрсэн" гэж нэг удаа баталгаажуулсан (`users.adult_confirmed_at`). Үгүй бол бүтээгдэхүүн тухайн хүнд харагдахгүй.
- Бүлгээр тохирохгүй бүтээгдэхүүн тухайн хүний хуудсанд **харагдахгүй** (саарал биш, огт үгүй).
- Худалдан авсан зурхай нь тухайн үеийн **нийтлэгдсэн** контентыг түлхүүрээр нь харуулна (админ текст засвал засвар харагдана). Түлхүүр + нэр + огнооны snapshot `purchases.snapshot`-д.

### 3.1 Preview (paywall)
- Худалдаж аваагүй бол `title` + **`teaser`** (байвал, бүтнээрээ) + **үнэгүй дэд хэсгүүд** (бүтнээрээ, жишээ нь төрсөн өдрийн Давуу/Сул тал) + эхний **үнэтэй** `text`/`quote` дэд хэсгийн **эхний 2 өгүүлбэр** (`## ` дэд гарчгийг алгасна) (`.`, `!`, `?`, `…`-ээр таслах, товчлол анхаарах) + доор нь бүдгэрүүлсэн хуурамч мөрүүд + **[Нээх · 1,000₮]** товч.
- Олон хэсэгтэй бол: хэсэг бүрийн гарчиг (+ teaser, үнэгүй дэд хэсэг) + 1-р хэсгийн эхний 2 өгүүлбэр.
- Худалдаж авсны дараа teaser нь уншлагын эхэнд харагдана.

---

## 4. Хэтэвч ба төлбөр

### 4.1 Цэнэглэх багц (`topup_packages`, `/admin/packages`-оос удирдана; анхны утга migration 0006)
| Төлөх | Бонус | Хэтэвчинд |
|---|---|---|
| 2,000₮ | 0 | 2,000 |
| 5,000₮ | 300 | 5,300 |
| 10,000₮ | 1,000 | 11,000 |
| 20,000₮ | 3,000 | 23,000 |

- Үлдэгдэл **хугацаагүй**, бэлэн мөнгөөр **буцаахгүй** (Үйлчилгээний нөхцөлд бичнэ).
- Бонус нь тусдаа `wallet_entries` мөр (`type=bonus`).
- Алдаа гарвал Owner админ гараар `adjust` хийнэ (шалтгаан заавал, audit log).

### 4.2 Ledger
- `wallets.balance` CHECK (≥ 0). Өөрчлөлт бүр `wallet_entries` (amount +/−, `balance_after`, `idempotency_key` UNIQUE, `ref_type`, `ref_id`).
- `debit()`: transaction → wallet `FOR UPDATE` → balance ≥ amount шалгах → хасах → entry бичих. Хүрэлцэхгүй бол `InsufficientFundsError`.
- Худалдан авалт = нэг transaction: debit + `purchases` insert (subject_key зөрчвөл rollback).

### 4.3 QPay урсгал
```
[Цэнэглэх] дүн сонгох
  → topups (pending) үүсгэх → QPayProvider.createInvoice()
  → Төлбөр зөвхөн QPay (банк сонгуулахгүй): утсан дээр нэг "QPay-ээр төлөх" товч (QPay апп deeplink); desktop: QR зураг
  → Хэрэглэгч QPay апп-д төлнө
  → QPay → POST /api/qpay/callback?topup_id=…&sig=HMAC(topup_id, QPAY_CALLBACK_SECRET)
      → sig шалгах → checkPayment(invoiceId) → paid & дүн таарвал
      → credit(amount, idempotency=paymentId) + credit(bonus) → topups.status=paid
  → Frontend: 3 сек тутам /api/topups/:id poll → "Амжилттай" → өмнөх үйлдэл рүүгээ буцах
```
- Cron (5 мин тутам, `/api/cron/qpay-check`, `CRON_SECRET`): сүүлийн 24 цагийн `pending` topup-уудыг `checkPayment`-ээр шалгана. 24 цагаас хэтэрсэн → `expired`.
- **Үлдэгдэл хүрэлцэхгүй үед:** худалдан авах гэж байсан бүтээгдэхүүн + хүнийг санаж (URL param), цэнэглэлт амжилттай болмогц баталгаажуулах дэлгэц рүү буцна.

### 4.4 `QPayProvider` интерфейс (`src/server/qpay/`)
```ts
interface QPayProvider {
  createInvoice(i: { topupId: string; amount: number; description: string; callbackUrl: string }):
    Promise<{ invoiceId: string; qrImage: string; qrText: string; deeplinks: { name: string; logo: string; link: string }[] }>;
  checkPayment(invoiceId: string): Promise<{ paid: boolean; amount: number; paymentId?: string }>;
}
```
- `QPAY_MODE=mock`: `/dev/qpay/[invoiceId]` хуудас ("Төлсөн" / "Цуцлах" товч) → жинхэнэ callback-ийг дуудна. Production build-д энэ route идэвхгүй.
- `sandbox` / `production`: QPay Merchant API v2 (`/v2/auth/token`, `/v2/invoice`, `/v2/payment/check`). Token-ыг хугацаа дуустал memory-д кэшлэнэ.

---

## 5. Нэвтрэлт

| Арга | Орчин | Тэмдэглэл |
|---|---|---|
| Имэйл + нууц үг | dev, staging (`AUTH_PASSWORD_ENABLED=true`) | Нууц үг сэргээх урсгал **хийхгүй**. Seed-ээр тестийн данснууд |
| Google | бүгд (env байвал) | |
| Facebook | бүгд (env байвал) | Data deletion callback: `/api/fb/data-deletion` |
| Имэйл OTP | бүгд | 6 оронтой, 10 мин, 5 оролдлого. Better Auth `emailOTP` plugin |

- **Account linking:** ижил баталгаажсан имэйлтэй бол нэг данс (Google, email OTP-г trusted гэж үзнэ).
- **In-app browser** (FBAN/FBAV/Messenger/Instagram UA): Google товчийг нууж, "Browser-т нээх" заавар (iOS: ⋯ → Safari-д нээх; Android: intent link) харуулна. FB болон OTP ажиллана.
- Нэвтэрмэгц "Би" байхгүй бол → `/onboarding`.
- Session: Better Auth DB session, 30 хоног.
- **Админ эрх:** `ADMIN_OWNER_EMAILS`, `ADMIN_EDITOR_EMAILS` (таслалаар). Owner = бүх эрх; Editor = зөвхөн контент (текст, импорт, орд/үеийн муж).

**Тестийн данснууд (seed, dev-д):** `owner@test.local`, `editor@test.local`, `user@test.local` (хүмүүстэй, 5,000₮ үлдэгдэлтэй), `minor@test.local` (16 настай). Нууц үг `.env`-ийн `SEED_PASSWORD`-оос.

---

## 6. Дэлгэцүүд

### 6.1 Бүтэц
Доод tab bar (4): **Нүүр · Хүмүүс · Зурхай · Би**. Header-т: лого + хэтэвчний үлдэгдэл чип `💰 3,500₮ +` (дарвал цэнэглэх sheet).

| Route | Дэлгэц |
|---|---|
| `/` | Landing (нэвтрээгүй): танилцуулга, бүтээгдэхүүнүүд, [Нэвтрэх]. Нэвтэрсэн бол → `/home` |
| `/login` | Google · Facebook · Имэйлээр (OTP) · (dev) нууц үг |
| `/onboarding` | Нэр → Төрсөн огноо (анхааруулгатай) → Хүйс (алгасаж болно) → Avatar → "Таны орд: Хилэнц" дэлгэц → "Хүн нэмэх үү?" |
| `/home` | Миний карт (avatar, нэр, орд), хүмүүсийн хэвтээ жагсаалт, санал болгох карт ("Ээжтэйгээ нийцлээ хараарай"), сүүлд авсан зурхайнууд |
| `/people` | Би + хүмүүсийн жагсаалт (avatar, нэр, харилцаа, орд), **+ Хүн нэмэх** |
| `/people/new` | Харилцаа → Avatar → Нэр, огноо, хүйс → (Урих) |
| `/people/[id]` | Мэдээлэл, орд; тухайн хүнд боломжтой бүтээгдэхүүнүүд (авсан = "Унших"); нийцэл → хоёр дахь хүн сонгох; засах (огноогүй), устгах, урих |
| `/readings` | Каталог (6 бүтээгдэхүүн) + таб **Миний зурхайнууд** (хүнээр/төрлөөр шүүх) |
| `/buy/[product]` | Хүн сонгох (шүүгдсэн) [+ шинэ] → нийцэлд 2 дахь хүн → Preview → **Баталгаажуулах sheet** ("1,000₮ хасагдана · Үлдэгдэл 3,500 → 2,500") |
| `/r/[purchaseId]` | Зурхай унших: гарчиг, хүн(үүс)ийн avatar, текст, (нийцэлд оноо + 2 хэсэг), [Хуваалцах], "Зөвхөн зугаа цэнгэлийн зорилготой" |
| `/wallet` | Үлдэгдэл, [Цэнэглэх], гүйлгээний түүх |
| `/me` | Профайл, 18+ баталгаажуулалт, нөхцөл/нууцлал, гарах, **данс устгах** |
| `/invite/[token]` | Урилга хүлээн авах (7-р хэсэг) |
| `/terms`, `/privacy` | Хуулийн хуудсууд |

### 6.2 Админ (`/admin`, desktop-д тохирсон байж болно)
| Route | Эрх | Үйлдэл |
|---|---|---|
| `/admin` | E/O | Хяналт (1 өдөр / 7 хоног / сар / 3 сар): хэрэглэгч, нэмэгдсэн хүн, шинэ бүртгэл, ARPPU, зарцуулалт/цэнэглэлт %, хэтэвчинд үлдсэн мөнгө; контентын бүрдэл (`366/366`, `1176/1176`…) |
| `/admin/business` | E/O | Бизнесийн тоо (ижил хугацааны товч, өмнөх үетэй харьцуулна): цэнэглэлт/зарцуулалтын график; цэнэглэлт (нийт дүн, тоо, төлөгч, анхны төлөгч, бонус, нэхэмжлэх→төлөлт %, зарагдсан нөхцөлөөр нь багцаар); зарцуулалт (бүтээгдэхүүнээр); үнэгүй preview → худалдан авалтын хөрвүүлэлт (`preview_views`) |
| `/admin/packages` | O | Цэнэглэх багц: дүн, бонус, эрэмбэ, идэвхтэй эсэх. Цэнэглэлт хийгдсэн багцыг устгахгүй (идэвхгүй болгоно) |
| `/admin/landing` | E/O | **Нүүр хуудасны CMS** (нэвтрээгүй `/`): хэсэг бүрийн текст, жишээ хүмүүс (нэр, төрсөн огноо, зураг) ба тэдний нийцлийн холбоос (тохиромжтой / анхаарах харилцаа — **оноо харуулахгүй**), бүтээгдэхүүний тайлбар/тэмдэг, FAQ, хэсгүүдийн дараалал/нуух, SEO. Засвар → **ноорог** (`page_drafts`, revision-оор зэрэг засварыг илрүүлнэ) → `/preview/landing` → **Нийтлэх** (`page_versions`, append-only, audit log) → түүхээс сэргээх (ноорог болж орно). Үнэ/багцыг каталогоос авна, текстэнд `{minPrice}` `{birthdayPrice}` `{synastryPrice}`. Хэсэг эвдэрвэл кодын анхны текст (`mn.ts`) харагдана |
| `/admin/content` | E/O | Бүтээгдэхүүн/хэсгээр текстийн жагсаалт, хайх, **дутуу түлхүүрүүд**, нэг текстийг засах, draft/published |
| `/admin/import` | E/O | Загвар татах → Excel upload → **Dry-run тайлан** (нэмэгдэх / шинэчлэгдэх / алдаатай мөр / дутуу түлхүүр) → [Импортлох] |
| `/admin/zodiac`, `/admin/periods` | E/O | Мужийг засах (давхцал/цоорхой шалгалттай) |
| `/admin/products` `/admin/products/[code]` | O | Шинэ бүтээгдэхүүн; нэр, тайлбар, үнэ, дүрс/өнгө, идэвхтэй, бүлэг, 18+, эрэмбэ; хэсэг (түлхүүрийн төрөл, эр/эм) ба дэд хэсэг (хэлбэр, үнэгүй, заавал, эрэмбэ, архив); бүрдэл, загвар/импорт руу холбоос |
| `/admin/users` `/admin/users/[id]` | O | Хайх, хэтэвч, гүйлгээ, худалдан авалт, **гар засвар (adjust)** шалтгаантай |
| `/admin/topups` | O | Цэнэглэлтийн жагсаалт, төлөв, QPay-ээс дахин шалгах товч |

---

## 7. Урилга
- Хүн нэмэх/хүний хуудаснаас: **[Линк хуулах]** (Web Share API → Messenger гэх мэт) эсвэл **[Имэйлээр урих]**.
- Токен: 32 байт random, DB-д SHA-256 hash, **7 хоног**, нэг удаагийн.
- `/invite/[token]`: "{Нэр} таныг {APP_NAME}-д урьж байна" → нэвтрэх/бүртгүүлэх → урилга хүлээн авах:
  - `persons.linked_user_id = шинэ хэрэглэгч`.
  - Урьсан хүний "Би" байхгүй бол onboarding-ийг **урьсан person-ийн нэр, огноогоор урьдчилан бөглөнө** (огноог өөрөө баталгаажуулна).
- **Үнэгүй харах эрх:** **2 хүнтэй** бүтээгдэхүүний (synastry гэх мэт) худалдан авалтын хоёр хүний аль нэг нь `linked_user_id = viewer` бол viewer тухайн уншлагыг үнэгүй уншина (1 хүнтэйд үгүй). "Надтай хийсэн нийцлүүд" хэсэгт харагдана.
- Холбогдсон хэрэглэгч "Намайг хасах" хийвэл `linked_user_id=null` ба урьсан хүнд тухайн person-ийг устгах санал харагдана.

---

## 8. Хуваалцах карт
- `/api/share/[purchaseId]?format=story|square` — `next/og` ImageResponse, 1080×1920 / 1080×1080.
- Агуулга: хоёр avatar, нэрс (эхний үсэг + нэрийн эхний хэсэг, хүсвэл нуух), орд, оноо (байвал), 1 өгүүлбэр ишлэл, `APP_NAME` + URL.
- **Кирилл фонтыг ImageResponse-д заавал ачаална** (default фонт кирилл харуулахгүй).
- Зөвхөн эзэмшигч болон үнэгүй харах эрхтэй хүн үүсгэнэ. Web Share API (файлаар) → fallback: татах.
- Худалдаж аваагүй зурхайн карт үүсгэхгүй.

---

## 9. Өгөгдлийн сан (Drizzle)

Better Auth өөрийн `user`, `session`, `account`, `verification` хүснэгтүүдийг үүсгэнэ. `user`-т нэмэлт талбар: `adult_confirmed_at timestamptz null`, `deleted_at`.

```ts
persons          id uuid pk, owner_user_id → user, is_self bool, relation enum, relation_label text null,
                 name text, gender enum default 'unspecified', birth_date date NOT NULL,
                 avatar_seed text, linked_user_id → user null, created_at, deleted_at null
                 UNIQUE(owner_user_id) WHERE is_self AND deleted_at IS NULL

zodiac_signs     code pk, name_mn, start_md char(5), end_md char(5), sort int
periods48        no int pk (1..48), start_md, end_md, label text null

products         code pk, name_mn, description, price bigint, person_count int (1|2),
                 allowed_groups text[], adult_only bool, is_active bool, sort int, icon, tint, created_at
product_parts    (product_code → products, code) pk, name_mn, key_type ('month_day'|'sign'|'period'|
                 'sign_pair'|'period_pair'|'sign_pair_ordered'), by_gender bool, sort, archived_at null
product_fields   (product_code, part_code, code) pk → product_parts, name_mn,
                 kind ('text'|'quote'|'cards'|'list'|'chips'|'alert'), is_free, required, sort, archived_at null

content_entries  id uuid pk, product_code → products, section text (= product_parts.code),
                 key text, title text, fields jsonb {field_code: text}, teaser text null, score int null,
                 status enum('draft','published'), updated_by → user, updated_at
                 UNIQUE(product_code, section, key), FK (product_code, section) → product_parts

wallets          user_id pk → user, balance bigint CHECK (balance >= 0), updated_at
wallet_entries   id, user_id, type enum('topup','bonus','purchase','refund','adjust'), amount bigint,
                 balance_after bigint, ref_type text, ref_id text, idempotency_key text UNIQUE,
                 note text null, created_by → user null, created_at

topups           id uuid pk, user_id, amount bigint, bonus bigint, status enum('pending','paid','expired','failed'),
                 provider text, invoice_id text UNIQUE, payment_id text null, paid_at, created_at

purchases        id uuid pk, user_id, product_code, price_paid bigint,
                 person_a_id → persons, person_b_id → persons null,
                 subject_key text, snapshot jsonb,   -- {persons:[{name,birthDate,gender,sign,period}], keys:{part_code: key}}
                 created_at
                 UNIQUE(user_id, product_code, subject_key)

invitations      id, person_id → persons, inviter_user_id, channel enum('link','email'), email null,
                 token_hash text UNIQUE, status enum('pending','accepted','revoked','expired'),
                 expires_at, accepted_by → user null, accepted_at

audit_logs       id, actor_id, action, entity, entity_id, data jsonb, created_at
```

**Данс устгах:** persons, invitations, session/account устгана; `purchases`, `topups`, `wallet_entries`-ийг санхүүгийн бүртгэлд үлдээж, `user` мөрийг нэр/имэйлгүй болгож (`deleted_at`) anonymize хийнэ.

---

## 10. Excel импорт

Загваруудыг `/admin/import`-оос татна (`exceljs`-ээр үүсгэнэ). Эхний мөр = толгой. Орд нь **монгол нэр эсвэл code**-оор байж болно (`Хилэнц` / `scorpio`).

Загвар бүтээгдэхүүний **хэсэг бүрт** автоматаар үүснэ (нэг хэсэгтэй бол `{code}.xlsx`, олон бол `{code}.{part}.xlsx`) + `periods48.xlsx`:

| Баганууд | Тайлбар |
|---|---|
| Түлхүүр | `month_day` (MM-DD) · `sign` · `period` (1–48) · `sign_a`+`sign_b` · `period_a`+`period_b` — хэсгийн түлхүүрийн төрлөөр, урьдчилан бөглөгдсөн |
| `gender` | Эр/эм тусдаа хэсэгт (`Эр`/`Эм`/`male`/`female`) |
| `title` | Заавал |
| `{field_code}` | Идэвхтэй дэд хэсэг бүрт нэг багана (толгой нь код эсвэл монгол нэр). Заавал дэд хэсэг хоосон бол алдаа |
| `teaser`, `score` | Заавал биш (≤ 500 тэмдэгт; 0–100) |
| `body` | Хуучин нэг баганат файл: `## Гарчиг` хэсгүүд дэд хэсгийн нэрээр тохирч, үлдсэн нь `general` руу. Дэд хэсгийн багана давуу |

`periods48.xlsx`: `no` · `start` (MM-DD) · `end` (MM-DD) · `label`(opt) — 48 мөр.

**Текстийн бичлэг:** энгийн текст (HTML/Markdown биш). `text`/`quote`: догол мөрийг хоосон мөрөөр тусгаарлана, `text`-д `## ` мөр = дэд гарчиг. `list`/`cards`: мөр бүр нэг зүйл (`• ` заавал биш); `chips`/`alert`: мөр эсвэл таслалаар. Импорт нь идэвхтэй дэд хэсгүүдийг солих ба архивлагдсан дэд хэсгийн хадгалсан текстийг хэвээр үлдээнэ.

**Хуучин сайтын контент:** 366 төрсөн өдөр (8 хэсэг → 8 дэд хэсэг), 1,176 үеийн нийцэл, 48 үеийн мужийг `scripts/legacy-to-xlsx.ts`-ээр дээрх загварт (`birthday.xlsx`, `synastry.period_pair.xlsx`, `periods48.xlsx`) хөрвүүлж `/admin/import`-оор оруулна (эх файл `OldDB/` — git-д орохгүй).

**Шалгалт (dry-run):** үл мэдэгдэх түлхүүр/хүйс, давхардал (A|B ба B|A = давхардал; чиглэлтэй хост тусдаа текст), хоосон заавал дэд хэсэг, огнооны формат, мужийн давхцал/цоорхой, дутуу түлхүүрүүдийн жагсаалт. Алдаатай мөртэй бол импортлохгүй (мөрийн дугаартай тайлан). Амжилттай бол нэг transaction-оор upsert, `status=published`, audit log.

> ⚠️ Хэрэглэгчийн жинхэнэ файлууд ирэхэд форматыг нь харж загварыг тааруулна (багана нэр, хуудасны бүтэц). Импортын parser-ийг тохируулгатай (column mapping) бичнэ.

---

## 11. Орчин ба env

```bash
APP_NAME="Зурхай"
APP_URL=http://localhost:3000            # prod: https://2-28-197-187.sslip.io → дараа жинхэнэ домэйн
DATABASE_URL=postgres://...
BETTER_AUTH_SECRET=
AUTH_PASSWORD_ENABLED=true               # prod: false
SEED_PASSWORD=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID= / FACEBOOK_CLIENT_SECRET=
EMAIL_TRANSPORT=smtp                     # smtp (Mailpit) | resend
SMTP_URL=smtp://localhost:1025
RESEND_API_KEY= / EMAIL_FROM=
QPAY_MODE=mock                           # mock | sandbox | production
QPAY_CLIENT_ID= / QPAY_CLIENT_SECRET= / QPAY_INVOICE_CODE= / QPAY_BASE_URL=
QPAY_CALLBACK_SECRET=
CRON_SECRET=
ADMIN_OWNER_EMAILS= / ADMIN_EDITOR_EMAILS=
```

**Production (сервер):** Ubuntu + Docker Compose: `app` (Next.js standalone), `db` (Postgres 16, volume), `caddy` (80/443, auto SSL). UFW: 22, 80, 443. Root биш `deploy` хэрэглэгч, SSH key only. Өдөр бүр `pg_dump` → 14 хоног хадгалах. Cron: host crontab → `curl` `/api/cron/qpay-check`. Deploy: GitHub Actions → GHCR image → SSH → `docker compose pull && up -d` → migration.

---

## 12. Чанарын шаардлага
- Lighthouse (mobile) Performance ≥ 90, Accessibility ≥ 90. Эхний ачаалал < 2 сек (4G).
- iPhone Safari, Android Chrome, FB/Messenger in-app browser дээр тестлэгдсэн.
- Rate limit: login/OTP (5/мин/IP), invoice үүсгэх (10/цаг/хэрэглэгч), import (Owner/Editor).
- Security headers (CSP, HSTS, X-Frame-Options), CSRF (Server Actions default), бүх ID нь UUID.
- Хуулийн хуудсууд: Үйлчилгээний нөхцөл, Нууцлалын бодлого (Хувь хүний мэдээлэл хамгаалах тухай хууль, 2021), "зөвхөн зугаа цэнгэлийн зорилготой" анхааруулга. Claude Code ноорог бичнэ → хуульчаар шалгуулна.
