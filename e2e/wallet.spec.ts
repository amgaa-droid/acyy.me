import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginWithPassword, signUpFresh } from "./helpers";

const isDesktop = (name: string) => name.startsWith("desktop");

const money = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));

async function balance(page: Page) {
  await page.goto("/wallet");
  return money(await page.getByTestId("wallet-balance").textContent());
}

test("top-up 10,000₮ via mock QPay adds 11,000; callbacks are idempotent", async ({
  page,
}, info) => {
  // A fresh account each run: starts at 0 and stays under the 10-invoices/hour limit.
  await signUpFresh(page, "wallet");
  const before = await balance(page);
  expect(before).toBe(0);

  await page.getByRole("button", { name: "Цэнэглэх", exact: true }).last().click();
  const sheet = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
  await sheet.getByRole("radio", { name: /10,000₮/ }).click();
  await expect(sheet.getByText("Хэтэвчинд 11,000₮")).toBeVisible();
  await sheet.getByRole("button", { name: "QPay-ээр 10,000₮ төлөх" }).click();

  await expect(page).toHaveURL(/\/wallet\/topup\/[0-9a-f-]{36}\?next=%2Fwallet$/);
  const topupId = new URL(page.url()).pathname.split("/").pop()!;
  if (isDesktop(info.project.name)) await expect(page.getByAltText("QPay QR")).toBeVisible();
  else await expect(page.getByRole("link", { name: /Хаан банк/ })).toBeVisible();

  // The "bank app" (mock) pays and calls our real callback.
  await page.getByRole("link", { name: "Mock төлбөрийн хуудас" }).click();
  await expect(page).toHaveURL(/\/dev\/qpay\/mock_/);
  await page.getByRole("button", { name: "Төлсөн", exact: true }).click();
  await expect(page.getByText("Амжилттай!")).toBeVisible();
  await expect(page).toHaveURL(/\/wallet$/, { timeout: 10_000 });
  expect(await balance(page)).toBe(before + 11_000);

  // QPay retries the callback: nothing more is credited.
  const secret = process.env.QPAY_CALLBACK_SECRET!;
  const sig = createHmac("sha256", secret).update(topupId).digest("hex");
  for (let i = 0; i < 2; i++) {
    const res = await page.request.post(`/api/qpay/callback?topup_id=${topupId}&sig=${sig}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "paid" });
  }
  expect(await balance(page)).toBe(before + 11_000);

  // A forged callback is refused.
  const forged = await page.request.post(
    `/api/qpay/callback?topup_id=${topupId}&sig=${"0".repeat(64)}`,
  );
  expect(forged.status()).toBe(401);
});

test("the poll API and cron are protected", async ({ page, request }) => {
  expect((await request.get("/api/cron/qpay-check")).status()).toBe(401);
  expect((await request.get(`/api/topups/${crypto.randomUUID()}`)).status()).toBe(401);
  const ok = await request.get("/api/cron/qpay-check", {
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ errors: 0 });
  void page;
});

test("owner adjusts a wallet with a reason; editor can't", async ({ page }, info) => {
  test.skip(!isDesktop(info.project.name), "admin is desktop-first");
  await loginWithPassword(page, "owner@test.local", "/admin/users?q=minor%40test.local");
  await page.getByRole("link", { name: "minor@test.local" }).click();
  const before = money(await page.getByTestId("admin-balance").textContent());
  await expect(page.getByText("Ledger = үлдэгдэл ✓")).toBeVisible();

  await page.getByLabel("Дүн (₮)").fill("700");
  await page.getByLabel("Шалтгаан").fill("E2E засвар");
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page.getByText("Хэтэвч засагдлаа.")).toBeVisible();
  await expect(page.getByTestId("admin-balance")).toHaveText(
    `${(before + 700).toLocaleString("en-US")}₮`,
  );
  await expect(page.getByText("E2E засвар").first()).toBeVisible();

  await page.context().clearCookies();
  await loginWithPassword(page, "editor@test.local");
  expect((await page.goto("/admin/users"))?.status()).toBe(404);
  expect((await page.goto("/admin/topups"))?.status()).toBe(404);
});
