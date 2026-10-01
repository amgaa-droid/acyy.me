import { expect, test } from "@playwright/test";

import { loginWithPassword } from "./helpers";

const isDesktop = (name: string) => name.startsWith("desktop");

test("landing shows the app name and leads to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/^Зурхай — /);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Нэвтрэх" }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await loginWithPassword(page);
  });

  test("primary nav switches between sections on full pages", async ({ page }) => {
    // Direct visits are full pages; one nav is visible per breakpoint: floating tab bar
    // (mobile) or sidebar (desktop).
    await page.goto("/people");
    const nav = page.getByRole("navigation", { name: "Үндсэн цэс" }).locator("visible=true");
    await expect(nav).toHaveCount(1);
    for (const [label, path] of [
      ["Зурхай", "/readings"],
      ["Би", "/me"],
      ["Хүмүүс", "/people"],
    ] as const) {
      await nav.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(nav.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
    await nav.getByRole("link", { name: "Нүүр" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("home menu opens screens as popups over the planets", async ({ page }) => {
    await page.getByRole("button", { name: "Цэс" }).click();
    await page
      .getByRole("navigation", { name: "Үндсэн цэс" })
      .getByRole("link", { name: "Хүмүүс" })
      .click();
    await expect(page).toHaveURL(/\/people$/);
    const popup = page.getByRole("dialog", { name: "Хүмүүс" });
    await expect(popup).toBeVisible();
    await popup.getByRole("button", { name: "Хаах" }).click();
    await expect(page).toHaveURL(/\/home$/);
  });

  test("top-up opens a bottom sheet on mobile and a dialog on desktop", async ({ page }, info) => {
    const opener = page.getByRole("button", { name: /Хэтэвч: .*Цэнэглэх/ });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute(
      "data-slot",
      isDesktop(info.project.name) ? "dialog-content" : "drawer-popup",
    );
  });

  test("colour mode can be switched on /me and persists", async ({ page }) => {
    await page.goto("/me");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("data-theme", "cosmic");
    await page.getByRole("button", { name: /White/ }).click();
    await expect(html).toHaveAttribute("data-theme", "white");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "white");
    await expect(page.getByRole("button", { name: /White/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
