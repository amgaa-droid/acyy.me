import { describe, expect, it } from "vitest";

import { QPayApiError, QPayV2Provider } from "./v2";

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: Record<string, (call: Call) => { status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const impl = async (url: string | URL | Request, init: RequestInit = {}) => {
    const call = { url: String(url), init };
    calls.push(call);
    const path = new URL(call.url).pathname;
    const r = responses[path](call);
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  };
  return { fetch: impl as typeof fetch, calls };
}

const cfg = {
  mode: "sandbox" as const,
  baseUrl: "https://merchant-sandbox.qpay.mn",
  clientId: "TEST_MERCHANT",
  clientSecret: "secret",
  invoiceCode: "TEST_INVOICE",
};

describe("QPayV2Provider", () => {
  it("authenticates once, creates an invoice and maps deeplinks", async () => {
    const { fetch, calls } = fakeFetch({
      "/v2/auth/token": () => ({ body: { access_token: "tok", expires_in: 3600 } }),
      "/v2/invoice": () => ({
        body: {
          invoice_id: "inv-1",
          qr_text: "000201…",
          qr_image: "iVBORw0KGgo=",
          urls: [
            {
              name: "Khan bank",
              description: "Хаан банк",
              logo: "https://x/khan.png",
              link: "khanbank://q?qPay_QRcode=…",
            },
          ],
        },
      }),
    });
    const qpay = new QPayV2Provider({ ...cfg, fetch });
    const inv = await qpay.createInvoice({
      topupId: "t1",
      amount: 10_000,
      description: "d",
      callbackUrl: "https://a/cb",
    });
    await qpay.createInvoice({
      topupId: "t2",
      amount: 2_000,
      description: "d",
      callbackUrl: "https://a/cb",
    });

    expect(inv).toEqual({
      invoiceId: "inv-1",
      qrText: "000201…",
      qrImage: "data:image/png;base64,iVBORw0KGgo=",
      deeplinks: [
        { name: "Хаан банк", logo: "https://x/khan.png", link: "khanbank://q?qPay_QRcode=…" },
      ],
    });
    expect(calls.filter((c) => c.url.endsWith("/v2/auth/token"))).toHaveLength(1);
    const auth = (calls[0].init.headers as Record<string, string>).Authorization;
    expect(auth).toBe(`Basic ${Buffer.from("TEST_MERCHANT:secret").toString("base64")}`);
    const body = JSON.parse(String(calls[1].init.body));
    expect(body).toMatchObject({
      invoice_code: "TEST_INVOICE",
      sender_invoice_no: "t1",
      amount: 10_000,
      callback_url: "https://a/cb",
    });
  });

  it("checkPayment: paid rows → paid with amount and payment id", async () => {
    const { fetch } = fakeFetch({
      "/v2/auth/token": () => ({ body: { access_token: "tok", expires_in: 3600 } }),
      "/v2/payment/check": () => ({
        body: {
          count: 1,
          paid_amount: 10_000,
          rows: [{ payment_id: "p-9", payment_status: "PAID", payment_amount: "10000.00" }],
        },
      }),
    });
    expect(await new QPayV2Provider({ ...cfg, fetch }).checkPayment("inv-1")).toEqual({
      paid: true,
      amount: 10_000,
      paymentId: "p-9",
    });
  });

  it("checkPayment: no paid rows → not paid", async () => {
    const { fetch } = fakeFetch({
      "/v2/auth/token": () => ({ body: { access_token: "tok", expires_in: 3600 } }),
      "/v2/payment/check": () => ({ body: { count: 0, rows: [] } }),
    });
    expect(await new QPayV2Provider({ ...cfg, fetch }).checkPayment("inv-1")).toEqual({
      paid: false,
      amount: 0,
    });
  });

  it("refreshes the token once on 401, surfaces other errors", async () => {
    let n = 0;
    const { fetch, calls } = fakeFetch({
      "/v2/auth/token": () => ({ body: { access_token: `tok${++n}`, expires_in: 3600 } }),
      "/v2/payment/check": (c) =>
        (c.init.headers as Record<string, string>).Authorization === "Bearer tok1"
          ? { status: 401, body: {} }
          : { body: { count: 0 } },
    });
    await new QPayV2Provider({ ...cfg, fetch }).checkPayment("x");
    expect(calls.filter((c) => c.url.endsWith("/v2/auth/token"))).toHaveLength(2);

    const bad = fakeFetch({
      "/v2/auth/token": () => ({ body: { access_token: "t", expires_in: 3600 } }),
      "/v2/invoice": () => ({ status: 400, body: { error: "INVOICE_CODE_INVALID" } }),
    });
    await expect(
      new QPayV2Provider({ ...cfg, fetch: bad.fetch }).createInvoice({
        topupId: "t",
        amount: 1,
        description: "d",
        callbackUrl: "u",
      }),
    ).rejects.toBeInstanceOf(QPayApiError);
  });
});
