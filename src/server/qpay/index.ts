import "server-only";

import { env } from "@/env";
import { MockQPayProvider, type MockInvoice } from "./mock";
import type { QPayProvider } from "./types";
import { QPayV2Provider } from "./v2";

const DEFAULT_BASE = {
  sandbox: "https://merchant-sandbox.qpay.mn",
  production: "https://merchant.qpay.mn",
} as const;

const g = globalThis as unknown as {
  __qpay?: QPayProvider;
  __mockInvoices?: Map<string, MockInvoice>;
};

/** The configured provider (QPAY_MODE). One instance per process so the token/mock state is shared. */
export function qpay(): QPayProvider {
  if (g.__qpay) return g.__qpay;
  const e = env();
  if (e.QPAY_MODE === "mock") {
    if (e.NODE_ENV === "production" && !process.env.ALLOW_QPAY_MOCK) {
      // staging runs mock on purpose (C8); a real production must not.
      console.warn("[qpay] QPAY_MODE=mock in production build");
    }
    g.__mockInvoices ??= new Map();
    g.__qpay = new MockQPayProvider(e.APP_URL, g.__mockInvoices);
  } else {
    const { QPAY_CLIENT_ID, QPAY_CLIENT_SECRET, QPAY_INVOICE_CODE } = e;
    if (!QPAY_CLIENT_ID || !QPAY_CLIENT_SECRET || !QPAY_INVOICE_CODE) {
      throw new Error("QPAY_CLIENT_ID, QPAY_CLIENT_SECRET and QPAY_INVOICE_CODE are required");
    }
    g.__qpay = new QPayV2Provider({
      mode: e.QPAY_MODE,
      baseUrl: e.QPAY_BASE_URL ?? DEFAULT_BASE[e.QPAY_MODE],
      clientId: QPAY_CLIENT_ID,
      clientSecret: QPAY_CLIENT_SECRET,
      invoiceCode: QPAY_INVOICE_CODE,
    });
  }
  return g.__qpay;
}

/** The mock provider, or null when a real QPay is configured. */
export function mockQPay(): MockQPayProvider | null {
  const p = qpay();
  // Check the mode, not `instanceof`: dev hot reloads can leave a cached instance of an older class.
  return p.mode === "mock" ? (p as MockQPayProvider) : null;
}
