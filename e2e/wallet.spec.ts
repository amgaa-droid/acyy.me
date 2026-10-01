import { createHmac } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

import { loginWithPassword, payTopup, payWithMockBank, signUpFresh } from "./helpers";

const isDesktop = (name: string) => name.startsWith("desktop");

const money = (s: string | null) => Number((s ?? "").replace(/[^\d]/g, ""));

async function balance(page: Page) {
  await page.goto("/wallet");
  return money(await page.getByTestId("wallet-balance").textContent());
}

test("top-up via mock QPay adds amount + bonus; callbacks are idempotent", async ({
  page,
}, info) => {
  // A fresh account each run: starts at 0 and stays under the 10-invoices/hour limit.
  await signUpFresh(page, "wallet");
  const before = await balance(page);
  expect(before).toBe(0);

  await page.getByRole("button", { name: "Цэнэглэх", exact: true }).last().click();
  const sheet = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
  const { credited } = await payTopup(sheet, 10_000);

  // The invoice opens in the same popup — the page underneath stays.
  const invoice = page.getByRole("dialog", { name: "Төлбөр төлөх" });
  await expect(page).toHaveURL(/\/wallet$/);
  if (isDesktop(info.project.name)) await expect(invoice.getByAltText("QPay QR")).toBeVisible();
  else {
    // QPay only — no bank list.
    await expect(invoice.getByRole("button", { name: "QPay-ээр төлөх" })).toBeVisible();
    await expect(invoice.getByText(/банк/i)).toHaveCount(0);
  }

  // The QPay app (mock) pays and calls our real callback.
  const topupId = await payWithMockBank(page);
  await expect(page).toHaveURL(/\/wallet$/);
  expect(await balance(page)).toBe(before + credited);

  // QPay retries the callback: nothing more is credited.
  const secret = process.env.QPAY_CALLBACK_SECRET!;
  const sig = createHmac("sha256", secret).update(topupId).digest("hex");
  for (let i = 0; i < 2; i++) {
    const res = await page.request.post(`/api/qpay/callback?topup_id=${topupId}&sig=${sig}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ status: "paid" });
  }
  expect(await balance(page)).toBe(before + credited);

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
