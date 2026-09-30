import { expect, test, type Page } from "@playwright/test";

import { loginWithPassword } from "./helpers";

/** Collects console errors and uncaught exceptions from the very first byte of each page load. */
function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${page.url()} :: ${m.text().slice(0, 300)}`);
  });
  page.on("pageerror", (e) => errors.push(`${page.url()} :: uncaught ${e.message.slice(0, 300)}`));
  return errors;
}

test("main screens load and open sheets without React/console errors", async ({ page }) => {
  test.setTimeout(120_000);
  const errors = trackErrors(page);
  await loginWithPassword(page, "user@test.local");

  for (const path of [
    "/home",
    "/people",
    "/readings",
    "/readings?tab=mine",
    "/wallet",
    "/me",
    "/buy/sign",
  ]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
  }

  // A person page + its edit sheet, the top-up sheet, a reading + its share sheet.
  await page.goto("/people");
  await page.locator('a[href^="/people/"]:not([href="/people/new"])').first().click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Засах" }).click();
  await expect(page.getByRole("dialog", { name: "Мэдээлэл засах" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/wallet");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Цэнэглэх", exact: true }).last().click();
  await expect(page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/readings?tab=mine");
  const reading = page.locator('a[href^="/r/"]').first();
  if (await reading.count()) {
    await reading.click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Хуваалцах" }).click();
    await expect(page.getByRole("dialog", { name: "Карт хуваалцах" })).toBeVisible();
  }

  expect(errors).toEqual([]);
});
