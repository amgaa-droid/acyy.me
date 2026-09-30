import { expect, test, type Page } from "@playwright/test";

import { loginWithPassword, signUpFresh } from "./helpers";

const money = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));

async function walletBalance(page: Page) {
  await page.goto("/wallet");
  return money(await page.getByTestId("wallet-balance").textContent());
}

/** From a buy page: open the confirm sheet and buy; lands on /r/:id. */
async function confirmPurchase(page: Page) {
  await page
    .getByRole("button", { name: /^Нээх · / })
    .first()
    .click();
  const sheet = page.getByRole("dialog", { name: "Баталгаажуулах" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: /^Нээх · / }).click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, { timeout: 15_000 });
}

test("new user: short balance → top-up → back to confirm → buys all 6 and reads them", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await signUpFresh(page, "buyer");

  // 18+ confirmation (the fresh user's "Би" is 2000-01-01).
  await page.goto("/me");
  await page.getByRole("button", { name: "Би 18 нас хүрсэн" }).click();
  await expect(page.getByText("Баталгаажсан")).toBeVisible();

  // Pick "Би" for the birthday reading.
  await page.goto("/buy/birthday");
  await page.getByRole("link", { name: /Туршилт/ }).click();
  await expect(page).toHaveURL(/\/buy\/birthday\?a=/);
  const selfId = new URL(page.url()).searchParams.get("a")!;

  // Preview shows 2 sentences and never the rest.
  await expect(page.getByText("Энэ бол жинхэнэ текст ирэх хүртэлх түр бичвэр юм!")).toBeVisible();
  expect(await page.content()).not.toContain("Гурав дахь өгүүлбэр");

  // Balance 0 → the confirm sheet offers a top-up instead.
  await page.getByRole("button", { name: "Нээх · 2,000₮" }).click();
  const sheet = page.getByRole("dialog", { name: "Баталгаажуулах" });
  await expect(sheet.getByText("Үлдэгдэл хүрэлцэхгүй байна.")).toBeVisible();
  await sheet.getByRole("button", { name: "Цэнэглээд үргэлжлүүлэх" }).click();
  const topup = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
  await topup.getByRole("radio", { name: /10,000₮/ }).click();
  await topup.getByRole("button", { name: "QPay-ээр 10,000₮ төлөх" }).click();
  await page.getByRole("link", { name: "Mock төлбөрийн хуудас" }).click();
  await expect(page).toHaveURL(/\/dev\/qpay\/mock_/);
  await page.getByRole("button", { name: "Төлсөн", exact: true }).click();
  await expect(page.getByText("Амжилттай!")).toBeVisible();

  // …and we're back on the buy page with the confirm sheet already open.
  await expect(page).toHaveURL(/\/buy\/birthday\?a=.*confirm=1/, { timeout: 15_000 });
  const back = page.getByRole("dialog", { name: "Баталгаажуулах" });
  await expect(back.getByTestId("balance-change")).toHaveText("Үлдэгдэл 11,000₮ → 9,000₮");
  await back.getByRole("button", { name: "Нээх · 2,000₮" }).click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByText("Гурав дахь өгүүлбэр").first()).toBeVisible();

  // The four sign-based readings for "Би".
  for (const code of ["sign", "love", "sex", "dating"]) {
    await page.goto(`/buy/${code}?a=${selfId}`);
    await confirmPurchase(page);
    // Full text is shown (whatever it currently is), not the "unavailable" note.
    await expect(page.getByRole("article").getByRole("heading", { level: 2 })).toBeVisible();
    await expect(page.getByText("Энэ хэсгийн текст түр засварлагдаж байна.")).toHaveCount(0);
  }

  // Synastry: "Би" × a new person created from inside the buy flow.
  await page.goto(`/buy/synastry?a=${selfId}`);
  await page.getByRole("link", { name: "Шинэ хүн нэмэх" }).click();
  await page.getByRole("radio", { name: "Ээж" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("radio", { name: "Iris" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("textbox", { name: "Нэр", exact: true }).fill("Ээж");
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page).toHaveURL(/\/buy\/synastry\?a=.*&b=/);
  const momId = new URL(page.url()).searchParams.get("b")!;
  await confirmPurchase(page);
  const synUrl = page.url();
  await expect(page.getByRole("region", { name: "Ордны нийцэл" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Төрсөн үеийн нийцэл" })).toBeVisible();

  // 2,000 + 5 × 1,000 spent.
  expect(await walletBalance(page)).toBe(4_000);

  // B×A is the same reading: straight to it, no charge.
  await page.goto(`/buy/synastry?a=${momId}&b=${selfId}`);
  await expect(page).toHaveURL(synUrl);
  expect(await walletBalance(page)).toBe(4_000);

  await page.goto("/readings?tab=mine");
  await expect(page.locator('a[href^="/r/"]')).toHaveCount(6);

  // Mother gets only the family-allowed products.
  await page.goto(`/people/${momId}`);
  await expect(page.getByRole("link", { name: /Хайр дурлалын/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Болзооны/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Секс/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Ордны зурхай/ })).toBeVisible();
});

test("minor@test.local never sees the 18+ reading", async ({ page }) => {
  await loginWithPassword(page, "minor@test.local", "/readings");
  await expect(page.getByRole("link", { name: /Ордны зурхай/ })).toBeVisible();
  await expect(page.getByText("Секс зурхай")).toHaveCount(0);
  await page.goto("/me");
  await expect(page.getByRole("button", { name: "Би 18 нас хүрсэн" })).toHaveCount(0);
  await page.goto("/buy/sex");
  await expect(page.getByText("Энэ зурхайд тохирох хүн алга.")).toBeVisible();
});

test("someone else's reading is a 404", async ({ page, browser }) => {
  await loginWithPassword(page, "user@test.local", "/readings?tab=mine");
  const first = page.locator('a[href^="/r/"]').first();
  test.skip((await first.count()) === 0, "user@test.local has no purchases yet");
  const href = await first.getAttribute("href");

  const other = await browser.newContext();
  const p2 = await other.newPage();
  await loginWithPassword(p2, "editor@test.local");
  expect((await p2.goto(href!))?.status()).toBe(404);
  await other.close();
});
