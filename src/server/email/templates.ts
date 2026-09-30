/** Email templates (Mongolian). Plain text first; HTML is a light wrapper. */

export function otpEmail(appName: string, code: string) {
  const subject = `${appName}: нэвтрэх код ${code}`;
  const text = [
    `Таны нэвтрэх код: ${code}`,
    "",
    "Код 10 минутын турш хүчинтэй. Хэрэв та хүсээгүй бол энэ имэйлийг үл тоомсорлоно уу.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">
<p>Таны нэвтрэх код:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px">${code}</p>
<p style="color:#6b6880">Код 10 минутын турш хүчинтэй. Хэрэв та хүсээгүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
</div>`;
  return { subject, text, html };
}
