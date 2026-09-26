"use client";

import React from "react";
import { usePathname } from "next/navigation";

import { routePermissions } from "@/lib/rbac/routes";
import { AccessDenied } from "./access-denied";
import { useAccess } from "./access-provider";

/**
 * Client-side mirror of the server route guard.
 *
 * Pages are already gated server-side before they render; this keeps client
 * navigations from flashing a screen the user cannot open.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const access = useAccess();

  const rule = routePermissions(pathname);
  if (!rule) return <>{children}</>;

  if (rule.featureKey && !access.isFeatureEnabled(rule.featureKey)) {
    return (
      <AccessDenied
        errorCode="403"
        title="Module Disabled"
        description="This module has been switched off for your organization. Contact your Super Admin to re-enable it."
      />
    );
  }

  if (!access.access.check(rule.requires, rule.mode)) {
    return (
      <AccessDenied
        errorCode="403"
        title="Access Denied"
        description="You do not have permission to view or access this section."
      />
    );
  }

  return <>{children}</>;
}
