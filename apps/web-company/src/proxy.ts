import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkRateLimit,
  getClientIp,
  getRateLimitHeaders,
  RATE_LIMIT_CONFIGS,
} from "@/lib/security/rate-limiter";

import { REFRESH_COOKIE } from "@/lib/gateway/cookie-names";

/**
 * What "signed in" means to the middleware.
 *
 * The refresh cookie, not the access one: the access token lives fifteen
 * minutes, and gating on it would bounce a user to the sign-in screen every
 * quarter of an hour even though the session behind them is perfectly alive and
 * the very next server render would have renewed it.
 *
 * This is only a redirect decision. The cookie is not evidence of anything — it
 * is opaque to this app and could be any string — so nothing is authorized here.
 * The gateway verifies the real token on every call it receives.
 */
const SESSION_COOKIE_NAME = REFRESH_COOKIE;

// Public paths that do not require authentication
const PUBLIC_PREFIXES = [
  "/login",
  "/careers",
  "/api/auth",
  "/api/upload",
  "/_next",
  "/favicon.ico",
  "/icon.png",
  "/logo.png",
];

/**
 * Attaches enterprise HTTP security headers to responses
 */
function applySecurityHeaders(res: NextResponse): NextResponse {
  // Prevent clickjacking by disallowing framing
  res.headers.set("X-Frame-Options", "DENY");

  // Prevent MIME type sniffing
  res.headers.set("X-Content-Type-Options", "nosniff");

  // Control referrer information sent in requests
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Restrict sensitive browser features
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Enable XSS filter protection in supported legacy browsers
  res.headers.set("X-XSS-Protection", "1; mode=block");

  return res;
}

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const sessionCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const clientIp = getClientIp(req);

  // 1. Global API rate limiting protection
  if (pathname.startsWith("/api/")) {
    const rateLimit = checkRateLimit(
      `api_global:${clientIp}`,
      RATE_LIMIT_CONFIGS.API.limit,
      RATE_LIMIT_CONFIGS.API.windowMs,
    );

    if (!rateLimit.allowed) {
      const errorRes = NextResponse.json(
        {
          error: "Too Many Requests",
          message: "API rate limit exceeded. Please slow down.",
          retryAfter: rateLimit.retryAfter,
        },
        {
          status: 429,
          headers: getRateLimitHeaders(rateLimit),
        },
      );
      return applySecurityHeaders(errorRes);
    }
  }

  // 2. Check if the path is explicitly public
  const isPublic = PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // 3. If logged in and visiting /login, redirect to dashboard
  if (pathname === "/login") {
    if (sessionCookie) {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      return applySecurityHeaders(res);
    }
    const res = NextResponse.next();
    return applySecurityHeaders(res);
  }

  // 4. If accessing root "/", redirect based on auth status
  if (pathname === "/") {
    if (sessionCookie) {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      return applySecurityHeaders(res);
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    return applySecurityHeaders(res);
  }

  // 5. If not a public route and user has no session cookie, redirect to login
  if (!isPublic && !sessionCookie) {
    const redirectTarget = `${pathname}${search}`;
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", redirectTarget);
    const res = NextResponse.redirect(loginUrl);
    return applySecurityHeaders(res);
  }

  const res = NextResponse.next();
  return applySecurityHeaders(res);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo.png, etc.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
