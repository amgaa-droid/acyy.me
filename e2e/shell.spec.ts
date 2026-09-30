import { expect, test } from "@playwright/test";

test("landing shows the app name and opens the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Зурхай");
  await page.getByRole("button", { name: "Нэвтрэх" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("bottom tab bar switches between the 4 tabs", async ({ page }) => {
  await page.goto("/home");
  const nav = page.getByRole("navigation", { name: "Үндсэн цэс" });
  for (const [label, path] of [
    ["Хүмүүс", "/people"],
    ["Зурхай", "/readings"],
    ["Би", "/me"],
    ["Нүүр", "/home"],
  ] as const) {
    await nav.getByRole("link", { name: label }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
  }
});
