import { describe, expect, it } from "vitest";

import { qpayAppLink } from "./qpay-link";

describe("qpayAppLink", () => {
  it("prefers QPay's https payment page, which opens without the app", () => {
    expect(
      qpayAppLink({
        qrText: "0002",
        shortUrl: "https://s.qpay.mn/abc",
        deeplinks: [{ name: "qPay wallet", logo: "", link: "qpaywallet://q?qPay_QRcode=0002" }],
      }),
    ).toBe("https://s.qpay.mn/abc");
  });

  it("ignores a short url that isn't https", () => {
    expect(
      qpayAppLink({ qrText: "0002", shortUrl: "javascript:alert(1)", deeplinks: [] }),
    ).toBe("qpaywallet://q?qPay_QRcode=0002");
  });

  it("uses QPay's own entry from the invoice urls", () => {
    expect(
      qpayAppLink({
        qrText: "0002",
        deeplinks: [
          { name: "Хаан банк", logo: "", link: "khanbank://q?qPay_QRcode=0002" },
          { name: "qPay wallet", logo: "", link: "qpaywallet://q?qPay_QRcode=0002" },
        ],
      }),
    ).toBe("qpaywallet://q?qPay_QRcode=0002");
  });

  it("builds the QPay deeplink from the QR text when QPay sent no entry", () => {
    expect(
      qpayAppLink({
        qrText: "00 02&x",
        deeplinks: [{ name: "Хаан банк", logo: "", link: "khanbank://q" }],
      }),
    ).toBe("qpaywallet://q?qPay_QRcode=00%2002%26x");
  });
});
