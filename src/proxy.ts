import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { contentSecurityPolicy } from "@/lib/csp";

/** Signed-in areas. The real session check (and "Би" → /onboarding) happens in the pages. */
const PRIVATE = /^\/(home|people|readings|me|wallet|help|buy|r|onboarding|admin)(\/|$)/;

/**
 * Runs for every page request (not for /api or static files):
 * - optimistic auth gate: a private area without a session cookie → /login;
 * - a Content-Security-Policy with a fresh nonce. Next.js reads the nonce from the request
 *   header and puts it on its own scripts, so only they (and what they load) can run.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PRIVATE.test(pathname) && !getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|pwa/).*)",
      // A prefetch gets no document, so it needs no nonce.
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
