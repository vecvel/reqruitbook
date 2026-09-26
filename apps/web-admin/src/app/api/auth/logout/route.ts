import { NextResponse } from "next/server";

import { gatewayFetch } from "@/lib/gateway";
import { clearSession, readRefreshToken } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Signs out here and upstream.
 *
 * The cookies are cleared whatever the gateway says. A logout that fails
 * upstream but leaves the operator looking signed in on a shared machine is the
 * worse of the two failures, and the refresh token is revoked server-side on
 * its next use attempt anyway.
 */
export async function POST(): Promise<Response> {
  const refreshToken = await readRefreshToken();

  if (refreshToken) {
    try {
      await gatewayFetch({
        method: "POST",
        path: "/api/v1/auth/logout",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Deliberately ignored — see above.
    }
  }

  await clearSession();
  return new NextResponse(null, { status: 204 });
}
