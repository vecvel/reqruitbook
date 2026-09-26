"use client";

import React, { createContext, useContext, useMemo } from "react";

import { AccessEvaluator, EMPTY_ACCESS } from "@/lib/rbac/access";
import type { AccessSnapshot, PermissionKey } from "@/lib/rbac/types";

export interface AccessUser {
  id: string;
  orgId: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  roleSlugs: string[];
  roleNames: string[];
  departmentId: string | null;
  avatarUrl: string | null;
  organizationName: string;
}

interface AccessContextValue {
  user: AccessUser | null;
  access: AccessEvaluator;
  can: (permission: PermissionKey) => boolean;
  canAny: (permissions: PermissionKey[]) => boolean;
  canAll: (permissions: PermissionKey[]) => boolean;
  canAccessFeature: (featureKey: string) => boolean;
  isFeatureEnabled: (featureKey: string) => boolean;
  isSuperAdmin: boolean;
}

const AccessContext = createContext<AccessContextValue>({
  user: null,
  access: new AccessEvaluator(EMPTY_ACCESS),
  can: () => false,
  canAny: () => false,
  canAll: () => false,
  canAccessFeature: () => false,
  isFeatureEnabled: () => false,
  isSuperAdmin: false,
});

/**
 * Publishes the server-resolved permission snapshot to the client tree.
 *
 * The browser never computes permissions of its own — it replays the same
 * evaluator the server used, so UI visibility and server enforcement stay in step.
 */
export function AccessProvider({
  user,
  snapshot,
  children,
}: {
  user: AccessUser | null;
  snapshot: AccessSnapshot;
  children: React.ReactNode;
}) {
  /**
   * The server sends a fresh snapshot object on every navigation even when the
   * permissions are unchanged. Keying the evaluator on the snapshot's contents
   * keeps its identity stable, so memos and effects downstream (navigation,
   * settings tabs) do not re-run on every route change.
   */
  const snapshotKey = JSON.stringify(snapshot);

  const access = useMemo(
    () => new AccessEvaluator(JSON.parse(snapshotKey) as AccessSnapshot),
    [snapshotKey],
  );

  const value = useMemo<AccessContextValue>(
    () => ({
      user,
      access,
      can: (permission) => access.can(permission),
      canAny: (permissions) => access.canAny(permissions),
      canAll: (permissions) => access.canAll(permissions),
      canAccessFeature: (featureKey) => access.canAccessFeature(featureKey),
      isFeatureEnabled: (featureKey) => access.isFeatureEnabled(featureKey),
      isSuperAdmin: access.isSuperAdmin,
    }),
    [user, access],
  );

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  return useContext(AccessContext);
}

/** Convenience hook for a single permission check. */
export function usePermission(permission: PermissionKey): boolean {
  return useAccess().can(permission);
}
