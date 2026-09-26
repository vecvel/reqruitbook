import { gatewayFetch } from "@/lib/gateway";
import { clearSessionCookies, readRefreshToken } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Ends the session on both sides.
 *
 * The cookies are cleared whatever the identity service says. A sign-out that
 * left the browser holding a cookie because a network call failed would look
 * to the user like it had not worked, and they would be right.
 */
export async function POST() {
  const refreshToken = await readRefreshToken();

  if (refreshToken) {
    try {
      await gatewayFetch("/api/v1/auth/logout", {
        method: "POST",
        body: { refreshToken },
      });
    } catch {
      // Best effort: the token expires on its own, and the cookie is going
      // regardless.
    }
  }

  await clearSessionCookies();
  return new Response(null, { status: 204 });
}
