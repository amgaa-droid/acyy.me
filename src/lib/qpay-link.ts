import type { InvoiceData } from "@/server/db/schema";

/**
 * The one link the invoice screen offers on phones: the QPay app (SPEC §4.3), not a bank list.
 * QPay's own entry from the invoice urls when present; else its deeplink built from the QR text.
 */
export function qpayAppLink(invoice: Pick<InvoiceData, "qrText" | "deeplinks">): string {
  const own = invoice.deeplinks.find(
    (d) => /^qpay/i.test(d.link) || /qpay/i.test(d.name.replace(/\s/g, "")),
  );
  return own?.link ?? `qpaywallet://q?qPay_QRcode=${encodeURIComponent(invoice.qrText)}`;
}
