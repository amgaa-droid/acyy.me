import ExcelJS from "exceljs";
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

test("an editor imports several days from the Excel template", async ({ page }, info) => {
  test.skip(
    info.project.name !== "desktop-chrome",
    "admin is desktop-first; one project avoids racing writes",
  );
  const stamp = Date.now();
  // Far ahead, so the run doesn't touch the days people read now.
  const from = "2030-01-01";

  await loginWithPassword(page, "editor@test.local", "/admin/daily");
  const res = await page.request.get(`/api/admin/daily-template?from=${from}&days=2`);
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  expect(ws.rowCount).toBe(1 + 2 * 12);
  ws.eachRow((row, i) => {
    if (i > 1)
      row.getCell(3).value = `E2E ${stamp} ${row.getCell(1).value} ${row.getCell(2).value}`;
  });
  const file = Buffer.from(await wb.xlsx.writeBuffer());

  await page.locator("summary", { hasText: "Excel импорт" }).click();
  await page.getByLabel("Excel файл (.xlsx)").setInputFiles({
    name: "daily.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: file,
  });
  await page.getByRole("button", { name: "Шалгах" }).click();
  const report = page.getByRole("region", { name: "Импортын тайлан" });
  await expect(report.getByRole("status")).toHaveText("Алдаагүй. Импортлоход бэлэн.");
  await page.getByRole("button", { name: "Импортлох" }).click();
  await expect(report.getByRole("status")).toHaveText("Импорт амжилттай.");

  await page.goto(`/admin/daily?date=2030-01-02&kind=general`);
  await expect(page.getByRole("textbox", { name: "Хилэнц" })).toHaveValue(
    `E2E ${stamp} 2030-01-02 Хилэнц`,
  );
});
