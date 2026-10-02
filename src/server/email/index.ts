import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import { env } from "@/env";
import { recordEmail } from "./outbox";

type EmailMessage = { to: string; subject: string; text: string; html?: string };

let smtp: Transporter | undefined;

/**
 * Sends an email via the configured transport:
 * smtp (Mailpit locally), resend (production), console (log only).
 * Every message is also kept in the dev outbox (/dev/mail) outside production.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const { EMAIL_TRANSPORT, EMAIL_FROM, SMTP_URL, RESEND_API_KEY } = env();
  recordEmail(message);

  switch (EMAIL_TRANSPORT) {
    case "smtp": {
      smtp ??= nodemailer.createTransport(SMTP_URL);
      await smtp.sendMail({ from: EMAIL_FROM, ...message });
      return;
    }
    case "resend": {
      if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: EMAIL_FROM, ...message }),
      });
      if (!res.ok) throw new Error(`Resend failed: ${res.status} ${await res.text()}`);
      return;
    }
    case "console":
      if (process.env.NODE_ENV === "production") {
        console.warn("[email] EMAIL_TRANSPORT=console: nothing is sent, messages are only logged");
      }
      console.info(`[email] to=${message.to} subject=${message.subject}\n${message.text}`);
      return;
  }
}
