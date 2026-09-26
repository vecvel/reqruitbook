import "server-only";

import { cache } from "react";

import { getCurrentUser, toAccessSnapshot, type AuthUser } from "@/features/auth/server/session";
import { recordAuditLog } from "@/lib/security/audit";
import { AccessEvaluator, EMPTY_ACCESS } from "./access";
import { parsePermissionKey } from "./define";
import { ForbiddenError, FeatureDisabledError, UnauthorizedError } from "./errors";
import { getFeature } from "./registry";
import { routePermissions } from "./routes";
import type { PermissionKey } from "./types";

export interface Actor {
  user: AuthUser;
  access: AccessEvaluator;
}

/**
 * Server-side authorization entry point.
 *
 * Every server action, route handler, and protected page resolves its actor here.
 * The evaluator is the same class the browser uses, so the button that renders and
 * the action that runs agree by construction — the server is simply the copy that
 * decides.
 */
export const getActor = cache(async (): Promise<Actor | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return { user, access: new AccessEvaluator(toAccessSnapshot(user)) };
});

/** Evaluator for the current request; an anonymous evaluator when signed out. */
export async function getAccess(): Promise<AccessEvaluator> {
  const actor = await getActor();
  return actor?.access ?? new AccessEvaluator(EMPTY_ACCESS);
}

export async function requireAuth(): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthorizedError();
  return actor;
}

export async function can(permission: PermissionKey): Promise<boolean> {
  const actor = await getActor();
  return actor?.access.can(permission) ?? false;
}

/** Requires every listed permission. */
export async function requirePermission(
  ...permissions: PermissionKey[]
): Promise<Actor> {
  return enforce(permissions, "all");
}

/** Requires at least one of the listed permissions. */
export async function requireAnyPermission(
  permissions: PermissionKey[],
): Promise<Actor> {
  return enforce(permissions, "any");
}

export type RouteDecision =
  | { allowed: true; actor: Actor }
  | { allowed: false; reason: "unauthenticated" }
  | { allowed: false; reason: "feature-disabled"; featureKey: string; featureName: string }
  | { allowed: false; reason: "forbidden"; required: PermissionKey[]; mode: "any" | "all" };

/**
 * Evaluates a pathname against the route rules the features declare.
 *
 * Returns a decision rather than throwing so a page can render a proper
 * "access denied" screen; `requireRouteAccess` is the throwing variant for code
 * paths that must simply stop.
 */
export async function checkRouteAccess(pathname: string): Promise<RouteDecision> {
  const actor = await getActor();
  if (!actor) return { allowed: false, reason: "unauthenticated" };

  const rule = routePermissions(pathname);
  if (!rule) return { allowed: true, actor };

  if (rule.featureKey && !actor.access.isFeatureEnabled(rule.featureKey)) {
    const feature = getFeature(rule.featureKey);
    return {
      allowed: false,
      reason: "feature-disabled",
      featureKey: rule.featureKey,
      featureName: feature?.name ?? rule.featureKey,
    };
  }

  if (actor.access.check(rule.requires, rule.mode)) return { allowed: true, actor };

  await recordAuditLog({
    actorId: actor.user.id,
    orgId: actor.user.orgId,
    action: "access.denied",
    entityType: "route",
    entityId: pathname,
    metadata: { required: rule.requires, mode: rule.mode, roles: actor.user.roleSlugs },
  });

  return { allowed: false, reason: "forbidden", required: rule.requires, mode: rule.mode };
}

/** Guards a page by its pathname using the route rules declared by features. */
export async function requireRouteAccess(pathname: string): Promise<Actor> {
  const decision = await checkRouteAccess(pathname);
  if (decision.allowed) return decision.actor;

  if (decision.reason === "unauthenticated") throw new UnauthorizedError();
  if (decision.reason === "feature-disabled") {
    throw new FeatureDisabledError(decision.featureKey, decision.featureName);
  }
  throw new ForbiddenError(decision.required, decision.mode);
}

async function enforce(
  permissions: PermissionKey[],
  mode: "any" | "all",
  route?: string,
): Promise<Actor> {
  const actor = await getActor();
  if (!actor) throw new UnauthorizedError();

  // A disabled module reports itself distinctly so the UI can explain *why*.
  for (const permission of permissions) {
    const parsed = parsePermissionKey(permission);
    if (!parsed) continue;
    if (!actor.access.isFeatureEnabled(parsed.featureKey)) {
      if (mode === "all" || permissions.length === 1) {
        const feature = getFeature(parsed.featureKey);
        throw new FeatureDisabledError(parsed.featureKey, feature?.name);
      }
    }
  }

  if (actor.access.check(permissions, mode)) return actor;

  await recordAuditLog({
    actorId: actor.user.id,
    orgId: actor.user.orgId,
    action: "access.denied",
    entityType: route ? "route" : "permission",
    entityId: route ?? permissions.join("|"),
    metadata: { required: permissions, mode, roles: actor.user.roleSlugs },
  });

  throw new ForbiddenError(permissions, mode);
}

export { ForbiddenError, UnauthorizedError, FeatureDisabledError } from "./errors";
