import type { NextConfig } from "next";

/**
 * Sent with every response. No page may be framed (the buy and top-up buttons must not be
 * clickjacked), forms post only to us, and referrers to other sites carry the origin alone — an
 * invitation token lives in the URL. Pages get a fuller Content-Security-Policy with a script
 * nonce from src/proxy.ts, which replaces the one below.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // The floating dev badge sits on top of the bottom tab bar; errors still show in the overlay.
  devIndicators: false,
  // Share cards read their Cyrillic fonts from disk at runtime.
  outputFileTracingIncludes: {
    "/api/share/[purchaseId]": ["./src/assets/fonts/**/*"],
  },
};

export default nextConfig;
