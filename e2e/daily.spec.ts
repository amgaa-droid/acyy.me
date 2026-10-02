import { expect, test } from "@playwright/test";

import { loginWithPassword } from "./helpers";

test("home opens on today's horoscopes and switches to the planets and back, remembered", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginWithPassword(page);
  const home = page.locator("[data-screen=home]");
  await expect(home).toHaveAttribute("data-view", "today");
  const today = page.getByRole("region", { name: "Өнөөдрийн зурхай" });
  await expect(today.getByRole("heading", { name: "Өнөөдрийн зурхай" })).toBeVisible();
  await expect(today.getByRole("heading", { name: "Өнөөдрийн хайрын зурхай" })).toBeVisible();
  await expect(today.getByRole("heading", { name: "Өнөөдрийн ажлын зурхай" })).toBeVisible();

  await page.getByRole("button", { name: "Нарны систем рүү шилжих" }).click();
  await expect(home).toHaveAttribute("data-view", "planets");
  await expect(page.getByRole("button", { name: /^Сарангэрэл, Ээж/ })).toBeVisible();

  // The last view sticks across visits.
  await page.reload();
  await expect(home).toHaveAttribute("data-view", "planets");
  await page.getByRole("button", { name: "Өнөөдрийн зурхай руу шилжих" }).click();
  await expect(home).toHaveAttribute("data-view", "today");
  await expect(today.getByRole("heading", { name: "Өнөөдрийн зурхай" })).toBeVisible();
});

test("an editor writes today's text for a sign and its people read it on home", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "desktop-chrome",
    "admin is desktop-first; one project avoids racing writes",
  );
  const text = `E2E өдрийн зурхай ${Date.now()}`;

  await loginWithPassword(page, "editor@test.local", "/admin/daily");
  await expect(page.getByRole("heading", { name: "Өдрийн зурхай", level: 1 })).toBeVisible();
  // Kinds are the Owner's; an Editor only writes texts.
  await expect(page.getByRole("heading", { name: "Төрлүүд" })).toHaveCount(0);
  const save = page.getByRole("button", { name: "Хадгалах" });
  await expect(save).toBeDisabled();
  await page.getByRole("textbox", { name: "Хилэнц" }).fill(text);
  await save.click();
  await expect(page.getByRole("status")).toContainText("Хадгаллаа");

  // user@test.local (Анар) is a Scorpio.
  await page.context().clearCookies();
  await loginWithPassword(page);
  await expect(
    page.getByRole("region", { name: "Өнөөдрийн зурхай" }).getByText(text),
  ).toBeVisible();
});
