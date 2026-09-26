import { defineFeature } from "@/lib/rbac/define";

/**
 * Access control is split into three features so a Super Admin can delegate
 * "manage the user directory" without also handing over "rewrite permissions".
 * All three are `alwaysEnabled` — switching them off would remove the only screen
 * capable of switching them back on.
 */

export const usersFeature = defineFeature({
  key: "users",
  name: "Users & Directory",
  description: "Internal user accounts, activation state, and role assignment",
  icon: "UserCog",
  group: "administration",
  order: 1,
  alwaysEnabled: true,
  crud: true,
  actions: [
    {
      action: "assign_roles",
      label: "Assign Roles to Users",
      description: "Grant or remove roles on a user account",
      sensitive: true,
    },
    {
      action: "manage_status",
      label: "Activate / Deactivate Users",
      description: "Suspend or restore a user's ability to sign in",
      sensitive: true,
    },
    {
      action: "reset_password",
      label: "Reset User Passwords",
      description: "Issue a new password for another user",
      sensitive: true,
    },
  ],
  settings: {
    tab: "users",
    label: "Users",
    navLabel: "Users & Directory",
    icon: "UserCog",
    order: 30,
  },
});

export const rolesFeature = defineFeature({
  key: "roles",
  name: "Roles & Permissions",
  description: "Custom roles and the permission matrix that drives the whole application",
  icon: "ShieldCheck",
  group: "administration",
  order: 2,
  alwaysEnabled: true,
  crud: true,
  actions: [
    {
      action: "assign_permissions",
      label: "Grant & Revoke Permissions",
      description: "Change which actions a role may perform across every feature",
      sensitive: true,
    },
  ],
  settings: {
    tab: "rbac",
    label: "Roles & Permissions",
    navLabel: "Roles & Permissions (RBAC)",
    icon: "ShieldCheck",
    order: 20,
  },
});

export const featureAccessFeature = defineFeature({
  key: "feature-access",
  name: "Feature Access",
  description: "Enable or disable entire modules for the organization",
  icon: "ToggleRight",
  group: "administration",
  order: 3,
  alwaysEnabled: true,
  crud: ["read", "update"],
  settings: {
    tab: "features",
    label: "Feature Access",
    navLabel: "Feature Access",
    icon: "ToggleRight",
    order: 25,
  },
});

export const auditLogFeature = defineFeature({
  key: "audit-logs",
  name: "Audit Trail",
  description: "Immutable record of every security and data-modifying event",
  icon: "ScrollText",
  group: "administration",
  order: 4,
  crud: ["read"],
  actions: [
    {
      action: "export",
      label: "Export Audit Trail",
      description: "Download audit events for compliance review",
    },
  ],
  settings: {
    tab: "audit",
    label: "Audit Trail",
    navLabel: "Audit Trail",
    icon: "ScrollText",
    order: 90,
  },
});
