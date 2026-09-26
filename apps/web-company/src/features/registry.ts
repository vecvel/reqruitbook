import type { FeatureDef } from "@/lib/rbac/types";

import { dashboardFeature } from "./dashboard/feature";
import { jobsFeature } from "./jobs/feature";
import { applicationsFeature } from "./applications/feature";
import { candidatesFeature } from "./candidates/feature";
import { interviewsFeature } from "./interviews/feature";
import { offersFeature } from "./offers/feature";
import { communicationsFeature } from "./communications/feature";
import { reportsFeature } from "./reports/feature";
import { careersFeature } from "./careers/feature";
import {
  usersFeature,
  rolesFeature,
  featureAccessFeature,
  auditLogFeature,
} from "./access-control/feature";
import {
  organizationFeature,
  emailSettingsFeature,
  integrationsFeature,
} from "./organization/feature";
import { MASTER_FEATURES } from "./masters/feature";

/**
 * The single registration point for the application's features.
 *
 * Adding a feature means writing its `feature.ts` and appending it here. Its
 * permissions then appear in the Super Admin matrix, its navigation is filtered
 * by those permissions, and its routes and server actions are guarded — with no
 * change to the RBAC kernel.
 */
export const FEATURES: FeatureDef[] = [
  dashboardFeature,
  jobsFeature,
  applicationsFeature,
  candidatesFeature,
  interviewsFeature,
  offersFeature,
  communicationsFeature,
  reportsFeature,
  careersFeature,

  usersFeature,
  rolesFeature,
  featureAccessFeature,
  auditLogFeature,

  organizationFeature,
  emailSettingsFeature,
  integrationsFeature,
  ...MASTER_FEATURES,
];
