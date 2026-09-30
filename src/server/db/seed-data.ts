import type { ProductCode, RelationGroup } from "@/lib/domain";

/** Initial reference data (SPEC §2.4, §3). Editable later from the admin panel. */

export const ZODIAC_SIGNS = [
  { code: "aries", nameMn: "Хуц", startMd: "03-21", endMd: "04-19" },
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

export const PRODUCTS: {
  code: ProductCode;
  nameMn: string;
  description: string;
  price: number;
  personCount: 1 | 2;
  allowedGroups: RelationGroup[];
  adultOnly: boolean;
}[] = [
  {
    code: "birthday",
    nameMn: "Төрсөн өдрийн зурхай",
    description: "Таны төрсөн өдөр таны тухай юу өгүүлдэг вэ.",
    price: 2000,
    personCount: 1,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
  },
  {
    code: "sign",
    nameMn: "Ордны зурхай",
    description: "Ордын зан чанар, давуу болон сул тал.",
    price: 1000,
    personCount: 1,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
  },
  {
    code: "love",
    nameMn: "Хайр дурлалын зурхай",
    description: "Хайр дурлал дахь зан төлөв, хүсэл тэмүүлэл.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic", "friend", "other"],
    adultOnly: false,
  },
  {
    code: "sex",
    nameMn: "Секс зурхай",
    description: "Дотно харилцаан дахь онцлог. Зөвхөн 18+.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic"],
    adultOnly: true,
  },
  {
    code: "dating",
    nameMn: "Болзооны зурхай",
    description: "Болзоонд хэрхэн ханддаг, юу таалагддаг.",
    price: 1000,
    personCount: 1,
    allowedGroups: ["self", "romantic", "other"],
    adultOnly: false,
  },
  {
    code: "synastry",
    nameMn: "Нийцлийн зурхай",
    description: "Хоёр хүний орд болон төрсөн үеийн нийцэл.",
    price: 1000,
    personCount: 2,
    allowedGroups: ALL_GROUPS,
    adultOnly: false,
  },
];

/** Multi-sentence placeholder so the 2-sentence preview can be exercised before real texts arrive. */
export function placeholderEntry(productName: string, key: string) {
  return {
    title: `[Placeholder] ${productName} — ${key}`,
    body: [
      `[Placeholder] ${productName}, түлхүүр: ${key}.`,
      "Энэ бол жинхэнэ текст ирэх хүртэлх түр бичвэр юм!",
      "Гурав дахь өгүүлбэр нь зөвхөн худалдан авсны дараа харагдана.",
      "Админ Excel-ээр жинхэнэ текстийг импортлоход энэ бичвэр солигдоно.",
    ].join(" "),
  };
}
