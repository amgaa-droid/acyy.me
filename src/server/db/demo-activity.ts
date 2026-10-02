import { and, eq, like } from "drizzle-orm";

import { AVATAR_SEEDS } from "@/lib/avatar-seeds";
import type { Relation } from "@/lib/domain";
import { listActiveProducts } from "@/server/catalog";
import { createPerson, createSelf, type Person } from "@/server/persons";
import { recordPreviewView } from "@/server/preview-views";
import { preparePurchase, purchase } from "@/server/purchase";
import { MockQPayProvider } from "@/server/qpay/mock";
import { listActivePackages, type PackageOption } from "@/server/topup-packages";
import { createTopup, settleTopup } from "@/server/topups";
import { getBalance } from "@/server/wallet";

import { deleteUsersAndData } from "./dev-cleanup";
import { persons, purchases, topups, user, walletEntries } from "./schema";
import type { AppDb } from "./types";

/**
 * Demo activity for the admin dashboard (dev only): `pnpm db:seed:demo`.
 * Users sign up over the last N days, add people, browse free previews, top up through the
 * real QPay flow (mock provider) and buy through the real purchase() — so the wallet ledger is
 * exactly what production would write. Only timestamps are moved back afterwards.
 * Everything belongs to `demo-*@demo.test` users, so `resetDemoActivity` can remove it.
 */

const DEMO_EMAIL_DOMAIN = "demo.test";
const DEMO_EMAIL_LIKE = `demo-%@${DEMO_EMAIL_DOMAIN}`;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Small seeded PRNG (mulberry32) so a given seed always produces the same data. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)],
    chance: (p: number) => next() < p,
    /** Index by weight. */
    weighted: (weights: number[]) => {
      let r = next() * weights.reduce((n, w) => n + w, 0);
      for (let i = 0; i < weights.length; i++) if ((r -= weights[i]) < 0) return i;
      return weights.length - 1;
    },
  };
}
type Rng = ReturnType<typeof rng>;

const FIRST_NAMES = [
  "Анар",
  "Болд",
  "Номин",
  "Тэмүүлэн",
  "Сарнай",
  "Ганбаат",
  "Энхжин",
  "Мөнх",
  "Солонго",
  "Бат-Эрдэнэ",
  "Хулан",
  "Тэлмүүн",
  "Оюун",
  "Дөлгөөн",
  "Нандин",
  "Төгөлдөр",
  "Ариунаа",
  "Билгүүн",
  "Цэцэг",
  "Жавхлан",
];
const OTHER_RELATIONS: Exclude<Relation, "self">[] = [
  "mother",
  "father",
  "partner",
  "crush",
  "friend",
  "coworker",
  "older_sister",
];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const birthDate = (r: Rng, minAge: number, maxAge: number, now: Date) =>
  iso(new Date(now.getTime() - (r.int(minAge, maxAge) * 365 + r.int(0, 364)) * DAY));

/** Package weights: the middle packages sell best. */
const packageWeights = (n: number) =>
  Array.from({ length: n }, (_, i) => (n <= 2 ? 1 : i === 0 ? 2 : i === n - 1 ? 1.5 : 3.5));

type DemoOptions = { users?: number; days?: number; seed?: number; now?: Date };
type DemoSummary = {
  users: number;
  topups: number;
  abandoned: number;
  purchases: number;
  previews: number;
};

export async function demoUserCount(db: AppDb) {
  const rows = await db.select({ id: user.id }).from(user).where(like(user.email, DEMO_EMAIL_LIKE));
  return rows.length;
}

