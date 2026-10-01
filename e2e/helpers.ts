import { expect, type Locator, type Page } from "@playwright/test";

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "";

/** Signs in a seeded test account with email + password (dev only). */
export async function loginWithPassword(page: Page, email = "user@test.local", next = "/home") {
  if (!SEED_PASSWORD)
    throw new Error("SEED_PASSWORD must be set (see .env) and `pnpm db:seed` run");
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("textbox", { name: "Имэйл" }).fill(email);
  await page.getByLabel("Нууц үг").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Нууц үгээр нэвтрэх" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}

/** Reads the latest OTP sent to `email` from the dev outbox (/dev/mail). */
export async function readOtpFromDevMail(page: Page, email: string): Promise<string> {
  let code = "";
  await expect(async () => {
    await page.goto("/dev/mail");
    const item = page.getByTestId("dev-mail").filter({ hasText: email }).first();
    const text = await item.innerText();
    code = /код:?\s*(\d{6})/.exec(text)?.[1] ?? "";
    expect(code).toHaveLength(6);
  }).toPass({ timeout: 10_000 });
  return code;
}

/** Creates a brand-new account via email OTP and finishes onboarding (default date 2000-01-01). */
export async function signUpFresh(page: Page, prefix = "e2e"): Promise<string> {
  const email = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`;
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
  await page.getByRole("textbox", { name: "Нэр" }).fill("Туршилт");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: "Алгасах" }).click();
  await page.getByRole("radio", { name: "Nova" }).click();
  await page.getByRole("button", { name: "Дуусгах" }).click();
  await page.getByRole("button", { name: "Дараа" }).click();
  await expect(page).toHaveURL(/\/home$/);
  return email;
}

const money = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));
export const mnt = (n: number) => `${n.toLocaleString("en-US")}₮`;

/**
 * In an open top-up sheet: picks the smallest active package of at least `min`₮ and presses
 * "QPay-ээр … төлөх". Packages are edited in /admin/packages, so tests never hard-code them —
 * `credited` is what the sheet says the wallet will get (amount + bonus).
 */
export async function payTopup(sheet: Locator, min: number) {
  const radios = sheet.getByRole("radio");
  const amounts = (await radios.allTextContents()).map((t) => money(t.split("+")[0]));
  const fits = amounts.map((a, i) => [a, i] as const).filter(([a]) => a >= min);
  expect(fits.length, `an active top-up package of at least ${min}₮`).toBeGreaterThan(0);
  const [amount, index] = fits.reduce((best, x) => (x[0] < best[0] ? x : best));
  await radios.nth(index).click();
  const credited = money(await sheet.getByText(/^Хэтэвчинд /).textContent());
  await sheet.getByRole("button", { name: `QPay-ээр ${mnt(amount)} төлөх` }).click();
  return { amount, credited };
}

/**
 * In the open invoice popup: pays with the mock "bank app", which opens in its own tab like the
 * QPay app would. Waits until the popup shows the payment and closes by itself; returns the
 * top-up id (the bank tab lands on /wallet/topup/<id>).
 */
export async function payWithMockBank(page: Page): Promise<string> {
  const invoice = page.getByRole("dialog", { name: "Төлбөр төлөх" });
  const [bank] = await Promise.all([
    page.waitForEvent("popup"),
    invoice.getByRole("link", { name: "Mock төлбөрийн хуудас" }).click(),
  ]);
  await expect(bank).toHaveURL(/\/dev\/qpay\/mock_/);
  await bank.getByRole("button", { name: "Төлсөн", exact: true }).click();
  await expect(bank).toHaveURL(/\/wallet\/topup\/[0-9a-f-]{36}/);
  const topupId = new URL(bank.url()).pathname.split("/").pop()!;
  await bank.close();
  await expect(invoice.getByText("Амжилттай!")).toBeVisible({ timeout: 10_000 });
  await expect(invoice).toBeHidden({ timeout: 10_000 });
  return topupId;
}
