import { expect, test } from "@playwright/test";
import postgres from "postgres";

import { readOtpFromDevMail } from "./helpers";

/**
 * A migrated acyy.me account (SPEC §5.1) signs in for the first time: it has people from the old
 * site but no "Би", so onboarding asks which one is them. (Facebook itself can't be driven here;
 * the Facebook-id lookup is covered by src/server/legacy tests.)
 */
test("migrated account picks itself among its old-site people", async ({ page }) => {
  const email = `legacy-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Имэйл" }).fill(email);
  await page.getByRole("button", { name: "Код авах" }).click();
  await expect(page.getByText(email)).toBeVisible();
  const mail = await page.context().newPage();
  const code = await readOtpFromDevMail(mail, email);
  await mail.close();
  await page.getByRole("textbox", { name: "6 оронтой код" }).fill(code);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // What scripts/legacy-users.ts would have created for this account.
  const sql = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  try {
    const [u] = await sql`select id from "user" where email = ${email}`;
    await sql`
      insert into persons (owner_user_id, is_self, relation, relation_label, name, gender,
                           birth_date, avatar_seed, legacy_key)
      values (${u.id}, false, 'other', 'Би', 'Би', 'female', '1990-05-12', 'Nova', '1990-05-12|би'),
             (${u.id}, false, 'partner', null, 'Нөхөр', 'unspecified', '1988-01-02', 'Onyx',
              '1988-01-02|нөхөр')`;
  } finally {
    await sql.end();
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Та аль нь вэ?" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Нөхөр/ })).toBeVisible();
  await page.getByRole("button", { name: /^Би/ }).click();

  // "Би" is a placeholder name → asked for a real one; the date comes from the old reading.
  await expect(page.getByRole("textbox", { name: "Нэр" })).toHaveValue("");
  await page.getByRole("textbox", { name: "Нэр" }).fill("Сараа");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(page.getByText("1990.05.12")).toBeVisible();
  await expect(page.getByText("Огноо хуучин зурхайнаас тань ирсэн")).toBeVisible();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: "Алгасах" }).click();
  await page.getByRole("button", { name: "Дуусгах" }).click();
  await expect(page.getByText("Үхэр", { exact: true })).toBeVisible(); // 05-12 → Taurus

  await page.getByRole("button", { name: "Ертөнц рүүгээ орох" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await page.goto("/people");
  await expect(page.getByText("Сараа").first()).toBeVisible();
  await expect(page.getByText("Нөхөр").first()).toBeVisible();
});
