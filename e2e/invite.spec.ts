import { expect, test, type Browser, type Page } from "@playwright/test";

import { readOtpFromDevMail, signUpFresh } from "./helpers";

async function topUp10k(page: Page) {
  await page.goto("/wallet");
  await page.getByRole("button", { name: "Цэнэглэх", exact: true }).last().click();
  const sheet = page.getByRole("dialog", { name: "Хэтэвч цэнэглэх" });
  await sheet.getByRole("radio", { name: /10,000₮/ }).click();
  await sheet.getByRole("button", { name: "QPay-ээр 10,000₮ төлөх" }).click();
  await page.getByRole("link", { name: "Mock төлбөрийн хуудас" }).click();
  await expect(page).toHaveURL(/\/dev\/qpay\/mock_/);
  await page.getByRole("button", { name: "Төлсөн", exact: true }).click();
  await expect(page.getByText("Амжилттай!")).toBeVisible();
  // The invoice page auto-returns after a moment; let it finish before navigating on.
  await expect(page).toHaveURL(/\/wallet$/, { timeout: 10_000 });
}

/** Reads the invitation link sent to `email` from the dev outbox. */
async function inviteLinkFor(browser: Browser, email: string): Promise<string> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  let link = "";
  await expect(async () => {
    await p.goto("/dev/mail");
    const text = await p.getByTestId("dev-mail").filter({ hasText: email }).first().innerText();
    link = /(https?:\/\/\S+\/invite\/[A-Za-z0-9_-]{43})/.exec(text)?.[1] ?? "";
    expect(link).not.toBe("");
  }).toPass({ timeout: 10_000 });
  await ctx.close();
  return new URL(link).pathname;
}

