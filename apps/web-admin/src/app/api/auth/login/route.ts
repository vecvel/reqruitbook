import { NextResponse } from "next/server";

import { gatewayFetch, unreachableProblem } from "@/lib/gateway";
import { clearSession, persistSession, type AuthResult } from "@/lib/session";

export const runtime = "nodejs";
// Signing in must never be served from a cache, per-request or otherwise.
export const dynamic = "force-dynamic";

/**
 * Signs a platform operator in.
 *
 * `realm: "platform"` is set here rather than taken from the request body.
 * The browser has no say in which realm it is authenticating against — this is
 * the platform console, and the only realm it can sign anyone into is the one
 * the portal exists for.
 */
export async function POST(request: Request): Promise<Response> {
  let payload: { email?: unknown; password?: unknown };
  try {
    payload = (await request.json()) as typeof payload;
  } catch {
    return problem(400, "bad_request", "The sign-in request was malformed.");
  }

  const email = typeof payload.email === "string" ? payload.email.trim() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  const fieldErrors: Record<string, string[]> = {};
  if (!email) fieldErrors["email"] = ["Enter your work email address."];
  if (!password) fieldErrors["password"] = ["Enter your password."];
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Check the highlighted fields and try again.",
        code: "validation_failed",
        errors: fieldErrors,
      },
      { status: 422, headers: { "content-type": "application/problem+json" } },
    );
  }

  let upstream;
  try {
    upstream = await gatewayFetch({
      method: "POST",
      path: "/api/v1/auth/login",
      body: JSON.stringify({ realm: "platform", email, password }),
      headers: forwardedClientHeaders(request),
    });
  } catch {
    const fallback = unreachableProblem("/api/auth/login");
    return new NextResponse(fallback.body, { status: fallback.status, headers: fallback.headers });
  }

  if (upstream.status !== 200) {
    // The gateway's problem document reaches the browser untouched, so the form
    // can render exactly what the server said rather than a guess at it.
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: { "content-type": upstream.headers.get("content-type") ?? "application/problem+json" },
    });
  }

  const result = JSON.parse(upstream.body) as AuthResult;

  if (result.identity.realm !== "platform") {
    await clearSession();
    return problem(
      403,
      "wrong_portal",
      "This console is for platform staff. Sign in to your own workspace instead.",
    );
  }

  const session = await persistSession(result);

  // The access token travels in the body, not a script-readable cookie: the
  // browser holds it in memory inside the ApiClient for the next 15 minutes.
  return NextResponse.json(session);
}

/**
 * The few request headers worth passing upstream.
 *
 * The identity service records the sign-in attempt's origin for audit and rate
 * limiting, and a proxy that swallows them makes every attempt look like it
 * came from the web tier.
 */
function forwardedClientHeaders(request: Request): Headers {
  const forwarded = new Headers();
  for (const name of ["user-agent", "x-forwarded-for", "x-real-ip"]) {
    const value = request.headers.get(name);
    if (value) forwarded.set(name, value);
  }
  return forwarded;
}

function problem(status: number, code: string, detail: string): NextResponse {
  return NextResponse.json(
    { type: "about:blank", title: codeTitle(status), status, detail, code },
    { status, headers: { "content-type": "application/problem+json" } },
  );
}

function codeTitle(status: number): string {
  if (status === 400) return "Bad Request";
  if (status === 403) return "Forbidden";
  return "Error";
}
