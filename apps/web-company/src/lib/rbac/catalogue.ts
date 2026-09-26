import type { FeatureGroupKey } from "./types";

/**
 * The platform's permission catalogue, in the shape this app's UI already speaks.
 *
 * The role editor used to render `lib/rbac/registry.ts` — this app's own feature
 * list. That was right when the roles lived in this app's database. They live in
 * the identity service now, and identity stores its own permission keys, so a
 * matrix drawn from the local registry would offer checkboxes for permissions
 * the platform cannot store and hide the ones it can.
 *
 * So the matrix reads from `/api/v1/rbac/catalogue` instead — the same registry
 * the token issuer and every service guard resolve against. Mapping it into the
 * local `FeatureDef`/`PermissionDef` shapes rather than introducing a second set
 * of types is what lets the existing screens render it unchanged.
 *
 * The local registry is still the right source for everything else: navigation,
 * route rules and the settings tabs are this app's own structure, and several of
 * its screens have no platform permission at all.
 */

export interface CataloguePermission {
  key: string;
  featureKey: string;
  featureName: string;
  action: string;
  label: string;
  description: string;
  group: FeatureGroupKey;
  sensitive: boolean;
}

export interface CatalogueFeature {
  key: string;
  name: string;
  description: string;
  group: FeatureGroupKey;
  actions: CataloguePermission[];
}

export interface CatalogueGroup {
  key: FeatureGroupKey;
  name: string;
  description: string;
}

export interface PermissionCatalogue {
  groups: CatalogueGroup[];
  features: CatalogueFeature[];
  permissions: CataloguePermission[];
}

export const EMPTY_CATALOGUE: PermissionCatalogue = {
  groups: [],
  features: [],
  permissions: [],
};