test("A invites B by email and buys a synastry → B signs up from the link and reads it free", async ({
  page,
  browser,
}, info) => {
  test.setTimeout(180_000);
  const bEmail = `invitee-${info.project.name}-${Date.now()}@test.local`;

  // --- A: account, a friend "Бат", money, the synastry.
  await signUpFresh(page, "inviter");
  await page.goto("/people/new");
  await page.getByRole("radio", { name: "Найз" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("radio", { name: "Sage" }).click();
  await page.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await page.getByRole("textbox", { name: "Нэр", exact: true }).fill("Бат");
  await page.getByRole("button", { name: "Хадгалах" }).click();
  await expect(page).toHaveURL(/\/people\/[0-9a-f-]{36}$/);
  const friendId = page.url().split("/").pop()!;

  // Invite by email.
  await page.getByRole("button", { name: "Имэйлээр урих" }).click();
  const sheet = page.getByRole("dialog", { name: "Имэйлээр урих" });
  await sheet.getByRole("textbox", { name: "Имэйл" }).fill(bEmail);
  await sheet.getByRole("button", { name: "Илгээх" }).click();
  await expect(page.getByTestId("invite-status")).toContainText(bEmail);
  await expect(page.getByText(/Урилга хүлээгдэж байна/)).toBeVisible();

  await topUp10k(page);
  const selfId = await (async () => {
    await page.goto("/buy/sign");
    await page.getByRole("link", { name: /Туршилт/ }).click();
    await expect(page).toHaveURL(/\/buy\/sign\?a=/);
    return new URL(page.url()).searchParams.get("a")!;
  })();
  await page.goto(`/buy/synastry?a=${selfId}&b=${friendId}`);
  await page.getByRole("button", { name: "Нээх · 1,000₮" }).click();
  await page
    .getByRole("dialog", { name: "Баталгаажуулах" })
    .getByRole("button", { name: "Нээх · 1,000₮" })
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const synUrl = new URL(page.url()).pathname;
  // …and a sign reading for Бат, which B must NOT get for free.
  await page.goto(`/buy/sign?a=${friendId}`);
  await page.getByRole("button", { name: "Нээх · 1,000₮" }).click();
  await page
    .getByRole("dialog", { name: "Баталгаажуулах" })
    .getByRole("button", { name: "Нээх · 1,000₮" })
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const signUrl = new URL(page.url()).pathname;

  // --- B: opens the emailed link (Mailpit in prod setups; the dev outbox here).
  const invitePath = await inviteLinkFor(browser, bEmail);
  const b = await (await browser.newContext()).newPage();
  await b.goto(invitePath);
  await expect(b.getByRole("heading", { name: /Туршилт таныг .* урьж байна/ })).toBeVisible();
  await expect(b.getByText("Таныг «Бат» гэж нэмсэн байна.")).toBeVisible();
  await b.getByRole("button", { name: "Нэвтрэх / Бүртгүүлэх" }).click();

  await b.getByRole("textbox", { name: "Имэйл" }).fill(bEmail);
  await b.getByRole("button", { name: "Код авах" }).click();
  const mail = await b.context().newPage();
  const code = await readOtpFromDevMail(mail, bEmail);
  await mail.close();
  await b.getByRole("textbox", { name: "6 оронтой код" }).fill(code);
  await b.getByRole("button", { name: "Нэвтрэх", exact: true }).click();

  await expect(b).toHaveURL(new RegExp(`${invitePath}$`));
  await b.getByRole("button", { name: "Урилга хүлээн авах" }).click();

  // Onboarding pre-filled with the invited person's name and date.
  await expect(b).toHaveURL(/\/onboarding\?invite=/);
  await expect(b.getByRole("textbox", { name: "Нэр" })).toHaveValue("Бат");
  await b.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await expect(b.getByText("Урилгаар ирсэн мэдээллийг бөглөлөө")).toBeVisible();
  await b.getByRole("button", { name: "Үргэлжлүүлэх" }).click();
  await b.getByRole("button", { name: "Алгасах" }).click();
  await b.getByRole("radio", { name: "Nova" }).click();
  await b.getByRole("button", { name: "Дуусгах" }).click();
  await b.getByRole("button", { name: "Дараа" }).click();

  // B reads the synastry for free; not the sign reading.
  await b.goto("/readings?tab=mine");
  await expect(b.getByRole("heading", { name: "Надтай хийсэн нийцлүүд" })).toBeVisible();
  await b.goto(synUrl);
  await expect(b.getByText("Танд хуваалцсан нийцэл")).toBeVisible();
  await expect(b.getByRole("region", { name: "Ордны нийцэл" })).toBeVisible();
  expect((await b.goto(signUrl))?.status()).toBe(404);

  // B may also render the share card; the link can't be reused.
  const card = await b.request.get(`/api/share/${synUrl.split("/").pop()}?format=square`);
  expect(card.status()).toBe(200);
  expect(card.headers()["content-type"]).toBe("image/png");
  await b.goto(invitePath);
  await expect(b.getByText("Энэ урилга аль хэдийн ашиглагдсан.")).toBeVisible();

  // A sees Бат as linked.
  await page.goto(`/people/${friendId}`);
  await expect(page.getByText(/Бүртгэлтэй/)).toBeVisible();

  // B unlinks → loses free access; A is offered to delete.
  await b.goto(synUrl);
  await b.getByRole("button", { name: "Намайг хасах" }).click();
  await b
    .getByRole("dialog", { name: "Намайг хасах" })
    .getByRole("button", { name: "Намайг хасах" })
    .click();
  await expect(b).toHaveURL(/\/readings\?tab=mine$/);
  expect((await b.goto(synUrl))?.status()).toBe(404);
  await page.reload();
  await expect(page.getByText("Энэ хүн холбоосоо салгасан")).toBeVisible();
});

test("share cards: owner gets a PNG in both formats; strangers and signed-out get nothing", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await signUpFresh(page, "sharer");
  await topUp10k(page);
  await page.goto("/buy/sign");
  await page.getByRole("link", { name: /Туршилт/ }).click();
  await page.getByRole("button", { name: "Нээх · 1,000₮" }).click();
  await page
    .getByRole("dialog", { name: "Баталгаажуулах" })
    .getByRole("button", { name: "Нээх · 1,000₮" })
    .click();
  await expect(page).toHaveURL(/\/r\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  const id = page.url().split("/").pop()!;

  for (const format of ["story", "square"]) {
    const res = await page.request.get(`/api/share/${id}?format=${format}`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).length).toBeGreaterThan(20_000);
  }
  await page.getByRole("button", { name: "Хуваалцах" }).click();
  await expect(page.getByRole("dialog", { name: "Карт хуваалцах" })).toBeVisible();

  const anon = await browser.newContext();
  expect((await anon.request.get(`/api/share/${id}`)).status()).toBe(401);
  await anon.close();

  const other = await (await browser.newContext()).newPage();
  await signUpFresh(other, "stranger");
  expect((await other.request.get(`/api/share/${id}`)).status()).toBe(404);
});
