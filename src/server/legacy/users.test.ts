import { describe, expect, it } from "vitest";

import type { SqlRow } from "./mssql";
import {
  facebookPlaceholderEmail,
  legacyBirthDate,
  legacyPerson,
  legacyRelation,
  planLegacyUsers,
  type LegacyTables,
} from "./users";

const TODAY = "2026-10-03";

describe("legacyBirthDate", () => {
  it("keeps the date part within 1900…today", () => {
    expect(legacyBirthDate("1990-05-12T00:00:00.000", TODAY)).toBe("1990-05-12");
    expect(legacyBirthDate("2000-02-29T00:00:00", TODAY)).toBe("2000-02-29");
    expect(legacyBirthDate("1899-12-31T00:00:00", TODAY)).toBeNull();
    expect(legacyBirthDate("2030-01-01T00:00:00", TODAY)).toBeNull();
    expect(legacyBirthDate(null, TODAY)).toBeNull();
  });
});

describe("legacyRelation", () => {
  it("maps known relation types when there's no label", () => {
    expect(legacyRelation(4, "")).toMatchObject({
      relation: "mother",
      name: "Ээж",
      relationLabel: null,
    });
    expect(legacyRelation(9, "")).toMatchObject({ relation: "partner", gender: "female" });
    expect(legacyRelation(10, "")).toMatchObject({ relation: "other", relationLabel: "Бусад" });
    expect(legacyRelation(null, "")).toMatchObject({ relation: "other", name: "" });
  });

  it("treats 'Би' (any spelling) and the self types as the user — but never as self", () => {
    for (const label of ["Би", "би", " Bi ", "Өөрөө"]) {
      expect(legacyRelation(24, label)).toMatchObject({
        relation: "other",
        relationLabel: "Би",
        name: "Би",
        labelKey: "би",
      });
    }
    expect(legacyRelation(2, "")).toMatchObject({ name: "Би", gender: "female" });
  });

  it("reads free-text labels", () => {
    expect(legacyRelation(24, "Нөхөр")).toMatchObject({ relation: "partner", name: "Нөхөр" });
    expect(legacyRelation(24, "найз залуу")).toMatchObject({ relation: "partner" });
    expect(legacyRelation(24, "Найз")).toMatchObject({ relation: "friend" });
    expect(legacyRelation(23, "Краш")).toMatchObject({ relation: "crush" });
    expect(legacyRelation(24, "Хүү")).toMatchObject({ relation: "child" });
    expect(legacyRelation(24, "Багш  минь")).toMatchObject({
      relation: "other",
      relationLabel: "Багш минь",
      name: "Багш минь",
    });
  });

  it("trims long labels to the column limits", () => {
    const r = legacyRelation(24, "а".repeat(50));
    expect(r.relationLabel).toHaveLength(20);
    expect(r.name).toHaveLength(40);
  });

  it("an unknown label keeps a known relation type", () => {
    expect(legacyRelation(4, "Ээжий")).toMatchObject({ relation: "mother", name: "Ээжий" });
  });
});

describe("legacyPerson", () => {
  it("names unlabelled people by their birth date", () => {
    expect(legacyPerson({ birthday: "1990-05-12T00:00:00" }, TODAY)).toMatchObject({
      key: "1990-05-12|",
      name: "Хүн · 1990.05.12",
      relation: "other",
      relationLabel: "Хүн",
    });
  });
});

// ---------- planLegacyUsers ----------

const guid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const u = (id: number, extra: SqlRow = {}): SqlRow => ({
  UserID: id,
  RowGUID: guid(id),
  Email: ` User${id}@Gmail.com `,
  FirstName: null,
  LastName: null,
  CurrentPoint: 0,
  DateInfo_CreatedDate: "2020-01-01T00:00:00.000",
  ...extra,
});
const fb = (id: number, key = `10${id}`): SqlRow => ({
  LoginProvider: "Facebook",
  ProviderKey: key,
  UserId: guid(id),
});
let actionId = 0;
const action = (user: number, extra: SqlRow = {}): SqlRow => ({
  acyyUserActionID: ++actionId,
  UserID: guid(user),
  birthday: "1990-05-12T00:00:00",
  Status: "Payment Completed",
  TotalPayed: 2000,
  CompleteDate: "2024-03-01T10:00:00.000",
  inDate: "2024-03-01T09:59:00.000",
  RelationTypeID: null,
  CustomRelationType: null,
  ...extra,
});
const tables = (t: Partial<LegacyTables>): LegacyTables => ({
  users: [],
  logins: [],
  actions: [],
  relations: [],
  charges: [],
  ...t,
});

