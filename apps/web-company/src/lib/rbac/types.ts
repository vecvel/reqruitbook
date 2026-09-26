/**
 * Core RBAC type contracts.
 *
 * The whole authorization system is derived from these shapes: features declare
 * the actions they support, the registry flattens them into permission keys, and
 * every guard (UI, route, server action, API) resolves against those same keys.
 * Nothing here knows about a specific feature — adding one never touches this file.
 */

/** Canonical permission string, always `<featureKey>.<action>` (e.g. `jobs.create`). */
export type PermissionKey = string;

/** Every feature belongs to a group purely for presentation/grouping in the admin UI. */
export type FeatureGroupKey = "recruitment" | "administration" | "configuration";

export interface FeatureGroup {
  key: FeatureGroupKey;
  name: string;
  description: string;
  order: number;
}

/** A single capability a feature exposes. CRUD actions are generated, custom ones are declared. */
export interface FeatureActionDef {
  /** Action segment of the permission key, snake_case (e.g. `create`, `sync_hrm`). */
  action: string;
  label: string;
  description: string;
  /** `crud` for the four baseline operations, `custom` for feature-specific capabilities. */
  kind: "crud" | "custom";
  /**
   * Actions flagged as sensitive are visually highlighted in the permission matrix
   * (compensation visibility, approvals, HRM sync, privilege delegation, ...).
   */
  sensitive?: boolean;
}

/** Fully-resolved permission produced by the registry from a feature + one of its actions. */
export interface PermissionDef extends FeatureActionDef {
  key: PermissionKey;
  featureKey: string;
  featureName: string;
  group: FeatureGroupKey;
}

export interface NavChildDef {
  label: string;
  href: string;
  /** Permission keys; the child renders when the user satisfies `mode`. */
  requires?: PermissionKey[];
  mode?: "any" | "all";
  badgeKey?: string;
}

export interface NavDef {
  label: string;
  href: string;
  icon: string;
  badgeKey?: string;
  /** Defaults to `<feature>.read` when omitted. */
  requires?: PermissionKey[];
  mode?: "any" | "all";
  children?: NavChildDef[];
}

/**
 * A tab a feature contributes to the Settings screen. Declaring one makes the tab
 * appear in the Settings page and as a child of the Settings sidebar entry, gated
 * by the feature's own permissions.
 */
export interface SettingsTabDef {
  /** `?tab=` value, e.g. `departments`. */
  tab: string;
  label: string;
  /** Sidebar label when it should differ from the tab label. */
  navLabel?: string;
  icon?: string;
  order: number;
  /** Defaults to `<feature>.read`. */
  requires?: PermissionKey[];
  mode?: "any" | "all";
}

/** A protected pathname and the permissions required to open it. */
export interface RouteRuleDef {
  /** Exact pathname, or a prefix when `exact` is false (the default). */
  path: string;
  exact?: boolean;
  requires: PermissionKey[];
  mode?: "any" | "all";
}

/** What a feature module exports from its `feature.ts`. */
export interface FeatureDef {
  key: string;
  name: string;
  description: string;
  icon: string;
  group: FeatureGroupKey;
  order: number;
  actions: FeatureActionDef[];
  nav?: NavDef[];
  routes?: RouteRuleDef[];
  settings?: SettingsTabDef;
  /**
   * Core features (access control, organization) can never be switched off, otherwise
   * a Super Admin could lock themselves out of the very screen that re-enables things.
   */
  alwaysEnabled?: boolean;
  /** Feature is enabled for a fresh organization unless explicitly disabled. */
  defaultEnabled?: boolean;
}

/** Input accepted by `defineFeature` — CRUD is opt-in sugar over `actions`. */
export interface FeatureInput extends Omit<FeatureDef, "actions" | "order" | "defaultEnabled"> {
  order?: number;
  defaultEnabled?: boolean;
  /**
   * `true` generates create/read/update/delete, or pass a subset.
   * Labels are generated from the feature name and can be overridden via `actions`.
   */
  crud?: boolean | CrudAction[];
  /** Custom capabilities beyond CRUD, plus overrides for generated CRUD entries. */
  actions?: Array<Partial<FeatureActionDef> & { action: string }>;
}

export type CrudAction = "create" | "read" | "update" | "delete";

/** The resolved authorization state of the requester, shared by server and client. */
export interface AccessSnapshot {
  userId: string | null;
  roleSlugs: string[];
  roleNames: string[];
  permissions: PermissionKey[];
  /**
   * The platform's own permission keys, as the identity service issued them.
   *
   * Kept beside the translated local keys rather than instead of them: the local
   * keys decide what this app renders, while these decide what a role editor may
   * delegate — and those are different vocabularies. Mapping one onto the other
   * to answer a delegation question would let a local key with no platform
   * equivalent grant something the service never issued.
   */
  platformPermissions: string[];
  isSuperAdmin: boolean;
  /** Feature keys enabled for the organization. */
  enabledFeatures: string[];
}
