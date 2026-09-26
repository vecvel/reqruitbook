import { NextResponse } from "next/server";

import {
  clearSessionCookies,
  exchangeRefreshToken,
  readRefreshToken,
  toSession,
  writeSessionCookies,
} from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The one place the refresh cookie is read and spent.
 *
 * Refresh tokens rotate on every use, so the rotated one must be written back
 * before this returns — which is exactly why a server component cannot do this
 * job: it can read cookies but not set them, so a refresh during a render would
 * leave the browser holding a spent token. Identity reads a spent token as
 * theft and revokes every session the account has, so "it mostly works" here
 * would mean occasionally signing someone out of everything.
 *
 * The response carries the access token and the identity, never the refresh
 * token.
 */
export async function POST() {
  const refreshToken = await readRefreshToken();
  if (!refreshToken) {
    return unauthenticated("You are not signed in.");
  }

  const result = await exchangeRefreshToken(refreshToken);
  if (!result) {
    // Expired, revoked, or already spent. Clearing both cookies stops the app
    // from retrying a token that will never work again.
    await clearSessionCookies();
    return unauthenticated("Your session has expired. Please sign in again.");
  }

  await writeSessionCookies(result);
  return NextResponse.json(toSession(result));
}

function unauthenticated(detail: string) {
  return new Response(
    JSON.stringify({
      type: "about:blank",
      title: "Unauthorized",
      status: 401,
      detail,
      code: "unauthenticated",
    }),
    { status: 401, headers: { "Content-Type": "application/problem+json" } },
  );
}
