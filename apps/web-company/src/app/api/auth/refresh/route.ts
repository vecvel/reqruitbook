import { NextResponse } from "next/server";

import {
  clearSession,
  exchangeRefreshToken,
  readRefreshToken,
  storeSession,
} from "@/lib/gateway/tokens";

/**
 * The only thing that reads the refresh cookie.
 *
 * The browser never sees the refresh token — it is httpOnly — so a page that
 * needs an access token asks this route for one. What comes back is the access
 * token and the identity behind it, which the client keeps in memory and
 * forgets when the tab closes.
 *
 * Identity rotates the refresh token on every exchange and treats a replayed
 * one as theft, revoking every session on the account. `exchangeRefreshToken`
 * therefore single-flights on the token value, so several tabs waking at once
 * cannot turn one expiry into a sign-out everywhere.
 */
export async function POST() {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return problem(401, "no_session", "Unauthorized", "You are not signed in.");
  }

  const result = await exchangeRefreshToken(refreshToken);
  if (!result) {
    // The token is spent, expired or revoked. Dropping the cookies here stops
    // the browser presenting it again and turning an expiry into a replay.
    await clearSession();
    return problem(401, "session_expired", "Unauthorized", "Your session has expired. Please sign in again.");
  }

  await storeSession(result);

  return NextResponse.json({
    accessToken: result.tokens.accessToken,
    expiresAt: new Date(result.tokens.expiresAt).getTime(),
    principalType: "company",
    accountId: result.identity.accountId,
    email: result.identity.email,
    fullName: result.identity.fullName,
    companyId: result.identity.companyId,
    companySlug: result.identity.companySlug,
    roles: result.identity.roles,
    permissions: result.identity.permissions,
  });
}

function problem(status: number, code: string, title: string, detail: string) {
  return NextResponse.json(
    { type: "about:blank", title, status, detail, code },
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}
