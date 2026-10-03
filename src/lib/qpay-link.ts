import type { InvoiceData } from "@/server/db/schema";

/**
 * The one link the invoice screen offers on phones (SPEC §4.3), not a bank list. QPay's https
 * payment page when the invoice has one — an app deeplink does nothing on a phone without that
 * app or in an in-app browser; else QPay's own entry from the invoice urls; else its deeplink
 * built from the QR text.
 */
export function qpayAppLink(
  invoice: Pick<InvoiceData, "qrText" | "deeplinks" | "shortUrl">,
): string {
  if (invoice.shortUrl && /^https:\/\//i.test(invoice.shortUrl)) return invoice.shortUrl;
  const own = invoice.deeplinks.find(
    (d) => /^qpay/i.test(d.link) || /qpay/i.test(d.name.replace(/\s/g, "")),
  );
  return own?.link ?? `qpaywallet://q?qPay_QRcode=${encodeURIComponent(invoice.qrText)}`;
}
