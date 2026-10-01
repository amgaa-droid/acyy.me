import ExcelJS from "exceljs";
import { expect, test, type Page } from "@playwright/test";

import { loginWithPassword } from "./helpers";

// Admin screens are desktop-first; one project is enough and avoids parallel imports.
test.beforeEach(({}, info) => {
  test.skip(info.project.name !== "desktop-chrome", "desktop only");
});

async function downloadTemplate(page: Page, kind: string) {
  const res = await page.request.get(`/api/admin/templates/${kind}`);
  expect(res.status()).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  return wb;
}

test("regular users and signed-out visitors can't see the admin", async ({ page }) => {
  await loginWithPassword(page, "user@test.local");
  expect((await page.goto("/admin"))?.status()).toBe(404);
  expect((await page.goto("/admin/import"))?.status()).toBe(404);
  expect((await page.request.get("/api/admin/templates/sign")).status()).toBe(404);
});

test("editor manages content but not products", async ({ page }) => {
  await loginWithPassword(page, "editor@test.local");
  expect((await page.goto("/admin"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Хяналт" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Бүтээгдэхүүн" })).toHaveCount(0);
  expect((await page.goto("/admin/products"))?.status()).toBe(404);
  expect((await page.goto("/admin/zodiac"))?.status()).toBe(200);
});

test("owner sees products", async ({ page }) => {
  await loginWithPassword(page, "owner@test.local", "/me");
  await page.getByRole("link", { name: /Админ/ }).click();
  await page.getByRole("link", { name: "Бүтээгдэхүүн" }).click();
  await expect(page).toHaveURL(/\/admin\/products$/);
  await page
    .getByRole("main")
    .getByRole("link", { name: /Нийцлийн зурхай/ })
    .click();
  await expect(page).toHaveURL(/\/admin\/products\/synastry$/);
  await expect(page.getByRole("heading", { name: "Нийцлийн зурхай" })).toBeVisible();
  // Two parts, each with its sub-sections.
  await expect(page.getByRole("heading", { name: "Ордны нийцэл" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Төрсөн үеийн нийцэл" })).toBeVisible();
  await expect(page.getByText("Тохиромжтой харилцаа")).toBeVisible();
});

test("import: template → fill → dry-run report → import", async ({ page }) => {
  await loginWithPassword(page, "editor@test.local", "/admin/import");

  // Download the pre-filled template and fill it in (row 5 left broken on purpose).
  const wb = await downloadTemplate(page, "dating");
  const ws = wb.worksheets[0];
  expect(ws.rowCount).toBe(13);
  expect(ws.getRow(2).getCell(1).value).toBe("Хонь");
  ws.eachRow((row, i) => {
    if (i === 1) return;
    row.getCell(2).value = `E2E гарчиг ${i}`;
    row.getCell(3).value = i === 5 ? "" : `E2E текст ${i}. Хоёр дахь өгүүлбэр.`;
  });
  const broken = Buffer.from(await wb.xlsx.writeBuffer());

  await page.getByLabel("Төрөл").selectOption("dating");
  await page.getByLabel("Excel файл (.xlsx)").setInputFiles({
    name: "dating.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: broken,
  });
  await page.getByRole("button", { name: "Шалгах" }).click();
  await expect(page.getByRole("status")).toContainText("Алдаатай мөртэй");
  await expect(page.getByTestId("import-errors")).toContainText("5-р мөр [general] хоосон байна");
  await expect(page.getByRole("button", { name: "Импортлох" })).toBeDisabled();

  // Fix the row and re-check → import.
  ws.getRow(5).getCell(3).value = "Засагдсан текст.";
  const fixed = Buffer.from(await wb.xlsx.writeBuffer());
  await page.getByLabel("Excel файл (.xlsx)").setInputFiles({
    name: "dating.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: fixed,
  });
  await page.getByRole("button", { name: "Шалгах" }).click();
  await expect(page.getByRole("status")).toContainText("Импортлоход бэлэн");
  await page.getByRole("button", { name: "Импортлох" }).click();
  await expect(page.getByRole("status")).toContainText("Импорт амжилттай");

  // The texts are there.
  await page.goto("/admin/content?product=dating&section=main&q=E2E");
  await expect(page.getByText("Нийт 12")).toBeVisible();
});

test("ranges editor refuses a gap", async ({ page }) => {
  await loginWithPassword(page, "editor@test.local", "/admin/zodiac");
  const leoEnd = page.getByRole("textbox", { name: "Арслан Дуусах (MM-DD)" });
  await leoEnd.fill("08-20");
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Цоорхой: 08-21, 08-22")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("textbox", { name: "Арслан Дуусах (MM-DD)" })).toHaveValue("08-22");
});
