import { expect, test } from "@playwright/test";

import { loginWithPassword } from "./helpers";

test("add a person, see their sign, edit, then delete", async ({ page }, info) => {
  const name = `Тест ${info.project.name.slice(0, 3)} ${Date.now() % 100000}`;
  await loginWithPassword(page, "user@test.local", "/people");

  await page.getByRole("link", { name: "Хүн нэмэх" }).last().click();
  await expect(page).toHaveURL(/\/people\/new$/);

  // 1. relation — "other" needs its own label
  await page.getByRole("radio", { name: "Бусад" }).click();
  await expect(page.getByRole("button", { name: "Үргэлжлүүлэх" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Өөрөө нэрлэх" }).fill("Багш");
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();

  // 2. avatar
  await page.getByRole("radio", { name: "Sage" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();

  // 3. info — default picker date 1990-01-01 → Матар
  await page.getByRole("textbox", { name: "Нэр", exact: true }).fill(name);
  await expect(page.getByText("Энэ огноог дараа нь өөрчлөх боломжгүй")).toBeVisible();
  await page.getByRole("button", { name: "Хадгалах" }).click();

  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  const personUrl = page.url();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Багш").first()).toBeVisible();
  await expect(page.getByText("1990-01-01")).toBeVisible();

  // Edit: no birth-date field, rename works
  await page.getByRole("button", { name: "Засах" }).click();
  const sheet = page.getByRole("dialog", { name: "Мэдээлэл засах" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Төрсөн огноо засагдахгүй")).toBeVisible();
  await expect(sheet.getByRole("listbox", { name: "Он" })).toHaveCount(0);
  await sheet.getByRole("textbox", { name: "Нэр", exact: true }).fill(`${name} 2`);
  await sheet.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByRole("heading", { name: `${name} 2` })).toBeVisible();

  // Another user can't open it
  await page.context().clearCookies();
  await loginWithPassword(page, "owner@test.local");
  const res = await page.goto(personUrl);
  expect(res?.status()).toBe(404);

  // Owner deletes it → gone from the list
  await page.context().clearCookies();
  await loginWithPassword(page, "user@test.local", "/people");
  await page.goto(personUrl);
  await page.getByRole("button", { name: "Устгах" }).click();
  await page.getByRole("button", { name: "Тийм, устгах" }).click();
  await expect(page).toHaveURL(/\/people$/);
  await expect(page.getByText(`${name} 2`)).toHaveCount(0);
  expect((await page.goto(personUrl))?.status()).toBe(404);
});

test("'Би' has no delete button and its relation can't be edited", async ({ page }) => {
  await loginWithPassword(page, "user@test.local", "/people");
  await page.getByRole("link", { name: /Анар/ }).click();
  await expect(page.getByRole("heading", { name: "Анар" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Устгах" })).toHaveCount(0);
  await page.getByRole("button", { name: "Засах" }).click();
  const sheet = page.getByRole("dialog", { name: "Мэдээлэл засах" });
  await expect(sheet.getByRole("radiogroup", { name: "Таны хэн бэ?" })).toHaveCount(0);
});

test("home shows my sign and my people", async ({ page }) => {
  await loginWithPassword(page);
  await expect(page.getByText("Хилэнц", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ээж Матар" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Хайрт Арслан" })).toBeVisible();
});
