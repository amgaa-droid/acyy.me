import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth gate: no session cookie → /login. The real session check
 * (and the "Би" → /onboarding rule) happens server-side in the layouts.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/home/:path*",
    "/people/:path*",
    "/readings/:path*",
    "/me/:path*",
    "/wallet/:path*",
    "/buy/:path*",
    "/r/:path*",
    "/onboarding/:path*",
    "/admin/:path*",
  ],
};
