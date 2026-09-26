import "server-only";

import { cache } from "react";

import {
  exchangeRefreshToken,
  isExpired,
  readAccessToken,
  readRefreshToken,
  storeSession,
  type GatewayAuthResult,
  type GatewayIdentity,
} from "./tokens";

/**
 * The signed-in principal, resolved once per request.
 *
 * `cache` is what keeps a page, its layout and every server action it triggers
 * on one answer without re-deriving it — and, more importantly, without
 * spending the refresh token more than once.
 */

export interface GatewaySession {
  accessToken: string;
  identity: GatewayIdentity;
}

/** Reads the access token's own claims rather than trusting a parallel cookie. */
function decodeClaims(token: string): Record<string, unknown> | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/**
 * Rebuilds the identity from the access token.
 *
 * The token already carries the resolved role and permission list — that is the
 * whole point of a 15-minute RS256 access token — so reading it costs nothing
 * and avoids a call to /auth/me on every render. It is only ever used to decide
 * what to *render*; the gateway re-verifies the same token on every API call.
 */
function identityFromToken(token: string): GatewayIdentity | null {
  const claims = decodeClaims(token);
  if (!claims || typeof claims.sub !== "string") return null;

  const expiry = typeof claims.exp === "number" ? claims.exp * 1000 : 0;
  if (expiry <= Date.now()) return null;

  const roles = asStringArray(claims.roles);
  return {
    accountId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    fullName: typeof claims.name === "string" ? claims.name : "",
    realm: typeof claims.typ === "string" ? claims.typ : "company",
    companyId: typeof claims.cid === "string" ? claims.cid : undefined,
    companySlug: typeof claims.slug === "string" ? claims.slug : undefined,
    companyName: typeof claims.cname === "string" ? claims.cname : undefined,
    roles,
    roleNames: asStringArray(claims.roleNames),
    permissions: asStringArray(claims.perms),
    isSuperAdmin: roles.includes("owner") || roles.includes("super_admin"),
  };
}

async function persistQuietly(result: GatewayAuthResult): Promise<void> {
  try {
    await storeSession(result);
  } catch {
    // Next refuses cookie writes during a server-component render. The refreshed
    // token is still used for this request; middleware persists it on the next
    // navigation, so the only cost is one extra exchange.
  }
}

export const getGatewaySession = cache(async (): Promise<GatewaySession | null> => {
  const accessToken = await readAccessToken();
  if (accessToken) {
    const identity = identityFromToken(accessToken);
    if (identity) return { accessToken, identity };
  }

  const refreshToken = await readRefreshToken();
  if (!refreshToken) return null;

  const refreshed = await exchangeRefreshToken(refreshToken);
  if (!refreshed) return null;

  await persistQuietly(refreshed);
  return { accessToken: refreshed.tokens.accessToken, identity: refreshed.identity };
});

/** The access token to put on an outbound call, refreshed if it has aged out. */
export async function currentAccessToken(): Promise<string | null> {
  const session = await getGatewaySession();
  return session?.accessToken ?? null;
}

export { isExpired };
