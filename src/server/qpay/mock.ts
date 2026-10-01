import QRCode from "qrcode";

import type { Invoice, PaymentCheck, QPayProvider } from "./types";

export type MockInvoice = {
  topupId: string;
  amount: number;
  callbackUrl: string;
  paid: boolean;
  paymentId?: string;
};

/**
 * Local stand-in for QPay (QPAY_MODE=mock). Invoices live in memory; the dev page
 * /dev/qpay/[invoiceId] marks one paid and then calls the real callback URL.
 * The QR encodes that page, so a phone on the LAN can "pay" a desktop invoice.
 */
export class MockQPayProvider implements QPayProvider {
  readonly mode = "mock" as const;
  private invoices: Map<string, MockInvoice>;

  constructor(
    private appUrl: string,
    store?: Map<string, MockInvoice>,
  ) {
    this.invoices = store ?? new Map();
  }

  async createInvoice(i: {
    topupId: string;
    amount: number;
    callbackUrl: string;
  }): Promise<Invoice> {
    const invoiceId = `mock_${i.topupId}`;
    this.invoices.set(invoiceId, {
      topupId: i.topupId,
      amount: i.amount,
      callbackUrl: i.callbackUrl,
      paid: false,
    });
    const payUrl = `${this.appUrl}/dev/qpay/${invoiceId}`;
    return {
      invoiceId,
      qrText: payUrl,
      qrImage: await QRCode.toDataURL(payUrl, { margin: 1, width: 320 }),
      deeplinks: [{ name: "qPay wallet", logo: "", link: payUrl }],
    };
  }

  async checkPayment(invoiceId: string): Promise<PaymentCheck> {
    const inv = this.invoices.get(invoiceId);
    if (!inv?.paid) return { paid: false, amount: 0 };
    return { paid: true, amount: inv.amount, paymentId: inv.paymentId };
  }

  /** Dev page / tests: simulate the customer paying in their bank app. */
  markPaid(invoiceId: string, amount?: number): MockInvoice | undefined {
    const inv = this.invoices.get(invoiceId);
    if (!inv) return undefined;
    inv.paid = true;
    inv.paymentId ??= `mockpay_${invoiceId}`;
    if (amount !== undefined) inv.amount = amount;
    return inv;
  }

  get(invoiceId: string): MockInvoice | undefined {
    return this.invoices.get(invoiceId);
  }
}
