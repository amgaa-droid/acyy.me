import { describe, expect, it } from "vitest";

import { invitationEmail, otpEmail } from "./templates";

describe("email templates", () => {
  it("OTP email carries the code", () => {
    const m = otpEmail("Зурхай", "123456");
    expect(m.subject).toContain("123456");
    expect(m.text).toContain("123456");
  });

  it("invitation email links and escapes names", () => {
    const m = invitationEmail("Зурхай", "<b>Анар</b>", "http://localhost:3000/invite/abc");
    expect(m.subject).toBe("<b>Анар</b> таныг Зурхай-д урьж байна");
    expect(m.text).toContain("http://localhost:3000/invite/abc");
    expect(m.html).toContain("&lt;b&gt;Анар&lt;/b&gt;");
    expect(m.html).not.toContain("<b><b>");
  });
});
