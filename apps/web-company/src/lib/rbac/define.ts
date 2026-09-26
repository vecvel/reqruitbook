import type {
  CrudAction,
  FeatureActionDef,
  FeatureDef,
  FeatureInput,
  PermissionKey,
} from "./types";

export const CRUD_ACTIONS: CrudAction[] = ["create", "read", "update", "delete"];

const CRUD_TEMPLATES: Record<CrudAction, { label: string; describe: (name: string) => string }> = {
  create: { label: "Create", describe: (n) => `Create new ${n.toLowerCase()} records` },
  read: { label: "Read", describe: (n) => `View and list ${n.toLowerCase()}` },
  update: { label: "Update", describe: (n) => `Edit existing ${n.toLowerCase()} records` },
  delete: { label: "Delete", describe: (n) => `Permanently remove ${n.toLowerCase()} records` },
};

/** Builds the canonical permission string for a feature/action pair. */
export function permissionKey(featureKey: string, action: string): PermissionKey {
  return `${featureKey}.${action}`;
}

/** Splits `jobs.create` back into its parts; returns null for malformed keys. */
export function parsePermissionKey(
  key: PermissionKey,
): { featureKey: string; action: string } | null {
  const index = key.indexOf(".");
  if (index <= 0 || index === key.length - 1) return null;
  return { featureKey: key.slice(0, index), action: key.slice(index + 1) };
}

/**
 * Declares a feature and the permissions it owns.
 *
 * Registering a feature is the only step required to make its permissions appear in
 * the Super Admin matrix, in the navigation filter, and in the server-side guards.
 */
export function defineFeature(input: FeatureInput): FeatureDef {
  const overrides = new Map(
    (input.actions ?? []).map((a) => [a.action, a] as const),
  );

  const requestedCrud: CrudAction[] =
    input.crud === true ? CRUD_ACTIONS : Array.isArray(input.crud) ? input.crud : [];

  const actions: FeatureActionDef[] = [];

  for (const action of requestedCrud) {
    const template = CRUD_TEMPLATES[action];
    const override = overrides.get(action);
    overrides.delete(action);
    actions.push({
      action,
      kind: "crud",
      label: override?.label ?? `${template.label} ${input.name}`,
      description: override?.description ?? template.describe(input.name),
      sensitive: override?.sensitive,
    });
  }

  for (const [, override] of overrides) {
    actions.push({
      action: override.action,
      kind: override.kind ?? "custom",
      label: override.label ?? humanize(override.action),
      description: override.description ?? `${humanize(override.action)} within ${input.name}`,
      sensitive: override.sensitive,
    });
  }

  if (actions.length === 0) {
    throw new Error(`Feature "${input.key}" registers no actions`);
  }

  assertSlug(input.key, `Feature key "${input.key}"`);
  for (const a of actions) assertSlug(a.action, `Action "${a.action}" of feature "${input.key}"`);

  return {
    key: input.key,
    name: input.name,
    description: input.description,
    icon: input.icon,
    group: input.group,
    order: input.order ?? 100,
    actions,
    nav: input.nav,
    routes: input.routes,
    settings: input.settings,
    alwaysEnabled: input.alwaysEnabled ?? false,
    defaultEnabled: input.defaultEnabled ?? true,
  };
}

function humanize(value: string): string {
  return value
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function assertSlug(value: string, subject: string): void {
  if (!/^[a-z][a-z0-9_-]*$/.test(value)) {
    throw new Error(`${subject} must be lowercase alphanumeric with - or _ separators`);
  }
}
