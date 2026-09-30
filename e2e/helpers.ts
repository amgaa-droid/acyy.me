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
  await expect(page).toHaveURL(new RegExp(`${next}$`));
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
