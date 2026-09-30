import type { Relation } from "@/lib/domain";

/** All user-facing strings (Mongolian). Keep UI copy here so i18n can be added later. */
export const mn = {
  common: {
    loading: "Ачаалж байна…",
    save: "Хадгалах",
    cancel: "Болих",
    close: "Хаах",
    next: "Үргэлжлүүлэх",
    back: "Буцах",
    currency: "₮",
    entertainmentOnly: "Зөвхөн зугаа цэнгэлийн зорилготой.",
  },
  tabs: {
    home: "Нүүр",
    people: "Хүмүүс",
    readings: "Зурхай",
    me: "Би",
  },
  header: {
    wallet: "Хэтэвч",
    topUp: "Цэнэглэх",
  },
  landing: {
    tagline: "Өөрийгөө болон дотны хүмүүсээ оддын хэлээр таньж мэд.",
    login: "Нэвтрэх",
    products: "Зурхайнууд",
  },
  home: {
    title: "Нүүр",
    empty: "Удахгүй энд таны зурхай, хүмүүс харагдана.",
  },
  people: {
    title: "Хүмүүс",
    add: "Хүн нэмэх",
    empty: "Ээж, найз, хайртаа нэмээд нийцлээ хараарай.",
  },
  readings: {
    title: "Зурхай",
    catalog: "Каталог",
    mine: "Миний зурхайнууд",
  },
  me: {
    title: "Би",
    appearance: "Өнгөний горим",
    appearanceHint: "Утасны dark mode-ыг автоматаар дагана.",
  },
  themes: {
    cosmic: { name: "Cosmic", description: "Зааны яс, индиго, пастел" },
    white: { name: "White", description: "Цагаан хар, minimal" },
  },
  hero: {
    yourSign: "Таны орд",
  },
  wallet: {
    title: "Хэтэвч",
    topUpSheetTitle: "Хэтэвч цэнэглэх",
    topUpSoon: "Цэнэглэлт удахгүй нэмэгдэнэ.",
  },
  datePicker: {
    year: "Он",
    month: "Сар",
    day: "Өдөр",
    months: [
      "1-р сар",
      "2-р сар",
      "3-р сар",
      "4-р сар",
      "5-р сар",
      "6-р сар",
      "7-р сар",
      "8-р сар",
      "9-р сар",
      "10-р сар",
      "11-р сар",
      "12-р сар",
    ],
    immutableWarning: "Энэ огноог дараа нь өөрчлөх боломжгүй.",
  },
  relations: {
    self: "Би",
    mother: "Ээж",
    father: "Аав",
    older_brother: "Ах",
    older_sister: "Эгч",
    younger_sibling: "Дүү",
    child: "Хүүхэд",
    partner: "Хайрт",
    crush: "Краш",
    friend: "Найз",
    coworker: "Хамт ажиллагч",
    other: "Бусад",
  } satisfies Record<Relation, string>,
} as const;

export function formatMnt(amount: number): string {
  return `${new Intl.NumberFormat("en-US").format(amount)}${mn.common.currency}`;
}
