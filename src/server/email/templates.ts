import { COSMIC } from "@/lib/palette";

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
<p style="color:${COSMIC.muted}">Код 10 минутын турш хүчинтэй. Хэрэв та хүсээгүй бол энэ имэйлийг үл тоомсорлоно уу.</p>
</div>`;
  return { subject, text, html };
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

export function invitationEmail(appName: string, inviterName: string, link: string) {
  const who = inviterName || "Таны найз";
  const subject = `${who} таныг ${appName}-д урьж байна`;
  const text = [
    `${who} таныг ${appName}-д урьж байна.`,
    "Хамтдаа ордны болон төрсөн үеийн нийцлээ хараарай.",
    "",
    link,
    "",
    "Урилга 7 хоногийн турш хүчинтэй бөгөөд нэг удаа ашиглагдана.",
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5">
<p><b>${escapeHtml(who)}</b> таныг ${escapeHtml(appName)}-д урьж байна.</p>
<p>Хамтдаа ордны болон төрсөн үеийн нийцлээ хараарай.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:${COSMIC.fg};color:${COSMIC.surface};text-decoration:none">Урилга хүлээн авах</a></p>
<p style="color:${COSMIC.muted};font-size:13px">Урилга 7 хоногийн турш хүчинтэй бөгөөд нэг удаа ашиглагдана.</p>
</div>`;
  return { subject, text, html };
}
