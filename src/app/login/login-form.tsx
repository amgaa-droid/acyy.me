"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { FacebookLogo, GoogleLogo } from "@/components/app/brand-logos";
import { Button } from "@/components/ui/button";
import { mn } from "@/i18n/mn";
import { authClient } from "@/lib/auth-client";

type Props = {
  next: string;
  passwordEnabled: boolean;
  providers: ("google" | "facebook")[];
  /** Error code of a failed Google/Facebook sign-in (from the callback's ?error=…). */
  socialError?: string;
  /** Local dev without a mail server: point to the /dev/mail outbox. */
  devMail?: boolean;
};

type AuthError = { status?: number; code?: string; message?: string } | null | undefined;

function errorText(error: AuthError): string {
  const t = mn.login.errors;
  if (!error) return t.generic;
  if (error.status === 429) return t.tooMany;
  const code = error.code ?? "";
  if (code.includes("OTP") || code.includes("TOO_MANY_ATTEMPTS")) return t.invalidCode;
  if (code === "INVALID_EMAIL_OR_PASSWORD") return t.invalidCredentials;
  if (code === "PASSWORD_TOO_SHORT") return t.passwordShort;
  if (code === "INVALID_EMAIL") return t.invalidEmail;
  return t.generic;
}

const inputClass =
  "h-12 w-full rounded-2xl border bg-bg px-4 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A provider account that can't join the existing account with its email → say how to get in. */
function socialErrorText(code: string): string {
  return /link/i.test(code) ? mn.login.errors.socialNotLinked : mn.login.errors.generic;
}

export function LoginForm({
  next,
  passwordEnabled,
  providers,
  socialError,
  devMail = false,
}: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(
    socialError ? socialErrorText(socialError) : null,
  );

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  const run = async (fn: () => Promise<{ error: AuthError }>, onOk: () => void) => {
    setPending(true);
    setError(null);
    try {
      const { error } = await fn();
      if (error) setError(errorText(error));
      else onOk();
    } catch {
      setError(mn.login.errors.generic);
    } finally {
      setPending(false);
    }
  };

  const sendCode = (e?: FormEvent) => {
    e?.preventDefault();
    return run(
      () => authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: "sign-in" }),
      () => setCodeSent(true),
    );
  };

  const verify = (e: FormEvent) => {
    e.preventDefault();
    return run(() => authClient.signIn.emailOtp({ email: email.trim(), otp: otp.trim() }), done);
  };

  const signInPassword = () =>
    run(() => authClient.signIn.email({ email: email.trim(), password }), done);

  const signUpPassword = () =>
    run(
      () =>
        authClient.signUp.email({
          email: email.trim(),
          password,
          name: email.trim().split("@")[0] || "user",
        }),
      done,
    );

  return (
    <div className="mt-6 flex flex-col gap-4">
      {providers.map((p) => (
        <Button
          key={p}
          type="button"
          variant="outline"
          size="lg"
          className="rounded-full"
          disabled={pending}
          onClick={() =>
            authClient.signIn.social({
              provider: p,
              callbackURL: next,
              errorCallbackURL: `/login?next=${encodeURIComponent(next)}`,
            })
          }
        >
          {p === "google" ? (
            <GoogleLogo className="size-4.5" />
          ) : (
            <FacebookLogo className="size-5" />
          )}
          {p === "google" ? mn.login.google : mn.login.facebook}
        </Button>
      ))}
      {providers.length > 0 && <Divider label={mn.login.or} />}

      {!codeSent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {mn.login.email}
            <input
              className={inputClass}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              placeholder={mn.login.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <Button type="submit" size="lg" className="rounded-full" disabled={pending || !email}>
            {mn.login.sendCode}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {mn.login.codeSentTo} <span className="font-semibold text-fg">{email}</span>
          </p>
          {devMail && (
            <p className="rounded-2xl bg-tint-1 px-4 py-3 text-sm">
              {mn.login.devMailHint}{" "}
              <a
                href="/dev/mail"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-highlight underline"
              >
                {mn.login.devMailLink}
              </a>
            </p>
          )}
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {mn.login.code}
            <input
              className={`${inputClass} text-center text-2xl tracking-[0.5em] tabular-nums`}
              name="otp"
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <Button
            type="submit"
            size="lg"
            className="rounded-full"
            disabled={pending || otp.length !== 6}
          >
            {mn.login.verify}
          </Button>
          <div className="flex justify-between text-sm">
            <button
              type="button"
              className="h-11 text-muted-foreground"
              onClick={() => setCodeSent(false)}
            >
              {mn.login.changeEmail}
            </button>
            <button
              type="button"
              className="h-11 font-semibold text-highlight"
              onClick={() => sendCode()}
              disabled={pending}
            >
              {mn.login.resend}
            </button>
          </div>
        </form>
      )}

      {passwordEnabled && !codeSent && (
        <>
          <Divider label={mn.login.passwordSection} />
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {mn.login.password}
              <input
                className={inputClass}
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="rounded-full"
                disabled={pending || !email || !password}
                onClick={signInPassword}
              >
                {mn.login.signIn}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                className="rounded-full"
                disabled={pending || !email || !password}
                onClick={signUpPassword}
              >
                {mn.login.signUp}
              </Button>
            </div>
          </div>
        </>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" />
      {label}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
