import { ALL_SETTINGS_TABS, settingsTabRequires } from "./navigation";
import { ALL_FEATURES } from "./registry";
import type { PermissionKey, RouteRuleDef } from "./types";

export interface ResolvedRouteRule extends RouteRuleDef {
  /**
   * The feature that owns the route, used for the module on/off check.
   * Null for aggregate screens such as Settings, which many features contribute
   * to and which therefore has no single owning module.
   */
  featureKey: string | null;
  mode: "any" | "all";
  exact: boolean;
}

/**
 * Every protected pathname in the application, contributed by the features themselves.
 * Sorted most-specific-first so `/jobs/new` wins over `/jobs`.
 */
const FEATURE_ROUTE_RULES: ResolvedRouteRule[] = ALL_FEATURES.flatMap((feature) =>
  (feature.routes ?? []).map((rule) => ({
    ...rule,
    featureKey: feature.key,
    mode: rule.mode ?? "any",
    exact: rule.exact ?? false,
  })),
);

/**
 * Settings is the one screen assembled from many features, so its rule is derived
 * from the tabs they contribute: holding any one of them opens the page, and the
 * page itself renders only the tabs that individual actor may see.
 */
const SETTINGS_ROUTE_RULE: ResolvedRouteRule = {
  path: "/settings",
  exact: false,
  featureKey: null,
  mode: "any",
  requires: [...new Set(ALL_SETTINGS_TABS.flatMap(settingsTabRequires))],
};

export const ROUTE_RULES: ResolvedRouteRule[] = [
  ...FEATURE_ROUTE_RULES,
  SETTINGS_ROUTE_RULE,
].sort((a, b) => segmentCount(b.path) - segmentCount(a.path) || b.path.length - a.path.length);

/**
 * Finds the rule protecting a pathname, or null when the route is unrestricted.
 *
 * Rule paths may contain `:param` segments (`/jobs/:id/edit`), so a dynamic route
 * resolves from the real pathname on both the server and the client.
 */
export function resolveRouteRule(pathname: string): ResolvedRouteRule | null {
  const clean = normalize(pathname);
  for (const rule of ROUTE_RULES) {
    if (matches(clean, normalize(rule.path), rule.exact)) return rule;
  }
  return null;
}

function matches(pathname: string, rulePath: string, exact: boolean): boolean {
  const pathSegments = pathname.split("/").filter(Boolean);
  const ruleSegments = rulePath.split("/").filter(Boolean);

  if (exact && pathSegments.length !== ruleSegments.length) return false;
  if (pathSegments.length < ruleSegments.length) return false;

  for (let i = 0; i < ruleSegments.length; i++) {
    const segment = ruleSegments[i];
    if (segment.startsWith(":")) continue; // dynamic segment matches anything
    if (segment !== pathSegments[i]) return false;
  }

  return true;
}

export function routePermissions(pathname: string): {
  requires: PermissionKey[];
  mode: "any" | "all";
  featureKey: string | null;
} | null {
  const rule = resolveRouteRule(pathname);
  if (!rule || rule.requires.length === 0) return null;
  return { requires: rule.requires, mode: rule.mode, featureKey: rule.featureKey };
}

function segmentCount(path: string): number {
  return path.split("/").filter(Boolean).length;
}

function normalize(pathname: string): string {
  const withoutQuery = pathname.split("?")[0].split("#")[0];
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) return withoutQuery.slice(0, -1);
  return withoutQuery;
}
