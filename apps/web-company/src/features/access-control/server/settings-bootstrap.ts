"use server";

import { getActor } from "@/lib/rbac/guard";
import { visibleSettingsTabs } from "@/lib/rbac/navigation";
import { EMPTY_CATALOGUE } from "@/lib/rbac/catalogue";
import { getPermissionCatalogue } from "@/lib/rbac/catalogue.server";

import {
  getOrganizationSettings,
  getIntegrationSettings,
  getSmtpConfig,
} from "@/features/organization/server/actions";
import {
  getDepartments,
  getLocations,
  getCurrencies,
  getPayFrequencies,
  getJobStatuses,
  getInterviewTypes,
  getBenefitCategories,
  getWorkModes,
  getEmploymentTypes,
  getExperienceLevels,
  getEducationLevels,
} from "@/features/masters/server/actions";
import { getUsers } from "./users";
import { getRoles } from "./roles";
import { getFeatureAccess } from "./feature-access";

/**
 * One round-trip for the whole Settings screen.
 *
 * Each section is fetched only when the actor can open the tab that shows it, so
 * the payload is already shaped by the same permissions that render the tabs —
 * and a user without, say, roles access never even causes that query to run.
 */
export async function getSettingsBootstrap() {
  const actor = await getActor();
  if (!actor) {
    throw new Error("You must be signed in to view settings.");
  }

  const tabs = new Set(visibleSettingsTabs(actor.access).map((t) => t.tab));
  const when = async <T,>(tab: string, load: () => Promise<T>, fallback: T): Promise<T> => {
    if (!tabs.has(tab)) return fallback;
    try {
      return await load();
    } catch (error) {
      console.error(`Settings bootstrap: "${tab}" failed to load`, error);
      return fallback;
    }
  };

  const [
    organization,
    integrations,
    smtp,
    users,
    roles,
    catalogue,
    features,
    departments,
    locations,
    currencies,
    payFrequencies,
    jobStatuses,
    interviewTypes,
    benefitCategories,
    workModes,
    employmentTypes,
    experienceLevels,
    educationLevels,
  ] = await Promise.all([
    when("company", getOrganizationSettings, null),
    when("integrations", getIntegrationSettings, null),
    when("smtp", getSmtpConfig, null),
    when("users", getUsers, []),
    // The user directory also needs the role list to render assignments.
    tabs.has("rbac") || tabs.has("users")
      ? getRoles().catch(() => [])
      : Promise.resolve([]),
    // The permission matrix is drawn from the platform's catalogue, not this
    // app's registry: identity stores the platform's keys, so a matrix drawn
    // from the local one would offer checkboxes it cannot save.
    tabs.has("rbac")
      ? getPermissionCatalogue().catch(() => EMPTY_CATALOGUE)
      : Promise.resolve(EMPTY_CATALOGUE),
    when("features", getFeatureAccess, []),
    when("departments", getDepartments, []),
    when("locations", getLocations, []),
    when("currencies", getCurrencies, []),
    when("pay-frequencies", getPayFrequencies, []),
    when("job-statuses", getJobStatuses, []),
    when("interview-types", getInterviewTypes, []),
    when("benefit-categories", getBenefitCategories, []),
    when("work-modes", getWorkModes, []),
    when("employment-types", getEmploymentTypes, []),
    when("experience-levels", getExperienceLevels, []),
    when("education-levels", getEducationLevels, []),
  ]);

  return {
    organization,
    integrations,
    smtp,
    users,
    roles,
    catalogue,
    features,
    departments,
    locations,
    currencies,
    payFrequencies,
    jobStatuses,
    interviewTypes,
    benefitCategories,
    workModes,
    employmentTypes,
    experienceLevels,
    educationLevels,
  };
}
