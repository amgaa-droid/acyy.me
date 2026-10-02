import { MIN_BIRTH_YEAR } from "@/lib/birth-date";
import type { Gender, Relation } from "@/lib/domain";
import type { SqlRow } from "./mssql";

/**
 * Old acyy.me accounts → new-app accounts (pure planning, no DB). Scope, decided with the owner:
 * users with a Facebook login who paid for at least one reading or still hold a balance.
 * - Identity: the old Facebook id (same Facebook app → same app-scoped id), plus the old email.
 * - Paid birthday readings: acyyUserAction "Payment Completed" (≥ 1,000₮).
 * - Paid compatibility readings: acyyRelation with CompletedDate (two actions = two people).
 * - People have no names on the old site: the relation label ("Нөхөр") or "Хүн · 1990.05.12";
 *   nobody is made "Би" — the user picks themself on first sign-in.
 * - Balance: Users.CurrentPoint (matches the old ledger for every user).
 */

export type LegacyTables = {
  users: SqlRow[];
  logins: SqlRow[];
  actions: SqlRow[];
  relations: SqlRow[];
  charges: SqlRow[];
};

export type PersonPlan = {
  key: string;
  name: string;
  relation: Exclude<Relation, "self">;
  relationLabel: string | null;
  gender: Gender;
  birthDate: string;
};

export type PurchasePlan = {
  product: "birthday" | "synastry";
  personKeys: string[];
  pricePaid: number;
  createdAt: string;
  legacyRef: string;
};

export type UserPlan = {
  legacyUserId: number;
  facebookId: string;
  email: string;
  name: string;
  createdAt: string | null;
  balance: number;
  people: PersonPlan[];
  purchases: PurchasePlan[];
};

export type SkipReason =
  "no_facebook" | "duplicate_facebook_id" | "duplicate_email" | "invalid_birth_date";

export type LegacyPlan = {
  users: UserPlan[];
  skipped: { reason: SkipReason; legacyUserId: number; ref?: string }[];
};

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const num = (v: unknown) => (typeof v === "number" ? v : Number(v) || 0);
const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

/** "1990-05-12T00:00:00" → "1990-05-12", or null outside 1900…today. */
export function legacyBirthDate(raw: unknown, today: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(str(raw));
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (Number(m[1]) < MIN_BIRTH_YEAR || date > today) return null;
  return date;
}

const DOTTED = (date: string) => date.replaceAll("-", ".");

/** acyyRelationType ids with a meaning (11–24 are icon slots, always with a custom label). */
const RELATION_TYPES: Record<
  number,
  { relation: Exclude<Relation, "self">; name: string; gender: Gender; self?: true }
> = {
  1: { relation: "other", name: "Би", gender: "male", self: true },
  2: { relation: "other", name: "Би", gender: "female", self: true },
  3: { relation: "father", name: "Аав", gender: "male" },
  4: { relation: "mother", name: "Ээж", gender: "female" },
  5: { relation: "older_brother", name: "Ах", gender: "male" },
  6: { relation: "older_sister", name: "Эгч", gender: "female" },
  7: { relation: "friend", name: "Найз", gender: "unspecified" },
  8: { relation: "partner", name: "Найз залуу", gender: "male" },
  9: { relation: "partner", name: "Найз охин", gender: "female" },
  10: { relation: "other", name: "Бусад", gender: "unspecified" },
};

const SELF_WORDS = new Set(["би", "bi", "b", "өөрөө", "өөрийн", "миний", "me", "би өөрөө"]);
const EXACT: Record<string, Exclude<Relation, "self">> = {
  ээж: "mother",
  аав: "father",
  ах: "older_brother",
  эгч: "older_sister",
  дүү: "younger_sibling",
  хүү: "child",
  охин: "child",
  хүүхэд: "child",
  найз: "friend",
  краш: "crush",
  crush: "crush",
};
const CONTAINS: [string, Exclude<Relation, "self">][] = [
  ["нөхөр", "partner"],
  ["эхнэр", "partner"],
  ["найз залуу", "partner"],
  ["найз охин", "partner"],
  ["хайр", "partner"],
  ["хань", "partner"],
  ["краш", "crush"],
  ["хамт ажил", "coworker"],
  ["ажлын", "coworker"],
];

/** A legacy person's relation, label and display name from the relation type and free text. */
export function legacyRelation(
  relationTypeId: number | null,
  customLabel: string,
): Omit<PersonPlan, "key" | "birthDate"> & { labelKey: string } {
  const label = collapse(customLabel);
  const lower = label.toLocaleLowerCase("mn");
  const type = relationTypeId ? RELATION_TYPES[relationTypeId] : undefined;

  if (SELF_WORDS.has(lower) || (!label && type?.self)) {
    return {
      relation: "other",
      relationLabel: "Би",
      name: "Би",
      gender: type?.gender ?? "unspecified",
      labelKey: "би",
    };
  }
  if (!label) {
    if (!type)
      return {
        relation: "other",
        relationLabel: "Хүн",
        name: "",
        gender: "unspecified",
        labelKey: "",
      };
    return {
      relation: type.relation,
      relationLabel: type.relation === "other" ? type.name : null,
      name: type.name,
      gender: type.gender,
      labelKey: `rt${relationTypeId}`,
    };
  }
  const relation =
    EXACT[lower] ??
    CONTAINS.find(([word]) => lower.includes(word))?.[1] ??
    (type && type.relation !== "other" ? type.relation : "other");
  return {
    relation,
    relationLabel: relation === "other" ? label.slice(0, 20).trim() : null,
    name: label.slice(0, 40).trim(),
    gender: type && !type.self ? type.gender : "unspecified",
    labelKey: lower,
  };
}

