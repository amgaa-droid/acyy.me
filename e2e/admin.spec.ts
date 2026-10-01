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
  expect((await page.goto("/admin/landing"))?.status()).toBe(404);
  expect((await page.goto("/preview/landing"))?.status()).toBe(404);
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

test("landing CMS: edit → save draft → preview → publish → live, then restore what was live", async ({
  page,
  browser,
}) => {
  page.on("dialog", (d) => d.accept());
  await loginWithPassword(page, "editor@test.local", "/admin/landing");
  await expect(page.getByRole("heading", { name: "Нүүр хуудас" })).toBeVisible();
  // Whatever an admin had published before this test is put back at the end.
  const wasLive = (await page.getByText(/^Нийтлэгдсэн: v\d+/).count())
    ? Number((await page.getByText(/^Нийтлэгдсэн: v\d+/).innerText()).match(/v(\d+)/)![1])
    : null;

  const hero = page.locator("details").filter({ has: page.getByText("Эхний дэлгэц", { exact: true }) });
  await hero.locator("summary").click();
  const title = hero.getByLabel("Гарчиг", { exact: true });
  const marker = `E2E гарчиг ${Date.now()}`;

  // Invalid content is refused with the field marked.
  await title.fill("");
  await page.getByRole("button", { name: "Ноорог хадгалах" }).click();
  await expect(page.getByText("Зарим талбар буруу")).toBeVisible();
  await expect(hero.getByText("Хоосон байж болохгүй")).toBeVisible();

  await title.fill(marker);
  await page.getByRole("button", { name: "Ноорог хадгалах" }).click();
  await expect(page.getByText("Хадгаллаа")).toBeVisible();

  // The draft is in the preview but not on the live page yet.
  const preview = await page.context().newPage();
  await preview.goto("/preview/landing");
  await expect(preview.getByRole("heading", { level: 1 })).toHaveText(marker);
  const visitor = await browser.newPage();
  await visitor.goto("/");
  await expect(visitor.getByRole("heading", { level: 1 })).not.toHaveText(marker);

  await page.getByRole("button", { name: "Нийтлэх" }).click();
  await expect(page.getByText(/нийтлэгдлээ/)).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).toHaveText(marker);

  // Put back what was live before (or the built-in copy).
  await page.reload();
  if (wasLive) {
    await page.getByText("Нийтэлсэн түүх", { exact: true }).click();
    await page
      .getByRole("listitem")
      .filter({ has: page.getByText(`v${wasLive}`, { exact: true }) })
      .getByRole("button", { name: "Ноорог болгох" })
      .click();
  } else {
    await page.locator("summary", { hasText: "⋯" }).click();
    await page.getByRole("button", { name: "Анхны текст рүү" }).click();
  }
  await expect(page.getByText(/Ноорог хадгалсан/)).toBeVisible();
  await page.getByRole("button", { name: "Нийтлэх" }).click();
  await expect(page.getByText(/нийтлэгдлээ/)).toBeVisible();
  await visitor.reload();
  await expect(visitor.getByRole("heading", { level: 1 })).not.toHaveText(marker);
  await visitor.close();
});
