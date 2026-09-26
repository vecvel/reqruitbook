import { NextResponse } from "next/server";

import { readAccessToken, readIdentity, refreshSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hands the browser the session to hold in memory on a fresh page load.
 *
 * Reading the still-valid access cookie rather than refreshing means a page
 * load — or ten tabs opened at once — costs zero refreshes. Refresh tokens
 * rotate on use and a replayed one revokes every session the account has, so
 * "refresh on boot" is not a harmless simplification; it is a race that signs
 * the operator out of everything.
 */
export async function GET(): Promise<Response> {
  const identity = await readIdentity();

  if (identity) {
    const accessToken = await readAccessToken();
    if (accessToken) {
      return NextResponse.json({ ...identity, accessToken, expiresAt: expiryOf(accessToken) });
    }
  }

  // No usable access token, but possibly a live refresh cookie.
  const session = await refreshSession();
  if (session) {
    return NextResponse.json(session);
  }

  return NextResponse.json(
    {
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail: "Your session has ended. Please sign in again.",
      code: "session_expired",
    },
    { status: 401, headers: { "content-type": "application/problem+json" } },
  );
}

/**
 * The token's own expiry, read from its payload.
 *
 * The claim is not trusted for anything — the gateway verifies the signature
 * and will reject an expired token regardless. It is used only so the client
 * knows roughly when to stop assuming the token is good.
 */
function expiryOf(accessToken: string): number {
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return Date.now();
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof claims.exp === "number" ? claims.exp * 1000 : Date.now();
  } catch {
    return Date.now();
  }
}