export function legacyPerson(action: SqlRow, today: string): PersonPlan | null {
  const birthDate = legacyBirthDate(action.birthday, today);
  if (!birthDate) return null;
  const rel = legacyRelation(
    action.RelationTypeID == null ? null : num(action.RelationTypeID),
    str(action.CustomRelationType),
  );
  return {
    key: `${birthDate}|${rel.labelKey}`,
    name: rel.name || `Хүн · ${DOTTED(birthDate)}`,
    relation: rel.relation,
    relationLabel: rel.relationLabel,
    gender: rel.gender,
    birthDate,
  };
}

export const normalizeEmail = (raw: unknown) => str(raw).trim().toLowerCase();

/** Placeholder address for a Facebook account that has no email (see src/server/auth). */
export const facebookPlaceholderEmail = (facebookId: string) => `fb-${facebookId}@facebook.invalid`;

const isPaidAction = (a: SqlRow) => a.Status === "Payment Completed" && num(a.TotalPayed) >= 1000;

export function planLegacyUsers(t: LegacyTables, today: string): LegacyPlan {
  const skipped: LegacyPlan["skipped"] = [];

  // Facebook id per user; an id shared by two users is ambiguous → neither gets it.
  const fbOwners = new Map<string, string[]>();
  for (const l of t.logins) {
    if (str(l.LoginProvider).toLowerCase() !== "facebook") continue;
    const key = str(l.ProviderKey);
    fbOwners.set(key, [...(fbOwners.get(key) ?? []), str(l.UserId)]);
  }
  const fbOf = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const [fb, owners] of fbOwners) {
    if (owners.length === 1) fbOf.set(owners[0], fb);
    else owners.forEach((o) => ambiguous.add(o));
  }

  const actionsById = new Map(t.actions.map((a) => [num(a.acyyUserActionID), a]));
  const chargeValue = new Map(t.charges.map((c) => [num(c.acyyChargeHistoryID), num(c.Value)]));
  const paidActions = new Map<string, SqlRow[]>();
  for (const a of t.actions) {
    if (!isPaidAction(a)) continue;
    const owner = str(a.UserID);
    paidActions.set(owner, [...(paidActions.get(owner) ?? []), a]);
  }
  const paidRelations = new Map<number, SqlRow[]>();
  for (const r of t.relations) {
    if (!r.CompletedDate) continue;
    const owner = num(r.UserID);
    paidRelations.set(owner, [...(paidRelations.get(owner) ?? []), r]);
  }

  const users: UserPlan[] = [];
  const emails = new Map<string, number>();
  for (const u of t.users) {
    const guid = str(u.RowGUID);
    const legacyUserId = num(u.UserID);
    const balance = Math.max(0, num(u.CurrentPoint));
    const actions = paidActions.get(guid) ?? [];
    const relations = paidRelations.get(legacyUserId) ?? [];
    if (actions.length === 0 && relations.length === 0 && balance === 0) continue;

    const facebookId = fbOf.get(guid);
    if (!facebookId) {
      skipped.push({
        reason: ambiguous.has(guid) ? "duplicate_facebook_id" : "no_facebook",
        legacyUserId,
      });
      continue;
    }

    const people = new Map<string, PersonPlan>();
    const purchases: PurchasePlan[] = [];
    const addPerson = (p: PersonPlan) => {
      if (!people.has(p.key)) people.set(p.key, p);
      return p.key;
    };

    for (const a of actions) {
      const p = legacyPerson(a, today);
      if (!p) {
        skipped.push({
          reason: "invalid_birth_date",
          legacyUserId,
          ref: `action:${a.acyyUserActionID}`,
        });
        continue;
      }
      purchases.push({
        product: "birthday",
        personKeys: [addPerson(p)],
        pricePaid: num(a.TotalPayed),
        createdAt: str(a.CompleteDate || a.inDate),
        legacyRef: `action:${a.acyyUserActionID}`,
      });
    }
    for (const r of relations) {
      const ref = `relation:${r.acyyRelationID}`;
      const a = actionsById.get(num(r.FirstActionID));
      const b = actionsById.get(num(r.SecondActionID));
      const pa = a && legacyPerson(a, today);
      const pb = b && legacyPerson(b, today);
      if (!pa || !pb) {
        skipped.push({ reason: "invalid_birth_date", legacyUserId, ref });
        continue;
      }
      // Two people with the same date and label (e.g. twins, or two unnamed searches):
      // keep them apart so the pair still has two different people.
      if (pb.key === pa.key) pb.key = `${pb.key}#2`;
      purchases.push({
        product: "synastry",
        personKeys: [addPerson(pa), addPerson(pb)],
        pricePaid: chargeValue.get(num(r.ChargeHistoryID)) ?? 1000,
        createdAt: str(r.CompletedDate),
        legacyRef: ref,
      });
    }

    const email = normalizeEmail(u.Email) || facebookPlaceholderEmail(facebookId);
    if (emails.has(email)) {
      skipped.push({ reason: "duplicate_email", legacyUserId, ref: `user:${emails.get(email)}` });
      continue;
    }
    emails.set(email, legacyUserId);

    const fullName = collapse(`${str(u.FirstName)} ${str(u.LastName)}`);
    users.push({
      legacyUserId,
      facebookId,
      email,
      name: fullName || email.split("@")[0] || "Хэрэглэгч",
      createdAt: str(u.DateInfo_CreatedDate) || null,
      balance,
      people: [...people.values()],
      purchases,
    });
  }
  return { users, skipped };
}
