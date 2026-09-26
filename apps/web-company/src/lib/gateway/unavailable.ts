/**
 * Features this app has screens for and the platform has no endpoint for.
 *
 * The company portal was built against its own database and grew screens the
 * services have not caught up with. Deleting those screens would lose work;
 * pointing them at an invented endpoint would produce a 404 the user cannot
 * act on. So each one renders an honest notice instead, and every one of them
 * is listed here — one place to read, and one place to delete from when the
 * endpoint arrives.
 */

export interface UnavailableFeature {
  key: string;
  title: string;
  /** What the platform would need before the screen can work. */
  blockedOn: string;
}

export const UNAVAILABLE_FEATURES: Record<string, UnavailableFeature> = {
  "email-templates": {
    key: "email-templates",
    title: "Email templates",
    blockedOn:
      "Messaging serves conversations, not stored templates. There is no template resource on any service.",
  },
  "email-settings": {
    key: "email-settings",
    title: "Email delivery settings",
    blockedOn:
      "SMTP configuration was local. Notifications owns email fan-out on the platform and exposes no per-tenant SMTP settings.",
  },
  integrations: {
    key: "integrations",
    title: "Integrations",
    blockedOn: "No integrations or outbound-webhook endpoint exists on any service.",
  },
  "feature-access": {
    key: "feature-access",
    title: "Feature access",
    blockedOn:
      "Per-tenant feature switches were a local table. The platform gates on subscription entitlements instead, which the billing screen already shows.",
  },
  "password-reset": {
    key: "password-reset",
    title: "Setting another member's password",
    blockedOn:
      "Identity owns credentials and serves no endpoint for one member to overwrite another's — it is an account takeover carried out with a permission that otherwise edits a job title. People reset their own password.",
  },
  masters: {
    key: "masters",
    title: "Master data",
    blockedOn:
      "Departments, locations, currencies and the other lookup lists were local tables. Jobs carries department and locations as free text, so nothing serves these lists.",
  },
};

export function unavailable(key: keyof typeof UNAVAILABLE_FEATURES): UnavailableFeature {
  const feature = UNAVAILABLE_FEATURES[key];
  if (!feature) throw new Error(`Unknown unavailable feature: ${key}`);
  return feature;
}
