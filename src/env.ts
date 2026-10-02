import { z } from "zod";

const bool = (fallback: "true" | "false") =>
  z
    .enum(["true", "false"])
    .default(fallback)
    .transform((v) => v === "true");

const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

/** Server-side environment. Validated lazily so importing modules never requires a full env. */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("Зурхай"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).default(10),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET: openssl rand -base64 32"),
  AUTH_PASSWORD_ENABLED: bool("false"),
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  FACEBOOK_CLIENT_ID: optional,
  FACEBOOK_CLIENT_SECRET: optional,
  ADMIN_OWNER_EMAILS: z.string().default(""),
  ADMIN_EDITOR_EMAILS: z.string().default(""),

  EMAIL_TRANSPORT: z.enum(["smtp", "resend", "console"]).default("console"),
  SMTP_URL: z.string().default("smtp://localhost:1025"),
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("Зурхай <no-reply@localhost>"),

  QPAY_MODE: z.enum(["mock", "sandbox", "production"]).default("mock"),
  QPAY_CLIENT_ID: optional,
  QPAY_CLIENT_SECRET: optional,
  QPAY_INVOICE_CODE: optional,
  QPAY_BASE_URL: optional,
  QPAY_CALLBACK_SECRET: z.string().min(32, "QPAY_CALLBACK_SECRET: openssl rand -hex 32"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET: openssl rand -hex 32"),
  /** Seals API keys saved on /admin/ai. Unset → keys can't be saved (the page says so). */
  SETTINGS_ENCRYPTION_KEY: z
    .string()
    .min(32, "SETTINGS_ENCRYPTION_KEY: openssl rand -hex 32")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

/** Public app name; safe for client bundles when passed as a prop from the server. */
export const APP_NAME = process.env.APP_NAME || "Зурхай";
