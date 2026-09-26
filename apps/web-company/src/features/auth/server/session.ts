import "server-only";

import { cache } from "react";

import { clearSession, readProfile } from "@/lib/gateway/tokens";
import { getGatewaySession } from "@/lib/gateway/session";
import { allLocalPermissions, toLocalPermissions } from "@/lib/gateway/permissions";
import { ALL_FEATURES } from "@/lib/rbac/registry";
import type { AccessSnapshot } from "@/lib/rbac/types";

/**
 * The signed-in recruiter, as the rest of this app already expects to see them.
 *
 * The shape below is unchanged: every screen, guard and navigation filter was
 * written against `AuthUser`, and this migration moves where the data comes
 * from, not what it looks like. What used to be a join across `sessions`,
 * `users`, `roles` and `organizations` in this app's own database is now the
 * claims inside the access token the gateway issued.
 *
 * Two consequences worth stating plainly:
 *
 *  - There is no local session table any more, so `createSession` and
 *    `revokeSessionsForUsers` are gone. Sessions live in the identity service,
 *    which rotates and revokes them; this app only holds cookies.
 *  - `enabledFeatures` is every registered feature. Per-tenant feature switches
 *    were a local table with no platform equivalent, and reporting fewer would
 *    hide screens the platform is perfectly willing to serve.
 */

export interface AuthUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  /** Primary role slug, kept for display and legacy lookups. */
  role: string;
  roleLabel: string;
  /** Every role assigned to the user. */
  roleSlugs: string[];
  roleNames: string[];
  /** Union of the permissions of all assigned roles, filtered by the feature registry. */
  permissions: string[];
  /** The same union in the platform's vocabulary, as identity issued it. */
  platformPermissions: string[];
  isSuperAdmin: boolean;
  enabledFeatures: string[];
  departmentId: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  organizationName: string;
}

/** Every feature key this app registers; the platform has no per-tenant switches. */
const ALL_FEATURE_KEYS = ALL_FEATURES.map((feature) => feature.key);

function humanizeSlug(slug: string): string {
  return slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Current authenticated user for this request.
 *
 * Memoized per request, as before — and now for a second reason: resolving the
 * session can cost a refresh exchange, and identity revokes every session on
 * the account if a rotated refresh token is presented twice.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const session = await getGatewaySession();
  if (!session) return null;

  const { identity } = session;
  const profile = await readProfile();

  const roleSlugs = identity.roles.length > 0 ? identity.roles : ["member"];
  const roleNames =
    profile.roleNames.length > 0 ? profile.roleNames : roleSlugs.map(humanizeSlug);

  // An owner resolves to the full company scope at the identity service, but
  // this app registers screens the platform has no key for. Handing over the
  // whole local catalogue keeps the snapshot honest about what will render;
  // the evaluator would reach the same answer through isSuperAdmin anyway.
  const permissions = identity.isSuperAdmin
    ? allLocalPermissions()
    : toLocalPermissions(identity.permissions);

  return {
    id: identity.accountId,
    orgId: identity.companyId ?? "",
    name: identity.fullName,
    email: identity.email,
    role: roleSlugs[0] ?? "member",
    roleLabel: roleNames[0] ?? humanizeSlug(roleSlugs[0] ?? "member"),
    roleSlugs,
    roleNames,
    permissions,
    platformPermissions: identity.permissions,
    isSuperAdmin: identity.isSuperAdmin,
    enabledFeatures: ALL_FEATURE_KEYS,
    // Neither is a platform concept. Kept on the type because the shell reads
    // them; a null avatar renders initials, which is what it already did.
    departmentId: null,
    avatarUrl: null,
    isActive: true,
    organizationName: profile.companyName || identity.companySlug || "",
  };
});

export function toAccessSnapshot(user: AuthUser | null): AccessSnapshot {
  if (!user) {
    return {
      userId: null,
      roleSlugs: [],
      roleNames: [],
      permissions: [],
      platformPermissions: [],
      isSuperAdmin: false,
      enabledFeatures: [],
    };
  }
  return {
    userId: user.id,
    roleSlugs: user.roleSlugs,
    roleNames: user.roleNames,
    permissions: user.permissions,
    platformPermissions: user.platformPermissions,
    isSuperAdmin: user.isSuperAdmin,
    enabledFeatures: user.enabledFeatures,
  };
}

/** Drops this browser's cookies. Revoking the session itself is identity's job. */
export async function destroySession(): Promise<void> {
  await clearSession();
}
