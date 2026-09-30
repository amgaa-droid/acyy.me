import { z } from "zod";

/** Server-side environment. Validated lazily so builds without a DB still work. */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_NAME: z.string().min(1).default("Зурхай"),
  APP_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  AUTH_PASSWORD_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  QPAY_MODE: z.enum(["mock", "sandbox", "production"]).default("mock"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function env(): ServerEnv {
  cached ??= serverEnvSchema.parse(process.env);
  return cached;
}

/** Public app name; safe for client bundles when passed as a prop from the server. */
export const APP_NAME = process.env.APP_NAME || "Зурхай";
