import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";

import { APP_NAME, env } from "@/env";
import { db } from "@/server/db";
import { account, session, user, verification } from "@/server/db/schema";
import { sendEmail } from "@/server/email";
import { otpEmail } from "@/server/email/templates";

const e = env();

const socialProviders = {
  ...(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET
    ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
    : {}),
  ...(e.FACEBOOK_CLIENT_ID && e.FACEBOOK_CLIENT_SECRET
    ? { facebook: { clientId: e.FACEBOOK_CLIENT_ID, clientSecret: e.FACEBOOK_CLIENT_SECRET } }
    : {}),
};

export const enabledSocialProviders = Object.keys(socialProviders) as ("google" | "facebook")[];

/**
 * Better Auth (SPEC §5). The email address is the identity.
 * - email + password only when AUTH_PASSWORD_ENABLED (dev/staging), no reset flow
 * - email OTP: 6 digits, 10 min, 5 attempts; signs up new users
 * - Google/Facebook only when their env is set (C9)
 * - DB sessions, 30 days
 */
export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: e.APP_URL,
  secret: e.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  advanced: { database: { generateId: "uuid" } },
  emailAndPassword: {
    enabled: e.AUTH_PASSWORD_ENABLED,
    minPasswordLength: 8,
    autoSignIn: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  user: {
    additionalFields: {
      adultConfirmedAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "email-otp"] },
  },
  socialProviders,
  // SPEC §12: 5/min/IP for login & OTP. Off in dev/test so local E2E runs aren't throttled.
  rateLimit: {
    enabled: e.NODE_ENV === "production",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/email-otp/send-verification-otp": { window: 60, max: 5 },
      "/sign-in/email-otp": { window: 60, max: 5 },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp }) {
        const { subject, text, html } = otpEmail(APP_NAME, otp);
        // Not awaited: avoids leaking account existence via response timing.
        void sendEmail({ to: email, subject, text, html }).catch((err) =>
          console.error("[email] OTP send failed", err),
        );
      },
    }),
    nextCookies(), // must stay last
  ],
});

export type Session = typeof auth.$Infer.Session;
