import "server-only";

import { NextResponse } from "next/server";

import { getActor, type Actor } from "./guard";
import { isAuthorizationError } from "./errors";
import type { PermissionKey } from "./types";

/**
 * Permission enforcement for route handlers.
 *
 * Server actions use `requirePermission`; REST endpoints use this, so an API
 * client gets the same decision as the UI — with a proper status code instead of
 * a thrown error.
 */
export async function requireApiPermission(
  permissions: PermissionKey[],
  mode: "any" | "all" = "any",
): Promise<{ actor: Actor } | { response: NextResponse }> {
  const actor = await getActor();

  if (!actor) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized", message: "Authentication required." },
        { status: 401 },
      ),
    };
  }

  if (permissions.length > 0 && !actor.access.check(permissions, mode)) {
    return {
      response: NextResponse.json(
        {
          error: "Forbidden",
          message: `This endpoint requires ${mode === "all" ? "all of" : "one of"}: ${permissions.join(", ")}.`,
          required: permissions,
        },
        { status: 403 },
      ),
    };
  }

  return { actor };
}

/** Wraps a handler so it only runs for callers holding the given permissions. */
export function withPermission(
  permissions: PermissionKey[],
  handler: (req: Request, actor: Actor) => Promise<NextResponse>,
  mode: "any" | "all" = "any",
) {
  return async (req: Request): Promise<NextResponse> => {
    const result = await requireApiPermission(permissions, mode);
    if ("response" in result) return result.response;

    try {
      return await handler(req, result.actor);
    } catch (error) {
      if (isAuthorizationError(error)) {
        return NextResponse.json(
          { error: error.code, message: error.message },
          { status: error.status },
        );
      }
      throw error;
    }
  };
}
