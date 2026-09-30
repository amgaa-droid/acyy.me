import type { Invoice, PaymentCheck, QPayProvider } from "./types";

type Config = {
  mode: "sandbox" | "production";
  baseUrl: string; // sandbox: https://merchant-sandbox.qpay.mn, prod: https://merchant.qpay.mn
  clientId: string;
  clientSecret: string;
  invoiceCode: string;
  fetch?: typeof fetch;
};

type TokenResponse = { access_token: string; expires_in: number };
type InvoiceResponse = {
  invoice_id: string;
  qr_text: string;
  qr_image: string; // base64 PNG
  urls?: { name: string; description?: string; logo: string; link: string }[];
};
type CheckResponse = {
  count: number;
  paid_amount?: number;
  rows?: { payment_id: string; payment_status: string; payment_amount: string | number }[];
};

export class QPayApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`QPay API ${status}`);
  }
}

/** QPay Merchant API v2 (SPEC §4.4). The access token is cached in memory until it expires. */
export class QPayV2Provider implements QPayProvider {
  readonly mode: "sandbox" | "production";
  private token: { value: string; expiresAt: number } | null = null;
  private http: typeof fetch;

  constructor(private cfg: Config) {
    this.mode = cfg.mode;
    this.http = cfg.fetch ?? fetch;
  }

  private async accessToken(): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt) return this.token.value;
    const basic = Buffer.from(`${this.cfg.clientId}:${this.cfg.clientSecret}`).toString("base64");
    const res = await this.http(`${this.cfg.baseUrl}/v2/auth/token`, {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!res.ok) throw new QPayApiError(res.status, await res.text());
    const data = (await res.json()) as TokenResponse;
    // Refresh a minute early; expires_in is in seconds.
    this.token = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
    };
    return this.token.value;
  }

  private async post<T>(path: string, body: unknown, retry = true): Promise<T> {
    const res = await this.http(`${this.cfg.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${await this.accessToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (res.status === 401 && retry) {
      this.token = null;
      return this.post<T>(path, body, false);
    }
    if (!res.ok) throw new QPayApiError(res.status, await res.text());
    return (await res.json()) as T;
  }

  async createInvoice(i: {
    topupId: string;
    amount: number;
    description: string;
    callbackUrl: string;
  }): Promise<Invoice> {
    const data = await this.post<InvoiceResponse>("/v2/invoice", {
      invoice_code: this.cfg.invoiceCode,
      sender_invoice_no: i.topupId,
      invoice_receiver_code: "terminal",
      invoice_description: i.description,
      amount: i.amount,
      callback_url: i.callbackUrl,
    });
    return {
      invoiceId: data.invoice_id,
      qrText: data.qr_text,
      qrImage: data.qr_image.startsWith("data:")
        ? data.qr_image
        : `data:image/png;base64,${data.qr_image}`,
      deeplinks: (data.urls ?? []).map((u) => ({
        name: u.description || u.name,
        logo: u.logo,
        link: u.link,
      })),
    };
  }

  async checkPayment(invoiceId: string): Promise<PaymentCheck> {
    const data = await this.post<CheckResponse>("/v2/payment/check", {
      object_type: "INVOICE",
      object_id: invoiceId,
      offset: { page_number: 1, page_limit: 100 },
    });
    const paidRows = (data.rows ?? []).filter((r) => r.payment_status === "PAID");
    if (paidRows.length === 0) return { paid: false, amount: 0 };
    const amount = data.paid_amount ?? paidRows.reduce((s, r) => s + Number(r.payment_amount), 0);
    return { paid: true, amount: Math.round(amount), paymentId: paidRows[0].payment_id };
  }
}
