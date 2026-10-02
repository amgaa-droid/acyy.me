/**
 * The page Content-Security-Policy (set per request in src/proxy.ts). Everything comes from our
 * own origin: scripts must carry the request's nonce (Next.js adds it to its own), images may
 * also be data:/blob: (avatars, the QPay QR, a share card being saved). Styles allow inline
 * because positions are set with `style` attributes, which a nonce can't cover.
 * Development additionally needs eval (React's debugging) and the hot-reload websocket.
 */
export function contentSecurityPolicy(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}
