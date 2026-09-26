import { AccessEvaluator } from "./access";
import { ALL_FEATURES } from "./registry";
import type { FeatureDef, PermissionKey, SettingsTabDef } from "./types";

export interface NavChildView {
  label: string;
  href: string;
  badge?: number;
  badgeKey?: string;
}

export interface NavItemView {
  label: string;
  href: string;
  icon: string;
  featureKey: string;
  badge?: number;
  badgeKey?: string;
  children?: NavChildView[];
}

export interface SettingsTabView extends SettingsTabDef {
  featureKey: string;
  featureName: string;
  featureDescription: string;
}

/** The Settings entry is synthesized from every feature that contributes a tab. */
const SETTINGS_ROOT = { label: "Settings", href: "/settings", icon: "Settings" };

/** All settings tabs contributed by features, ordered. */
export const ALL_SETTINGS_TABS: SettingsTabView[] = ALL_FEATURES.filter((f) => f.settings)
  .map((f) => ({
    ...(f.settings as SettingsTabDef),
    featureKey: f.key,
    featureName: f.name,
    featureDescription: f.description,
  }))
  .sort((a, b) => a.order - b.order);

export function settingsTabRequires(tab: SettingsTabView): PermissionKey[] {
  return tab.requires ?? [`${tab.featureKey}.read`];
}

/** Settings tabs the actor may open, in declared order. */
export function visibleSettingsTabs(access: AccessEvaluator): SettingsTabView[] {
  return ALL_SETTINGS_TABS.filter(
    (tab) =>
      access.isFeatureEnabled(tab.featureKey) &&
      access.check(settingsTabRequires(tab), tab.mode ?? "any"),
  );
}

/**
 * Builds the sidebar from the feature registry, keeping only what the actor may open.
 *
 * A feature that adds a nav entry or a settings tab appears here automatically;
 * nothing enumerates modules by hand, so navigation can never drift from the
 * permission model.
 */
export function buildNavigation(
  access: AccessEvaluator,
  badges: Record<string, number> = {},
): NavItemView[] {
  const items: NavItemView[] = [];

  for (const feature of ALL_FEATURES) {
    if (!feature.nav?.length) continue;
    if (!access.isFeatureEnabled(feature.key)) continue;

    for (const nav of feature.nav) {
      const requires = nav.requires ?? defaultRequires(feature.key);
      if (!access.check(requires, nav.mode ?? "any")) continue;

      const children = (nav.children ?? [])
        .filter((child) => access.check(child.requires ?? requires, child.mode ?? "any"))
        .map((child) => ({
          label: child.label,
          href: child.href,
          badgeKey: child.badgeKey,
          badge: child.badgeKey ? badges[child.badgeKey] : undefined,
        }));

      items.push({
        label: nav.label,
        href: nav.href,
        icon: nav.icon,
        featureKey: feature.key,
        badgeKey: nav.badgeKey,
        badge: nav.badgeKey ? badges[nav.badgeKey] : undefined,
        children: children.length > 0 ? children : undefined,
      });
    }
  }

  const tabs = visibleSettingsTabs(access);
  if (tabs.length > 0) {
    items.push({
      ...SETTINGS_ROOT,
      featureKey: "settings",
      children: tabs.map((tab) => ({
        label: tab.navLabel ?? tab.label,
        href: `/settings?tab=${tab.tab}`,
      })),
    });
  }

  return items;
}

/** Permissions that grant access to the Settings screen at all (any visible tab). */
export function settingsRoutePermissions(): PermissionKey[] {
  return [...new Set(ALL_SETTINGS_TABS.flatMap(settingsTabRequires))];
}

export function featureNavEntries(feature: FeatureDef) {
  return feature.nav ?? [];
}

function defaultRequires(featureKey: string): PermissionKey[] {
  return [`${featureKey}.read`];
}
