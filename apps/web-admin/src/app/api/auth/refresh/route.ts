import { NextResponse } from "next/server";

import { refreshSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The only thing in this app that reads the refresh cookie and exchanges it.
 *
 * This is what the ApiClient's `refresh` option calls when the gateway answers
 * 401. The browser sends no body and receives no refresh token — it gets a new
 * access token to hold in memory, and the rotated refresh token goes straight
 * back into the httpOnly cookie where script cannot reach it.
 */
export async function POST(): Promise<Response> {
  const session = await refreshSession();

  if (!session) {
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

  return NextResponse.json(session);
}
