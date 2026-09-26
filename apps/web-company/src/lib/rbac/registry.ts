import { FEATURES } from "@/features/registry";
import { parsePermissionKey, permissionKey } from "./define";
import type {
  FeatureDef,
  FeatureGroup,
  FeatureGroupKey,
  PermissionDef,
  PermissionKey,
} from "./types";

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    key: "recruitment",
    name: "Recruitment Operations",
    description: "Day-to-day hiring modules: requisitions, pipeline, interviews, offers",
    order: 1,
  },
  {
    key: "administration",
    name: "Access & Administration",
    description: "User directory, roles, permission delegation, feature access, audit trail",
    order: 2,
  },
  {
    key: "configuration",
    name: "Organization Configuration",
    description: "Company profile, delivery settings, and the master data every module reads from",
    order: 3,
  },
];

/** All registered features, ordered by group then declared order. */
export const ALL_FEATURES: FeatureDef[] = [...FEATURES].sort((a, b) => {
  const ga = FEATURE_GROUPS.findIndex((g) => g.key === a.group);
  const gb = FEATURE_GROUPS.findIndex((g) => g.key === b.group);
  if (ga !== gb) return ga - gb;
  if (a.order !== b.order) return a.order - b.order;
  return a.name.localeCompare(b.name);
});

const FEATURE_INDEX = new Map(ALL_FEATURES.map((f) => [f.key, f]));

/** Every permission the application knows about, flattened from the feature registry. */
export const ALL_PERMISSIONS: PermissionDef[] = ALL_FEATURES.flatMap((feature) =>
  feature.actions.map((action) => ({
    ...action,
    key: permissionKey(feature.key, action.action),
    featureKey: feature.key,
    featureName: feature.name,
    group: feature.group,
  })),
);

const PERMISSION_INDEX = new Map(ALL_PERMISSIONS.map((p) => [p.key, p]));

export const ALL_PERMISSION_KEYS: PermissionKey[] = ALL_PERMISSIONS.map((p) => p.key);

/** Feature keys that can never be disabled for an organization. */
export const ALWAYS_ENABLED_FEATURES: string[] = ALL_FEATURES.filter((f) => f.alwaysEnabled).map(
  (f) => f.key,
);

export const DEFAULT_ENABLED_FEATURES: string[] = ALL_FEATURES.filter(
  (f) => f.alwaysEnabled || f.defaultEnabled,
).map((f) => f.key);

export function getFeature(key: string): FeatureDef | undefined {
  return FEATURE_INDEX.get(key);
}

export function getPermission(key: PermissionKey): PermissionDef | undefined {
  return PERMISSION_INDEX.get(key);
}

export function isKnownPermission(key: PermissionKey): boolean {
  return PERMISSION_INDEX.has(key);
}

export function getFeaturesByGroup(group: FeatureGroupKey): FeatureDef[] {
  return ALL_FEATURES.filter((f) => f.group === group);
}

export function getFeaturePermissions(featureKey: string): PermissionDef[] {
  return ALL_PERMISSIONS.filter((p) => p.featureKey === featureKey);
}

/** Drops permission keys whose feature or action no longer exists in the registry. */
export function sanitizePermissions(keys: unknown): PermissionKey[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<PermissionKey>();
  for (const key of keys) {
    if (typeof key === "string" && PERMISSION_INDEX.has(key)) seen.add(key);
  }
  return [...seen].sort();
}

/** Resolves the feature that owns a permission key. */
export function featureOfPermission(key: PermissionKey): FeatureDef | undefined {
  const parsed = parsePermissionKey(key);
  return parsed ? FEATURE_INDEX.get(parsed.featureKey) : undefined;
}

// Fail fast on duplicate registrations rather than silently shadowing a feature.
if (FEATURE_INDEX.size !== ALL_FEATURES.length) {
  const counts = new Map<string, number>();
  for (const f of ALL_FEATURES) counts.set(f.key, (counts.get(f.key) ?? 0) + 1);
  const dupes = [...counts.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  throw new Error(`Duplicate feature keys registered: ${dupes.join(", ")}`);
}
