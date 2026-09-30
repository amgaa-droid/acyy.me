import { expect, test } from "@playwright/test";

const isDesktop = (name: string) => name.startsWith("desktop");

test("landing shows the app name and opens the app", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Зурхай");
  await page.getByRole("button", { name: "Нэвтрэх" }).click();
  await expect(page).toHaveURL(/\/home$/);
});

test("primary nav switches between the 4 sections", async ({ page }) => {
  await page.goto("/home");
  // One nav is visible per breakpoint: bottom tab bar (mobile) or sidebar (desktop).
  const nav = page.getByRole("navigation", { name: "Үндсэн цэс" }).locator("visible=true");
  await expect(nav).toHaveCount(1);
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

test("top-up opens a bottom sheet on mobile and a dialog on desktop", async ({ page }, info) => {
  await page.goto("/home");
  const opener = isDesktop(info.project.name)
    ? page.locator("aside").getByRole("button", { name: "Цэнэглэх" })
    : page.getByRole("button", { name: /Хэтэвч: .*Цэнэглэх/ });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute(
    "data-slot",
    isDesktop(info.project.name) ? "dialog-content" : "drawer-popup",
  );
});
