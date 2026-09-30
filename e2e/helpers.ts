import { expect, type Page } from "@playwright/test";

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
