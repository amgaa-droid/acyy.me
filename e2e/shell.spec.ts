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

  test("direct links open as popups over the planets; closing goes home", async ({ page }) => {
    // No separate full pages (no sidebar or tab bar): a shared link or a refresh shows the
    // same popup as from home, over the planet system.
    await page.goto("/people");
    const popup = page.getByRole("dialog", { name: "Хүмүүс" });
    await expect(popup).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Үндсэн цэс" })).toHaveCount(0);
    await popup.getByRole("link", { name: /Би ·/ }).first().click();
    // Generous waits: in dev the person page and /home may compile on first visit.
    await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.getByRole("dialog").getByRole("link", { name: "Хаах" }).click();
    await expect(page).toHaveURL(/\/home$/, { timeout: 15_000 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
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
