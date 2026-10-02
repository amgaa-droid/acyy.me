import { expect, test } from "@playwright/test";

import { loginWithPassword, readOtpFromDevMail } from "./helpers";

test("signed-out users cannot open app pages", async ({ page }) => {
  for (const path of ["/home", "/people", "/me", "/onboarding"]) {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path)}$`));
  }
});

test("seeded user signs in with password and lands on home with their sign", async ({ page }) => {
  await loginWithPassword(page);
  await expect(page.getByRole("heading", { name: "Анар" })).toBeVisible();
  await expect(page.getByText("Хилэнц", { exact: true })).toBeVisible();
});

test("wrong password shows an error", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Имэйл" }).fill("user@test.local");
  await page.getByLabel("Нууц үг").fill("wrong-password");
  await page.getByRole("button", { name: "Нууц үгээр нэвтрэх" }).click();
  await expect(page.getByText("Имэйл эсвэл нууц үг буруу")).toBeVisible();
});

test("new user: email OTP → onboarding → home", async ({ page, context }, info) => {
  const email = `e2e-${info.project.name}-${Date.now()}@test.local`;

  await page.goto("/login");
  await page.getByRole("textbox", { name: "Имэйл" }).fill(email);
  await page.getByRole("button", { name: "Код авах" }).click();
  await expect(page.getByText(email)).toBeVisible();

  // Read the code in a second tab so the login form keeps its state.
  const mail = await context.newPage();
  const code = await readOtpFromDevMail(mail, email);
  await mail.close();

  await page.getByRole("textbox", { name: "6 оронтой код" }).fill(code);
  await page.getByRole("button", { name: "Нэвтрэх", exact: true }).click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("textbox", { name: "Нэр" }).fill("Туршилт");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(page.getByText("Энэ огноог дараа нь өөрчлөх боломжгүй")).toBeVisible();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("button", { name: "Алгасах" }).click();
  await page.getByRole("radio", { name: "Nova" }).click();
  await page.getByRole("button", { name: "Дуусгах" }).click();

  // Default picker date 2000-01-01 → Матар.
  await expect(page.getByText("Матар")).toBeVisible();
  await page.getByRole("button", { name: "Орчлон руугаа орох" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Туршилт" })).toBeVisible();
});

test("sign out from /me ends the session", async ({ page }) => {
  await loginWithPassword(page, "user@test.local", "/me");
  await page.getByRole("button", { name: "Гарах" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/login/);
});
