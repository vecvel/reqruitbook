import { NextRequest, NextResponse } from "next/server";

import { gatewayFetch } from "@/lib/gateway";
import { toSession, writeSessionCookies, type AuthResult } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Signs a candidate in without the browser ever holding a refresh token.
 *
 * The call to the gateway carries this portal's own hostname, so the realm and
 * the portal are established by where the request arrives rather than by a
 * field a client could change. The `realm` in the body is what the identity
 * service asks for; the gateway is what decides whether a candidate session is
 * usable on this host at all.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string };
  try {
    body = (await request.json()) as { email?: string; password?: string };
  } catch {
    return problem(400, "bad_request", "Bad Request", "A sign-in needs an email and a password.");
  }

  const response = await gatewayFetch("/api/v1/auth/login", {
    method: "POST",
    body: {
      realm: "candidate",
      email: body.email ?? "",
      password: body.password ?? "",
    },
  });

  if (!response.ok) {
    // The service's own problem+json is passed through verbatim, field errors
    // and all: it knows what went wrong and this handler does not.
    return passthrough(response);
  }

  const result = (await response.json()) as AuthResult;
  await writeSessionCookies(result);
  return NextResponse.json(toSession(result));
}

async function passthrough(response: Response): Promise<Response> {
  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type":
        response.headers.get("Content-Type") ?? "application/problem+json",
    },
  });
}

function problem(status: number, code: string, title: string, detail: string) {
  return new Response(
    JSON.stringify({ type: "about:blank", title, status, detail, code }),
    { status, headers: { "Content-Type": "application/problem+json" } },
  );
}
