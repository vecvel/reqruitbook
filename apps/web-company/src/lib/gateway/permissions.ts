/**
 * Translating the platform's permission vocabulary into this app's.
 *
 * The identity service owns the catalogue (`services/identity/internal/rbac/
 * registry.go`) and issues tokens carrying its keys. This app's UI was built
 * against its own feature registry, whose keys mostly — but not exactly —
 * agree. `jobs.read` means the same thing in both; `jobs.publish` here is
 * `jobs.publish_portal` there, and `users.*` here is `recruiters.*` there.
 *
 * The mapping is written out rather than inferred because the disagreements
 * are not systematic, and a clever rule would silently grant the wrong thing
 * the next time either side adds a key. Nothing here is a security decision:
 * the gateway and each service re-check the platform key on every call. This
 * only decides which navigation entries and buttons are worth rendering.
 */

/** Local permission key -> the platform keys that should grant it (any one suffices). */
const GRANTS: Record<string, string[]> = {
  // Always available to a signed-in member; the dashboard is a landing page.
  "dashboard.read": ["jobs.read", "applications.read", "candidates.read", "company_profile.read"],

  "jobs.create": ["jobs.create"],
  "jobs.read": ["jobs.read"],
  "jobs.update": ["jobs.update"],
  "jobs.delete": ["jobs.delete"],
  "jobs.publish": ["jobs.publish_portal", "jobs.publish_network"],
  "jobs.duplicate": ["jobs.duplicate"],
  "jobs.export": ["jobs.export"],

  "applications.create": ["applications.create"],
  "applications.read": ["applications.read"],
  "applications.update": ["applications.update"],
  "applications.delete": ["applications.delete"],
  "applications.advance_stage": ["applications.advance_stage"],
  "applications.reject": ["applications.reject"],
  "applications.bulk_update": ["applications.bulk_update"],
  "applications.export": ["applications.export"],

  "candidates.create": ["candidates.create"],
  "candidates.read": ["candidates.read"],
  "candidates.update": ["candidates.update"],
  "candidates.delete": ["candidates.delete"],
  "candidates.export": ["candidates.export"],
  // The nearest platform capability: the talent pool is discovery over profiles.
  "candidates.manage_talent_pool": ["talent_search.search"],
  "candidates.import": ["candidates.create"],

  "interviews.create": ["interviews.create"],
  "interviews.read": ["interviews.read"],
  "interviews.update": ["interviews.update"],
  "interviews.delete": ["interviews.delete"],
  "interviews.submit_scorecard": ["interviews.submit_scorecard"],
  "interviews.view_scorecards": ["interviews.view_scorecards"],

  "offers.create": ["offers.create"],
  "offers.read": ["offers.read"],
  "offers.update": ["offers.update"],
  "offers.delete": ["offers.delete"],
  "offers.approve": ["offers.approve"],
  "offers.send": ["offers.send"],
  "offers.view_compensation": ["offers.view_compensation"],
  // Still no platform equivalent, even though offers now has a service: HRM
  // sync is an integration nobody has built, and there is no offers export
  // endpoint. Left ungranted rather than mapped to something adjacent that
  // would grant more than it should.
  "offers.sync_hrm": [],
  "offers.export": [],

  "communications.create": ["messaging.send"],
  "communications.read": ["messaging.read"],
  "communications.update": ["messaging.send"],
  "communications.delete": ["messaging.send"],
  "communications.send": ["messaging.send"],
  "communications.view_history": ["messaging.read_all"],

  "reports.read": ["reports.read"],
  "reports.export": ["reports.export"],

  "careers.read": ["company_profile.read"],
  "careers.update": ["company_profile.update"],

  "users.create": ["recruiters.create"],
  "users.read": ["recruiters.read"],
  "users.update": ["recruiters.update"],
  "users.delete": ["recruiters.delete"],
  "users.assign_roles": ["recruiters.assign_roles"],
  "users.manage_status": ["recruiters.manage_status"],
  // Identity owns credentials and serves no endpoint for one member to overwrite
  // another's. Deliberately ungranted rather than aliased to recruiters.update:
  // that key edits a job title, and this one would be a complete takeover.
  "users.reset_password": [],

  "roles.create": ["company_roles.create"],
  "roles.read": ["company_roles.read"],
  "roles.update": ["company_roles.update"],
  "roles.delete": ["company_roles.delete"],
  "roles.assign_permissions": ["company_roles.assign_permissions"],

  // Per-tenant feature switches are this app's own idea; the platform has no
  // equivalent, so only a super admin sees the screen.
  "feature-access.read": [],
  "feature-access.update": [],

  "audit-logs.read": ["company_audit.read"],
  "audit-logs.export": ["company_audit.export"],

  "organization.read": ["company_profile.read"],
  "organization.update": ["company_profile.update"],

  // Delivery settings and integrations are not platform capabilities.
  "email-settings.read": [],
  "email-settings.update": [],
  "email-settings.test": [],
  "integrations.read": [],
  "integrations.update": [],
};

/** Master-data features: no platform endpoint backs any of them. */
export const MASTER_FEATURE_KEYS = [
  "departments",
  "locations",
  "currencies",
  "pay-frequencies",
  "job-statuses",
  "interview-types",
  "benefit-categories",
  "work-modes",
  "employment-types",
  "experience-levels",
  "education-levels",
] as const;

/**
 * Expands a platform permission list into this app's permission keys.
 *
 * A super admin (the company owner) is handed every local key: identity already
 * resolves an owner to the full company scope, and the local registry contains
 * screens the platform has no key for. The evaluator would grant those anyway
 * through `isSuperAdmin`; doing it here as well keeps the snapshot honest about
 * what the UI will actually show.
 */
export function toLocalPermissions(platformPermissions: string[]): string[] {
  const held = new Set(platformPermissions);
  const local: string[] = [];

  for (const [localKey, platformKeys] of Object.entries(GRANTS)) {
    if (platformKeys.some((key) => held.has(key))) local.push(localKey);
  }

  return local.sort();
}

/** Every local key this app knows how to grant, for the super-admin case. */
export function allLocalPermissions(): string[] {
  return Object.keys(GRANTS).sort();
}
