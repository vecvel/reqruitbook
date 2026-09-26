import "server-only";

import { gatewayFetch } from "@/lib/gateway/client";

import type { CatalogueFeature, CatalogueGroup, PermissionCatalogue } from "./catalogue";
import type { FeatureGroupKey } from "./types";

/**
 * Reading the platform's permission catalogue.
 *
 * Split from `catalogue.ts` because the role editor is a client component and
 * needs the types and the empty value, while the fetch needs `server-only` — a
 * module carrying both would either leak the gateway client into the browser
 * bundle or fail the build the first time a client component imported a type
 * from it.
 */

/** What the identity service returns. */
interface WireCatalogue {
  scope: string;
  features: Array<{
    key: string;
    name: string;
    description: string;
    group: string;
    actions: Array<{
      key: string;
      action: string;
      label: string;
      description: string;
      sensitive: boolean;
    }>;
  }>;
}

/**
 * Group headings for the matrix.
 *
 * The platform names its groups but does not describe them, and a heading with
 * no explanation under it is what the previous screen had. The descriptions are
 * this app's copy; an unrecognised group still renders, titled by its own key,
 * rather than dropping every feature inside it.
 */
const GROUP_COPY: Record<string, { name: string; description: string }> = {
  recruitment: {
    name: "Recruitment Operations",
    description: "Day-to-day hiring: requisitions, pipeline, candidates, interviews, offers",
  },
  administration: {
    name: "Access & Administration",
    description: "The company profile, its people, and the roles that decide what they may do",
  },
};

function titleise(key: string): string {
  return key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Reads the catalogue for the company scope.
 *
 * Unauthenticated callers get nothing useful, so this is only ever called from a
 * signed-in screen. A failure returns the empty catalogue: a role editor with no
 * rows is obviously broken, where a half-populated one would quietly offer a
 * subset of the permissions a role could hold.
 */
export async function getPermissionCatalogue(): Promise<PermissionCatalogue> {
  const wire = await gatewayFetch<WireCatalogue>("/api/v1/rbac/catalogue", {
    query: { scope: "company" },
  });

  const features: CatalogueFeature[] = (wire.features ?? []).map((feature) => {
    const group = feature.group as FeatureGroupKey;
    return {
      key: feature.key,
      name: feature.name,
      description: feature.description,
      group,
      actions: (feature.actions ?? []).map((action) => ({
        key: action.key,
        featureKey: feature.key,
        featureName: feature.name,
        action: action.action,
        label: action.label,
        description: action.description,
        group,
        sensitive: action.sensitive,
      })),
    };
  });

  // Groups come from the features themselves, in the order the service returned
  // them, so a group added to the platform registry appears here without an
  // edit. Only its heading copy is local.
  const groups: CatalogueGroup[] = [];
  for (const feature of features) {
    if (groups.some((group) => group.key === feature.group)) continue;
    const copy = GROUP_COPY[feature.group];
    groups.push({
      key: feature.group,
      name: copy?.name ?? titleise(feature.group),
      description: copy?.description ?? "",
    });
  }

  return {
    groups,
    features,
    permissions: features.flatMap((feature) => feature.actions),
  };
}
