/** All QPay traffic goes through this interface (CLAUDE.md rule 6; SPEC §4.4). */
type Deeplink = { name: string; logo: string; link: string };

export type Invoice = {
  invoiceId: string;
  qrImage: string; // data URI (PNG/SVG)
  qrText: string;
  deeplinks: Deeplink[];
};

export type PaymentCheck = { paid: boolean; amount: number; paymentId?: string };

export interface QPayProvider {
  readonly mode: "mock" | "sandbox" | "production";
  createInvoice(i: {
    topupId: string;
    amount: number;
    description: string;
    callbackUrl: string;
  }): Promise<Invoice>;
  checkPayment(invoiceId: string): Promise<PaymentCheck>;
}
