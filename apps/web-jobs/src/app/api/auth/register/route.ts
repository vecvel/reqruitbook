import { NextRequest, NextResponse } from "next/server";

import { gatewayFetch } from "@/lib/gateway";
import { toSession, writeSessionCookies, type AuthResult } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Registers a candidate and signs them straight in.
 *
 * The identity service answers a registration with the same token pair a login
 * produces, so there is no second round trip and no window in which a new
 * account exists but cannot be used.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string; password?: string; fullName?: string };
  try {
    body = (await request.json()) as {
      email?: string;
      password?: string;
      fullName?: string;
    };
  } catch {
    return new Response(
      JSON.stringify({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
        detail: "Registration needs a name, an email and a password.",
        code: "bad_request",
      }),
      { status: 400, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  const response = await gatewayFetch("/api/v1/auth/candidate/register", {
    method: "POST",
    body: {
      email: body.email ?? "",
      password: body.password ?? "",
      fullName: body.fullName ?? "",
    },
  });

  if (!response.ok) {
    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "Content-Type":
          response.headers.get("Content-Type") ?? "application/problem+json",
      },
    });
  }

  const result = (await response.json()) as AuthResult;
  await writeSessionCookies(result);
  return NextResponse.json(toSession(result), { status: 201 });
}