describe("planLegacyUsers", () => {
  it("takes paying or balance-holding users with a Facebook login, nobody else", () => {
    const plan = planLegacyUsers(
      tables({
        users: [u(1), u(2, { CurrentPoint: 5000 }), u(3), u(4), u(5)],
        logins: [fb(1), fb(2), fb(3), fb(5)],
        actions: [
          action(1),
          action(3, { Status: "Хайлт хийсэн", TotalPayed: null }), // a search, not a purchase
          action(4), // paid but no Facebook login
          action(5, { Status: "Payment Completed by info@acyy.me" }),
        ],
      }),
      TODAY,
    );
    expect(plan.users.map((x) => x.legacyUserId)).toEqual([1, 2]);
    expect(plan.users[1]).toMatchObject({ balance: 5000, purchases: [], people: [] });
    expect(plan.skipped).toEqual([{ reason: "no_facebook", legacyUserId: 4 }]);
  });

  it("normalizes the email and uses a placeholder when there is none", () => {
    const plan = planLegacyUsers(
      tables({
        users: [u(1), u(2, { Email: null, FirstName: "Бат", LastName: " Дорж" })],
        logins: [fb(1), fb(2, "777")],
        actions: [action(1), action(2)],
      }),
      TODAY,
    );
    expect(plan.users[0]).toMatchObject({
      email: "user1@gmail.com",
      name: "user1",
      facebookId: "101",
    });
    expect(plan.users[1]).toMatchObject({
      email: facebookPlaceholderEmail("777"),
      name: "Бат Дорж",
    });
  });

  it("builds people (deduplicated) and birthday + synastry purchases", () => {
    const me = action(1, { CustomRelationType: "Би", RelationTypeID: 24 });
    const again = action(1, { CustomRelationType: "би" }); // same person, other spelling
    const husband = action(1, {
      birthday: "1988-01-02T00:00:00",
      CustomRelationType: "Нөхөр",
      Status: "Хайлт хийсэн", // used only inside the paid pair below
      TotalPayed: null,
    });
    const plan = planLegacyUsers(
      tables({
        users: [u(1)],
        logins: [fb(1)],
        actions: [me, again, husband],
        relations: [
          {
            acyyRelationID: 50,
            UserID: 1,
            FirstActionID: me.acyyUserActionID,
            SecondActionID: husband.acyyUserActionID,
            CompletedDate: "2024-05-05T12:00:00.000",
            ChargeHistoryID: 9,
          },
          {
            acyyRelationID: 51,
            UserID: 1,
            FirstActionID: 1,
            SecondActionID: 2,
            CompletedDate: null,
          },
        ],
        charges: [{ acyyChargeHistoryID: 9, Value: 1000 }],
      }),
      TODAY,
    );
    const [p] = plan.users;
    expect(p.people.map((x) => [x.key, x.name, x.relation])).toEqual([
      ["1990-05-12|би", "Би", "other"],
      ["1988-01-02|нөхөр", "Нөхөр", "partner"],
    ]);
    expect(p.purchases).toEqual([
      {
        product: "birthday",
        personKeys: ["1990-05-12|би"],
        pricePaid: 2000,
        createdAt: "2024-03-01T10:00:00.000",
        legacyRef: `action:${me.acyyUserActionID}`,
      },
      {
        product: "birthday",
        personKeys: ["1990-05-12|би"],
        pricePaid: 2000,
        createdAt: "2024-03-01T10:00:00.000",
        legacyRef: `action:${again.acyyUserActionID}`,
      },
      {
        product: "synastry",
        personKeys: ["1990-05-12|би", "1988-01-02|нөхөр"],
        pricePaid: 1000,
        createdAt: "2024-05-05T12:00:00.000",
        legacyRef: "relation:50",
      },
    ]);
  });

  it("keeps a same-date, same-label pair as two people", () => {
    const a = action(1, { Status: "Хайлт хийсэн" });
    const b = action(1, { Status: "Хайлт хийсэн" });
    const plan = planLegacyUsers(
      tables({
        users: [u(1)],
        logins: [fb(1)],
        actions: [a, b],
        relations: [
          {
            acyyRelationID: 60,
            UserID: 1,
            FirstActionID: a.acyyUserActionID,
            SecondActionID: b.acyyUserActionID,
            CompletedDate: "2024-05-05T12:00:00.000",
          },
        ],
      }),
      TODAY,
    );
    expect(plan.users[0].purchases[0].personKeys).toEqual(["1990-05-12|", "1990-05-12|#2"]);
    expect(plan.users[0].people).toHaveLength(2);
  });

  it("skips readings with impossible birth dates and ambiguous Facebook ids", () => {
    const plan = planLegacyUsers(
      tables({
        users: [u(1), u(2), u(3)],
        logins: [fb(1), fb(2, "shared"), fb(3, "shared")],
        actions: [action(1, { birthday: "1800-01-01T00:00:00" }), action(2), action(3)],
      }),
      TODAY,
    );
    expect(plan.users[0]).toMatchObject({ legacyUserId: 1, purchases: [], people: [] });
    expect(plan.skipped.map((s) => [s.reason, s.legacyUserId])).toEqual([
      ["invalid_birth_date", 1],
      ["duplicate_facebook_id", 2],
      ["duplicate_facebook_id", 3],
    ]);
  });

  it("skips a second account with the same email", () => {
    const plan = planLegacyUsers(
      tables({
        users: [u(1, { Email: "same@x.mn" }), u(2, { Email: "SAME@x.mn " })],
        logins: [fb(1), fb(2)],
        actions: [action(1), action(2)],
      }),
      TODAY,
    );
    expect(plan.users.map((x) => x.legacyUserId)).toEqual([1]);
    expect(plan.skipped).toEqual([{ reason: "duplicate_email", legacyUserId: 2, ref: "user:1" }]);
  });
});
