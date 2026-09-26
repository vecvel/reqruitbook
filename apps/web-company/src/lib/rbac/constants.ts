/**
 * Bootstrap identifiers for the one system-level role.
 *
 * Super Admin status is a database property (`roles.is_super_admin`), not a magic
 * slug check — these constants exist only so seeding and migration can find or
 * create that row.
 */
export const SUPER_ADMIN_ROLE_SLUG = "super_admin";

/** Slug used before the feature-based RBAC upgrade; migrated to `super_admin`. */
export const LEGACY_SUPER_ADMIN_ROLE_SLUG = "system_admin";

export const SUPER_ADMIN_ROLE_NAME = "Super Admin";
export const SUPER_ADMIN_ROLE_ID = "role_super_admin";
export const SUPER_ADMIN_ROLE_DESCRIPTION =
  "Unrestricted access to every feature, action, and administrative control in the application.";
