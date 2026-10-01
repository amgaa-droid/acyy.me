import type { FieldKind, KeyType, ProductIconName, ProductTint, RelationGroup } from "@/lib/domain";
import { expectedPartKeys } from "@/server/content/keys";
import type { ProductDef } from "@/server/products";

/** Initial reference data (SPEC §2.4, §3). Editable later from the admin panel. */

export const ZODIAC_SIGNS = [
  { code: "aries", nameMn: "Хонь", startMd: "03-21", endMd: "04-19" },
  { code: "taurus", nameMn: "Үхэр", startMd: "04-20", endMd: "05-20" },
  { code: "gemini", nameMn: "Ихэр", startMd: "05-21", endMd: "06-20" },
  { code: "cancer", nameMn: "Мэлхий", startMd: "06-21", endMd: "07-22" },
  { code: "leo", nameMn: "Арслан", startMd: "07-23", endMd: "08-22" },
  { code: "virgo", nameMn: "Охин", startMd: "08-23", endMd: "09-22" },
  { code: "libra", nameMn: "Жинлүүр", startMd: "09-23", endMd: "10-22" },
  { code: "scorpio", nameMn: "Хилэнц", startMd: "10-23", endMd: "11-21" },
  { code: "sagittarius", nameMn: "Нум", startMd: "11-22", endMd: "12-21" },
  { code: "capricorn", nameMn: "Матар", startMd: "12-22", endMd: "01-19" },
  { code: "aquarius", nameMn: "Хумх", startMd: "01-20", endMd: "02-18" },
  { code: "pisces", nameMn: "Загас", startMd: "02-19", endMd: "03-20" },
].map((s, i) => ({ ...s, sort: i + 1 }));

const ALL_GROUPS: RelationGroup[] = ["self", "family", "romantic", "friend", "other"];

export type SeedField = {
  code: string;
  nameMn: string;
  kind: FieldKind;
  isFree?: boolean;
  required?: boolean;
};
export type SeedPart = {
  code: string;
  nameMn: string;
  keyType: KeyType;
  byGender?: boolean;
  fields: SeedField[];
};
export type SeedProduct = {
  code: string;
  nameMn: string;
  description: string;
  price: number;
  personCount: 1 | 2;
  allowedGroups: RelationGroup[];
  adultOnly: boolean;
  icon: ProductIconName;
  tint: ProductTint;
  parts: SeedPart[];
};

const GENERAL: SeedField = { code: "general", nameMn: "Ерөнхий", kind: "text", required: true };

/** One sign-keyed part with a single prose field — the shape of sign/sex/dating. */
const signPart = (nameMn: string): SeedPart => ({
  code: "main",
  nameMn,
  keyType: "sign",
  fields: [GENERAL],
});

/**
 * The launch catalogue (SPEC §3). Parts and fields match migration 0004, which set them up for
 * databases that already had these products; new products are created in /admin/products.
 */
export const PRODUCTS: SeedProduct[] = [
  {
    code: "birthday",
    nameMn: "Төрсөн өдрийн зурхай",
    description: "Таны төрсөн өдөр таны тухай юу өгүүлдэг вэ.",
    price: 2000,
    personCount: 1,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
    icon: "calendar",
    tint: "highlight",
    parts: [
      {
        code: "main",
        nameMn: "Төрсөн өдөр",
        keyType: "month_day",
        fields: [
          { code: "strengths", nameMn: "Давуу тал", kind: "list", isFree: true },
          { code: "weaknesses", nameMn: "Сул тал", kind: "list", isFree: true },
          { code: "general", nameMn: "Ерөнхий шинж", kind: "text", required: true },
          { code: "meditation", nameMn: "Бясалгах үг", kind: "quote" },
          { code: "advice", nameMn: "Зөвлөгөө", kind: "cards" },
          { code: "health", nameMn: "Эрүүл мэнд", kind: "text" },
          { code: "numerology", nameMn: "Тоон хэлээр", kind: "text" },
          { code: "tarot", nameMn: "Таро хөзөр", kind: "text" },
        ],
      },
    ],
  },
  {
    code: "sign",
    nameMn: "Ордны зурхай",
    description: "Ордын зан чанар, давуу болон сул тал.",
    price: 1000,
    personCount: 1,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
    icon: "sparkles",
    tint: "tint-1",
    parts: [signPart("Орд")],
  },
  {
    code: "love",
    nameMn: "Хайр дурлалын зурхай",
    description: "Хайр дурлал дахь зан төлөв, хүсэл тэмүүлэл.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic", "friend", "other"],
    adultOnly: false,
    icon: "heart",
    tint: "tint-2",
    // Sub-sections added by migration 0009.
    parts: [
      {
        code: "main",
        nameMn: "Орд",
        keyType: "sign",
        fields: [
          { ...GENERAL, nameMn: "Хайр сэтгэлийн зан төлөв" },
          { code: "first_impression", nameMn: "Анхны сэтгэгдэл", kind: "text" },
          { code: "attraction", nameMn: "Сэтгэл татах арга барил", kind: "text" },
          { code: "dating_style", nameMn: "Болзооны хэв маяг", kind: "text" },
          { code: "relationship", nameMn: "Харилцаанд хандах нь", kind: "text" },
        ],
      },
    ],
  },
  {
    code: "sex",
    nameMn: "Секс зурхай",
    description: "Дотно харилцаан дахь онцлог. Зөвхөн 18+.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic"],
    adultOnly: true,
    icon: "flame",
    tint: "dark",
    parts: [signPart("Орд")],
  },
  {
    code: "dating",
    nameMn: "Болзооны зурхай",
    description: "Болзоонд хэрхэн ханддаг, юу таалагддаг.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic", "other"],
    adultOnly: false,
    icon: "coffee",
    tint: "tint-3",
    parts: [signPart("Орд")],
  },
  {
    code: "synastry",
    nameMn: "Нийцлийн зурхай",
    description: "Хоёр хүний орд болон төрсөн үеийн нийцэл.",
    price: 1000,
    personCount: 2,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
    icon: "blend",
    tint: "nav",
    parts: [
      // 144 ordered texts (A→B); a reading shows both directions (migration 0008).
      {
        code: "sign_pair",
        nameMn: "Ордны нийцэл",
        keyType: "sign_pair_ordered",
        fields: [GENERAL],
      },
      {
        code: "period_pair",
        nameMn: "Төрсөн үеийн нийцэл",
        keyType: "period_pair",
        fields: [
          GENERAL,
          { code: "strengths", nameMn: "Давуу тал", kind: "list" },
          { code: "weaknesses", nameMn: "Сул тал", kind: "list" },
          { code: "good_for", nameMn: "Тохиромжтой харилцаа", kind: "chips" },
          { code: "caution_for", nameMn: "Анхаарах харилцаа", kind: "alert" },
        ],
      },
    ],
  },
];

