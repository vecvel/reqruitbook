/**
 * Permission evaluation, shared by every portal and by their server components.
 *
 * Ported from the company portal's evaluator, with the company-specific feature
 * registry removed: the platform and candidate portals have no per-tenant
 * feature switches, and a shared evaluator that insisted on them would make
 * every call site invent one.
 *
 * What this decides is what to *render*. It is never the security boundary —
 * the gateway checks the token and each service re-checks the permission and
 * the tenant. Hiding a button the user cannot use is a courtesy; the answer
 * that counts comes from the API.
 */

export type PermissionKey = string;

export interface AccessSnapshot {
  accountId: string | null;
  principalType: 'platform' | 'company' | 'candidate' | null;
  roles: string[];
  permissions: PermissionKey[];
  companyId?: string | null;
  /** Feature keys the tenant has switched on. Empty means "no restriction". */
  enabledFeatures?: string[];
  isSuperAdmin?: boolean;
}

export const EMPTY_ACCESS: AccessSnapshot = {
  accountId: null,
  principalType: null,
  roles: [],
  permissions: [],
};

export class AccessEvaluator {
  readonly accountId: string | null;
  readonly principalType: AccessSnapshot['principalType'];
  readonly roles: string[];
  readonly companyId: string | null;
  readonly isSuperAdmin: boolean;

  private readonly granted: Set<PermissionKey>;
  private readonly enabled: Set<string> | null;

  constructor(snapshot: AccessSnapshot | null) {
    this.accountId = snapshot?.accountId ?? null;
    this.principalType = snapshot?.principalType ?? null;
    this.roles = snapshot?.roles ?? [];
    this.companyId = snapshot?.companyId ?? null;
    this.isSuperAdmin = snapshot?.isSuperAdmin ?? false;
    this.granted = new Set(snapshot?.permissions ?? []);

    // null, not an empty set: "this tenant restricted nothing" and "this tenant
    // enabled nothing" are opposite answers, and an empty set would read as the
    // second while meaning the first.
    this.enabled =
      snapshot?.enabledFeatures && snapshot.enabledFeatures.length > 0
        ? new Set(snapshot.enabledFeatures)
        : null;
  }

  get isAuthenticated(): boolean {
    return this.accountId !== null;
  }

  /** A module the tenant switched off. A super admin still reaches it. */
  isFeatureEnabled(featureKey: string): boolean {
    if (this.enabled === null) return true;
    if (this.enabled.has(featureKey)) return true;
    return this.isSuperAdmin;
  }

  can(permission: PermissionKey): boolean {
    if (!this.isAuthenticated) return false;

    const featureKey = permission.split('.')[0];
    if (!featureKey || !this.isFeatureEnabled(featureKey)) return false;

    if (this.isSuperAdmin) return true;
    return this.granted.has(permission);
  }

  canAny(permissions: PermissionKey[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated;
    return permissions.some((permission) => this.can(permission));
  }

  canAll(permissions: PermissionKey[]): boolean {
    if (permissions.length === 0) return this.isAuthenticated;
    return permissions.every((permission) => this.can(permission));
  }

  check(permissions: PermissionKey[], mode: 'any' | 'all' = 'any'): boolean {
    return mode === 'all' ? this.canAll(permissions) : this.canAny(permissions);
  }

  /** True when the actor holds any permission belonging to the feature. */
  canAccessFeature(featureKey: string): boolean {
    if (!this.isAuthenticated) return false;
    if (!this.isFeatureEnabled(featureKey)) return false;
    if (this.isSuperAdmin) return true;

    const prefix = `${featureKey}.`;
    for (const permission of this.granted) {
      if (permission.startsWith(prefix)) return true;
    }
    return false;
  }

  /** The keys actually held, for delegating a subset to another role. */
  grantedKeys(): PermissionKey[] {
    return [...this.granted].sort();
  }

  is(type: NonNullable<AccessSnapshot['principalType']>): boolean {
    return this.principalType === type;
  }
}

/** Builds the snapshot a portal renders against from its session. */
export function snapshotFromSession(session: {
  accountId: string;
  principalType: 'platform' | 'company' | 'candidate';
  roles: string[];
  permissions: string[];
  companyId?: string;
} | null): AccessSnapshot {
  if (!session) return EMPTY_ACCESS;

  return {
    accountId: session.accountId,
    principalType: session.principalType,
    roles: session.roles,
    permissions: session.permissions,
    companyId: session.companyId ?? null,
    // The identity service resolves a company super admin's permissions to the
    // full company scope before issuing the token, so no flag is needed here;
    // it is carried for the company portal's own settings UI, which does have
    // per-tenant feature switches.
    isSuperAdmin: session.roles.includes('super_admin') || session.roles.includes('owner'),
  };
}
