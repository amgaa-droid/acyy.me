import { expect, test } from "@playwright/test";

import { loginWithPassword, showPlanets } from "./helpers";

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
  await page.getByRole("radio", { name: "Дүрс 19", exact: true }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();

  // 3. info — default picker date 1990-01-01 → Матар
  await page.getByRole("textbox", { name: "Нэр", exact: true }).fill(name);
  await expect(page.getByText("Энэ огноог дараа нь өөрчлөх боломжгүй")).toBeVisible();
  await page.getByRole("button", { name: "Хадгалах" }).click();
  // The date can't be changed later: it is read back, spelled out, before saving. "Засах"
  // goes back to the form with nothing saved.
  await expect(page.getByText("1990 оны 1-р сарын 1")).toBeVisible();
  await page.getByRole("button", { name: "Засах" }).click();
  await expect(page).toHaveURL(/\/people\/new$/);
  await page.getByRole("button", { name: "Хадгалах", exact: true }).click();
  await page.getByRole("button", { name: "Тийм, хадгалах" }).click();

  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  const personUrl = page.url();
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(page.getByText("Багш").first()).toBeVisible();
  await expect(page.getByText("1990.01.01")).toBeVisible();

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

test("home shows me and my people as planets", async ({ page }) => {
  await loginWithPassword(page);
  await showPlanets(page);
  await expect(page.getByRole("heading", { name: "Анар" })).toBeVisible();
  await expect(page.getByText("Хилэнц", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Сарангэрэл, Ээж, Матар/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Тэмүүлэн, Хайрт, Арслан/ })).toBeVisible();
});

test("tapping a planet shows its readings; they open as a popup over home", async ({ page }) => {
  // Planets drift; with reduced motion they hold still (and the page must honour that).
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginWithPassword(page);
  await showPlanets(page);
  // Tapping opens a tray of readings at the bottom; × closes it.
  const planet = page.getByRole("button", { name: /^Сарангэрэл, Ээж/ });
  await planet.click();
  const tray = page.getByRole("region", { name: "Сарангэрэл — зурхайнууд" });
  await expect(tray).toBeVisible();
  await expect(tray.getByRole("link", { name: "Сарангэрэл — мэдээлэл" })).toBeVisible();
  await tray.getByRole("button", { name: "Хаах" }).click();
  await expect(tray).toHaveCount(0);
  await planet.click();
  const reading = tray.getByRole("link", { name: /^Төрсөн өдрийн зурхай — Сарангэрэл/ });
  await reading.click();
  // The first visit compiles the popup route in dev; allow for that.
  await expect(page).toHaveURL(/\/(buy|r)\//, { timeout: 20_000 });
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Хаах" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("tapping \"+N\" shows the next five people each time, then closes", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginWithPassword(page, "owner@test.local");
  await showPlanets(page);
  const more = page.getByRole("button", { name: /^Бусад \d+ хүн$/ });
  test.skip((await more.count()) === 0, "owner has nobody waiting in +N");
  const total = Number((await more.getAttribute("aria-label"))!.match(/\d+/)![0]);
  await more.click();
  const dock = page.getByRole("region", { name: /^Бусад \d+ хүн · чирж нийцүүл$/ });
  await expect(dock).toBeVisible();
  const names = async () =>
    page.locator("[data-screen=home] button[aria-label]").evaluateAll((els) =>
      els.map((e) => e.getAttribute("aria-label") ?? "").filter((l) => /, .+, /.test(l)),
    );
  const pages = Math.ceil(total / 5);
  for (let i = 1; i < pages; i++) {
    const before = await names();
    await page.getByRole("button", { name: /^Дараагийн \d+ хүн$/ }).click();
    await expect.poll(names).not.toEqual(before);
  }
  await page.getByRole("button", { name: "Бусад хүмүүсийг хаах" }).click();
  await expect(dock).toHaveCount(0);
});

test("one sheet at a time: a planet's tray closes the \"+N\" dock, and both sit on the same line", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await loginWithPassword(page, "owner@test.local");
  await showPlanets(page);
  const more = page.getByRole("button", { name: /^Бусад \d+ хүн$/ });
  test.skip((await more.count()) === 0, "owner has nobody waiting in +N");
  await more.click();
  const dock = page.getByRole("region", { name: /^Бусад \d+ хүн · чирж нийцүүл$/ });
  await expect(dock).toBeVisible();
  await page.waitForTimeout(600); // the rise-in animation
  const dockBox = (await dock.boundingBox())!;

  // A planet on the orbit (not in the dock): its tray replaces the dock.
  const planet = page.locator("[data-screen=home] button[aria-label*=', ']").first();
  const name = (await planet.getAttribute("aria-label"))!.split(",")[0];
  await planet.click({ force: true });
  const tray = page.getByRole("region", { name: `${name} — зурхайнууд` });
  await expect(tray).toBeVisible();
  await expect(dock).toHaveCount(0);

  // Same width and the same gap to the bottom of the screen.
  await page.waitForTimeout(600);
  const trayBox = (await tray.boundingBox())!;
  expect(Math.round(trayBox.y + trayBox.height)).toBe(Math.round(dockBox.y + dockBox.height));
  // Phones: the same width too (desktop keeps the tray compact).
  if (dockBox.width < 448) expect(Math.round(trayBox.width)).toBe(Math.round(dockBox.width));
});
