"use server";

import { ALL_FEATURES } from "@/lib/rbac/registry";
import { unavailable } from "@/lib/gateway/unavailable";
import { requirePermission } from "@/lib/rbac/guard";

export interface FeatureAccessRow {
  key: string;
  name: string;
  description: string;
  icon: string;
  group: string;
  isEnabled: boolean;
  alwaysEnabled: boolean;
  permissionCount: number;
}

/**
 * The feature catalogue and its on/off state.
 *
 * The catalogue is still real — it comes from the registry, so a newly
 * registered feature appears here immediately. What is gone is the per-tenant
 * override table: the platform gates on subscription entitlements instead, and
 * the billing screen is where a customer sees what their plan includes.
 *
 * Every feature therefore reports as enabled, which matches what the gateway
 * will actually allow. Tracked as "feature-access" in
 * lib/gateway/unavailable.ts.
 */
export async function getFeatureAccess(): Promise<FeatureAccessRow[]> {
  await requirePermission("roles.read");

  return ALL_FEATURES.map((feature) => ({
    key: feature.key,
    name: feature.name,
    description: feature.description,
    icon: feature.icon ?? "",
    group: feature.group,
    isEnabled: true,
    alwaysEnabled: true,
    permissionCount: feature.actions.length,
  }));
}

export async function setFeatureEnabled(_featureKey: string, _isEnabled: boolean) {
  await requirePermission("roles.assign_permissions");
  const feature = unavailable("feature-access");
  return { success: false as const, unavailable: feature, error: feature.blockedOn };
}
