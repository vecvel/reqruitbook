import { parsePermissionKey } from "./define";
import { ALWAYS_ENABLED_FEATURES, getFeature } from "./registry";
import type { AccessSnapshot, PermissionKey } from "./types";

/**
 * Isomorphic permission evaluation.
 *
 * Both the browser (`useAccess`) and the server (`guard.ts`) route every decision
 * through this class, so a button and the server action behind it can never disagree.
 */
export class AccessEvaluator {
  readonly userId: string | null;
  readonly roleSlugs: string[];
  readonly roleNames: string[];
  readonly isSuperAdmin: boolean;
  private readonly granted: Set<PermissionKey>;
  private readonly platformGranted: Set<string>;
  private readonly enabled: Set<string>;

  constructor(snapshot: AccessSnapshot | null) {
    this.userId = snapshot?.userId ?? null;
    this.roleSlugs = snapshot?.roleSlugs ?? [];
    this.roleNames = snapshot?.roleNames ?? [];
    this.isSuperAdmin = snapshot?.isSuperAdmin ?? false;
    this.granted = new Set(snapshot?.permissions ?? []);
    this.platformGranted = new Set(snapshot?.platformPermissions ?? []);
    this.enabled = new Set([...(snapshot?.enabledFeatures ?? []), ...ALWAYS_ENABLED_FEATURES]);
  }

  get isAuthenticated(): boolean {
    return this.userId !== null;
  }

  /** Feature switched on for the organization. Super Admin keeps access to disabled modules. */
  isFeatureEnabled(featureKey: string): boolean {
    if (this.enabled.has(featureKey)) return true;
    return this.isSuperAdmin;
  }

  can(permission: PermissionKey): boolean {
    if (!this.isAuthenticated) return false;
    const parsed = parsePermissionKey(permission);
    if (!parsed) return false;
    if (!this.isFeatureEnabled(parsed.featureKey)) return false;
    if (this.isSuperAdmin) return true;
    return this.granted.has(permission);
  }

  canAny(permissions: PermissionKey[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated;
    return permissions.some((p) => this.can(p));
  }

  canAll(permissions: PermissionKey[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated;
    return permissions.every((p) => this.can(p));
  }

  check(permissions: PermissionKey[], mode: "any" | "all" = "any"): boolean {
    return mode === "all" ? this.canAll(permissions) : this.canAny(permissions);
  }

  /** True when the actor holds at least one permission belonging to the feature. */
  canAccessFeature(featureKey: string): boolean {
    const feature = getFeature(featureKey);
    if (!feature) return false;
    if (!this.isFeatureEnabled(featureKey)) return false;
    if (this.isSuperAdmin) return true;
    return feature.actions.some((a) => this.granted.has(`${featureKey}.${a.action}`));
  }

  /** Permission keys actually held — used when delegating a subset to another role. */
  grantedKeys(): PermissionKey[] {
    return [...this.granted];
  }

  /**
   * The platform keys held, which is what a role may be given.
   *
   * The role editor delegates in the platform's vocabulary because that is what
   * identity stores and re-checks; `grantedKeys` answers the different question
   * of what this app should render.
   */
  platformKeys(): string[] {
    return [...this.platformGranted];
  }

  toSnapshot(): AccessSnapshot {
    return {
      userId: this.userId,
      roleSlugs: this.roleSlugs,
      roleNames: this.roleNames,
      permissions: [...this.granted],
      platformPermissions: [...this.platformGranted],
      isSuperAdmin: this.isSuperAdmin,
      enabledFeatures: [...this.enabled],
    };
  }
}

export const EMPTY_ACCESS: AccessSnapshot = {
  userId: null,
  roleSlugs: [],
  roleNames: [],
  permissions: [],
  platformPermissions: [],
  isSuperAdmin: false,
  enabledFeatures: [],
};