/** Rows for products / product_parts / product_fields. */
export function catalogRows(list: SeedProduct[] = PRODUCTS) {
  return {
    products: list.map((p, i) => ({
      code: p.code,
      nameMn: p.nameMn,
      description: p.description,
      price: p.price,
      personCount: p.personCount,
      allowedGroups: p.allowedGroups,
      adultOnly: p.adultOnly,
      icon: p.icon,
      tint: p.tint,
      sort: i + 1,
    })),
    parts: list.flatMap((p) =>
      p.parts.map((part, i) => ({
        productCode: p.code,
        code: part.code,
        nameMn: part.nameMn,
        keyType: part.keyType,
        byGender: part.byGender ?? false,
        sort: i + 1,
      })),
    ),
    fields: list.flatMap((p) =>
      p.parts.flatMap((part) =>
        part.fields.map((f, i) => ({
          productCode: p.code,
          partCode: part.code,
          code: f.code,
          nameMn: f.nameMn,
          kind: f.kind,
          isFree: f.isFree ?? false,
          required: f.required ?? false,
          sort: i + 1,
        })),
      ),
    ),
  };
}

/** The seed catalogue as loaded product definitions (no DB) — for scripts and tests. */
export function seedProductDefs(list: SeedProduct[] = PRODUCTS): ProductDef[] {
  const rows = catalogRows(list);
  return rows.products.map((p) => ({
    ...p,
    isActive: true,
    createdAt: new Date(0),
    parts: rows.parts
      .filter((part) => part.productCode === p.code)
      .map((part) => ({
        ...part,
        archivedAt: null,
        fields: rows.fields
          .filter((f) => f.productCode === p.code && f.partCode === part.code)
          .map((f) => ({ ...f, archivedAt: null })),
      })),
  }));
}

/** Multi-sentence placeholder so the 2-sentence preview can be exercised before real texts arrive. */
export function placeholderEntry(productName: string, key: string) {
  return {
    title: `[Placeholder] ${productName} — ${key}`,
    fields: {
      general: [
        `[Placeholder] ${productName}, түлхүүр: ${key}.`,
        "Энэ бол жинхэнэ текст ирэх хүртэлх түр бичвэр юм!",
        "Гурав дахь өгүүлбэр нь зөвхөн худалдан авсны дараа харагдана.",
        "Админ Excel-ээр жинхэнэ текстийг импортлоход энэ бичвэр солигдоно.",
      ].join(" "),
    },
  };
}

/** Every placeholder content row (1,668), published. */
export function placeholderContentRows() {
  const ref = { signCodes: ZODIAC_SIGNS.map((s) => s.code), periodCount: 48 };
  return PRODUCTS.flatMap((product) =>
    product.parts.flatMap((part) =>
      expectedPartKeys({ keyType: part.keyType, byGender: part.byGender ?? false }, ref).map(
        (key) => ({
          productCode: product.code,
          section: part.code,
          key,
          status: "published" as const,
          ...placeholderEntry(product.nameMn, key),
        }),
      ),
    ),
  );
}