export async function seedDemoActivity(db: AppDb, opts: DemoOptions = {}): Promise<DemoSummary> {
  const { users = 80, days = 90, seed = 42 } = opts;
  const now = opts.now ?? new Date();
  const r = rng(seed);
  const qpay = new MockQPayProvider("http://localhost:3000");
  const [packages, products] = await Promise.all([listActivePackages(db), listActiveProducts(db)]);
  if (!packages.length) throw new Error("No active top-up packages.");
  if (!products.length) throw new Error("No active products.");
  const cheapest = Math.min(...products.map((p) => p.price));
  const summary: DemoSummary = { users: 0, topups: 0, abandoned: 0, purchases: 0, previews: 0 };
  const latest = now.getTime() - 5 * MIN;
  const at = (t: number) => new Date(Math.min(t, latest));

  for (let i = 1; i <= users; i++) {
    // Signups skew recent (the app is growing).
    const signup = now.getTime() - Math.pow(r.next(), 1.6) * days * DAY;
    const name = r.pick(FIRST_NAMES);
    const [u] = await db
      .insert(user)
      .values({
        name,
        email: `demo-${String(i).padStart(3, "0")}@${DEMO_EMAIL_DOMAIN}`,
        emailVerified: true,
        adultConfirmedAt: r.chance(0.7) ? at(signup) : null,
        createdAt: at(signup),
      })
      .returning();
    summary.users++;

    const people: Person[] = [
      await createSelf(db, u.id, {
        name,
        birthDate: birthDate(r, 18, 45, now),
        gender: r.pick(["male", "female"] as const),
        avatarSeed: r.pick(AVATAR_SEEDS),
      }),
    ];
    for (let k = r.int(1, 3); k > 0; k--) {
      people.push(
        await createPerson(db, u.id, {
          name: r.pick(FIRST_NAMES),
          birthDate: birthDate(r, 18, 60, now),
          gender: r.pick(["male", "female"] as const),
          avatarSeed: r.pick(AVATAR_SEEDS),
          relation: r.pick(OTHER_RELATIONS),
        }),
      );
    }
    await db
      .update(persons)
      .set({ createdAt: at(signup + 2 * MIN) })
      .where(eq(persons.ownerUserId, u.id));

    let t = signup + 10 * MIN;

    /** Opens a random product's preview; returns the purchase input if eligible. */
    const browse = async () => {
      const product = r.pick(products);
      const ids =
        product.personCount === 1
          ? [r.pick(people).id]
          : [people[0].id, r.pick(people.slice(1)).id];
      try {
        const prepared = await preparePurchase(db, u.id, product.code, ids);
        await recordPreviewView(
          db,
          { userId: u.id, productCode: product.code, subjectKey: prepared.subject },
          at(t),
        );
        summary.previews++;
        return { productCode: product.code, personIds: ids, price: product.price };
      } catch {
        return null; // not eligible / gender needed / product unavailable — skip
      }
    };

    const buy = async (input: { productCode: string; personIds: string[] }) => {
      try {
        const res = await purchase(db, { userId: u.id, ...input });
        if (res.alreadyOwned) return;
        await db
          .update(purchases)
          .set({ createdAt: at(t) })
          .where(eq(purchases.id, res.purchase.id));
        await db
          .update(walletEntries)
          .set({ createdAt: at(t) })
          .where(eq(walletEntries.refId, res.purchase.id));
        summary.purchases++;
      } catch {
        // content missing / insufficient funds — skip
      }
    };

    const topUp = async () => {
      const pkg: PackageOption = packages[r.weighted(packageWeights(packages.length))];
      const topup = await createTopup(db, qpay, {
        userId: u.id,
        offer: { packageId: pkg.id, amount: pkg.amount, bonus: pkg.bonus },
        appUrl: "http://localhost:3000",
        callbackSecret: "demo",
        description: "Demo",
      });
      const created = at(t);
      if (r.chance(0.15)) {
        // Opened the invoice, never paid → expired by the cron.
        await db
          .update(topups)
          .set({ status: "expired", createdAt: created })
          .where(eq(topups.id, topup.id));
        summary.abandoned++;
        return false;
      }
      qpay.markPaid(topup.invoiceId!);
      const paidAt = at(t + r.int(1, 4) * MIN);
      await settleTopup(db, qpay, topup.id, { source: "callback", now: paidAt });
      await db.update(topups).set({ createdAt: created }).where(eq(topups.id, topup.id));
      await db
        .update(walletEntries)
        .set({ createdAt: paidAt })
        .where(and(eq(walletEntries.refType, "topup"), eq(walletEntries.refId, topup.id)));
      t += 5 * MIN;
      summary.topups++;
      return true;
    };

    // First visit: a few free previews.
    let wanted = null;
    for (let k = r.int(1, 4); k > 0; k--) {
      wanted = (await browse()) ?? wanted;
      t += r.int(1, 8) * MIN;
    }

    // ~60% become payers, usually within a few days.
    if (!r.chance(0.6)) continue;
    t += r.chance(0.5) ? r.int(5, 60) * MIN : r.int(1, 72) * HOUR;

    for (let round = 0; round < 4 && t < latest; round++) {
      if (!(await topUp())) {
        if (!r.chance(0.5)) break; // gave up, or retries right away
        t += r.int(2, 30) * MIN;
        continue;
      }
      if (wanted) {
        await buy(wanted);
        t += r.int(1, 5) * MIN;
      }
      // Spend the balance: each preview turns into a purchase about half the time.
      while (t < latest && (await getBalance(db, u.id)) >= cheapest && r.chance(0.85)) {
        t += r.int(2, 600) * MIN;
        const next = await browse();
        if (next && next.price > 0 && r.chance(0.55)) {
          t += r.int(1, 10) * MIN;
          await buy(next);
        }
      }
      // Some come back and top up again later.
      if (!r.chance(0.35)) break;
      t += r.int(2, 25) * DAY;
      wanted = null;
    }
  }
  return summary;
}

/** Removes every demo user and everything they own (dev only). */
export async function resetDemoActivity(db: AppDb): Promise<number> {
  const rows = await db.select({ id: user.id }).from(user).where(like(user.email, DEMO_EMAIL_LIKE));
  return deleteUsersAndData(
    db,
    rows.map((u) => u.id),
  );
}
