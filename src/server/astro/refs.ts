import { asc } from "drizzle-orm";

import type { AppDb } from "@/server/db/types";
import { periods48, zodiacSigns } from "@/server/db/schema";
import { getPeriod } from "./period48";
import { getSign } from "./zodiac";

export type AstroRefs = {
  signs: (typeof zodiacSigns.$inferSelect)[];
  periods: (typeof periods48.$inferSelect)[];
};

/** Reads the sign and period tables (small; admins can edit them). */
export async function loadAstroRefs(db: AppDb): Promise<AstroRefs> {
  const [signs, periods] = await Promise.all([
    db.select().from(zodiacSigns).orderBy(asc(zodiacSigns.sort)),
    db.select().from(periods48).orderBy(asc(periods48.no)),
  ]);
  return { signs, periods };
}

export function describeBirthDate(birthDate: string, refs: AstroRefs) {
  const sign = getSign(birthDate, refs.signs);
  const period = getPeriod(birthDate, refs.periods);
  return {
    sign: { code: sign.code, nameMn: sign.nameMn, startMd: sign.startMd, endMd: sign.endMd },
    period: { no: period.no, startMd: period.startMd, endMd: period.endMd },
  };
}
