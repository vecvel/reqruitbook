"use client";

import React from "react";

import type { PermissionKey } from "@/lib/rbac/types";
import { useAccess } from "./access-provider";

interface CanProps {
  /** Single permission the user must hold. */
  permission?: PermissionKey;
  /** Renders when the user holds at least one of these. */
  anyOf?: PermissionKey[];
  /** Renders when the user holds all of these. */
  allOf?: PermissionKey[];
  /** Renders when the user holds any permission of the feature and it is enabled. */
  feature?: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Permission-aware rendering for buttons, table actions, tabs, modals, and fields.
 *
 * This is a UX affordance, never the security boundary: the matching server guard
 * rejects the same operation when it is called directly.
 */
export function Can({
  permission,
  anyOf,
  allOf,
  feature,
  children,
  fallback = null,
}: CanProps) {
  const access = useAccess();

  const checks: boolean[] = [];
  if (permission) checks.push(access.can(permission));
  if (anyOf?.length) checks.push(access.canAny(anyOf));
  if (allOf?.length) checks.push(access.canAll(allOf));
  if (feature) checks.push(access.canAccessFeature(feature));

  const allowed = checks.length === 0 ? true : checks.every(Boolean);
  return <>{allowed ? children : fallback}</>;
}
