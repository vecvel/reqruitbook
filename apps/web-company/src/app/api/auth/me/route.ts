import { NextResponse } from "next/server";

import { getCurrentUser, toAccessSnapshot } from "@/features/auth/server/session";

/**
 * Current session and its resolved access.
 *
 * Returns the same snapshot the UI is hydrated with, so an external client
 * evaluates permissions exactly as the application does. The permissions here
 * are this app's own keys, translated from the platform keys in the token —
 * see src/lib/gateway/permissions.ts for why the two vocabularies differ.
 */
export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "You are not signed in.",
        code: "unauthenticated",
        authenticated: false,
        user: null,
      },
      { status: 401, headers: { "Content-Type": "application/problem+json" } },
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel,
      roleSlugs: user.roleSlugs,
      roleNames: user.roleNames,
      departmentId: user.departmentId,
      avatarUrl: user.avatarUrl,
      organizationName: user.organizationName,
    },
    access: toAccessSnapshot(user),
  });
}
