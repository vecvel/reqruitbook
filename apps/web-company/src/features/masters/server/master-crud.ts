"use server";

import { unavailable } from "@/lib/gateway/unavailable";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * Master data.
 *
 * These were per-tenant lookup tables. On the platform most of them turned out
 * not to be tenant data at all: work modes, employment types, seniority bands,
 * job statuses and currencies are vocabularies the jobs service defines as
 * enums, and a tenant cannot add to them because the service would reject the
 * value. Those are served here from the platform's own list, so the dropdowns
 * that read them keep working and can only offer values the API accepts.
 *
 * The genuinely tenant-specific ones — departments, locations, benefit
 * categories, interview and education levels — have no service behind them.
 * Jobs carries department and location as free text, so nothing stores a list
 * to choose from. Those return empty.
 *
 * Tracked in lib/gateway/unavailable.ts as "masters".
 */

export interface MasterRow {
  id: string;
  name: string;
  code: string;
  /** Same as `code`; the screens are inconsistent about which they read. */
  slug: string;
  isActive: boolean;
  sortOrder: number;
  /** Only interview types carried one, and nothing serves them now. */
  defaultDurationMinutes: number | null;
}

const row = (code: string, name: string, sortOrder: number): MasterRow => ({
  id: code,
  name,
  code,
  slug: code,
  isActive: true,
  sortOrder,
  defaultDurationMinutes: null,
});

/** Vocabularies the services enforce. Adding to these would fail at the API. */
const PLATFORM_VOCABULARIES: Record<string, MasterRow[]> = {
  "work-modes": ["onsite", "hybrid", "remote"].map((value, index) =>
    row(value, value === "onsite" ? "On-site" : value[0]!.toUpperCase() + value.slice(1), index),
  ),
  "employment-types": [
    ["full_time", "Full time"],
    ["part_time", "Part time"],
    ["contract", "Contract"],
    ["temporary", "Temporary"],
    ["internship", "Internship"],
    ["volunteer", "Volunteer"],
  ].map(([code, name], index) => row(code!, name!, index)),
  "experience-levels": [
    ["intern", "Intern"],
    ["entry", "Entry"],
    ["junior", "Junior"],
    ["mid", "Mid"],
    ["senior", "Senior"],
    ["lead", "Lead"],
    ["principal", "Principal"],
    ["director", "Director"],
    ["executive", "Executive"],
  ].map(([code, name], index) => row(code!, name!, index)),
  "job-statuses": [
    ["draft", "Draft"],
    ["open", "Open"],
    ["on_hold", "On hold"],
    ["closed", "Closed"],
    ["archived", "Archived"],
  ].map(([code, name], index) => row(code!, name!, index)),
  currencies: [
    ["USD", "US Dollar"],
    ["EUR", "Euro"],
    ["GBP", "Pound Sterling"],
    ["INR", "Indian Rupee"],
    ["AUD", "Australian Dollar"],
    ["CAD", "Canadian Dollar"],
    ["SGD", "Singapore Dollar"],
  ].map(([code, name], index) => row(code!, name!, index)),
  "pay-frequencies": [
    ["annual", "Annual"],
    ["monthly", "Monthly"],
    ["hourly", "Hourly"],
  ].map(([code, name], index) => row(code!, name!, index)),
};

/** The permission a master's feature key maps onto. */
function permissionFor(featureKey: string): string {
  // This app's own keys, not the platform's. These guards decide what to
  // render, and `requirePermission` resolves them against the local feature
  // registry — a platform key names a feature that registry does not define,
  // and an unknown feature reads as disabled for everyone but a super admin.
  //
  // Departments and locations are free text on a requisition, so reading them
  // is a requisition concern; the rest are vocabularies the organization
  // settings screen shows.
  return featureKey === "departments" || featureKey === "locations"
    ? "jobs.read"
    : "organization.read";
}

export async function listMaster(featureKey: string): Promise<MasterRow[]> {
  await requirePermission(permissionFor(featureKey));
  return PLATFORM_VOCABULARIES[featureKey] ?? [];
}

function blocked() {
  const feature = unavailable("masters");
  // `id` is null rather than absent: the screens select the row they just
  // created by id, and a missing key would be a runtime crash where a null is
  // simply "nothing was created".
  return {
    success: false as const,
    id: null,
    unavailable: feature,
    error: feature.blockedOn,
  };
}

export async function createMaster(_featureKey: string, _data: Record<string, unknown>) {
  await requirePermission("organization.update");
  return blocked();
}

export async function updateMaster(
  _featureKey: string,
  _id: string,
  _data: Record<string, unknown>,
) {
  await requirePermission("organization.update");
  return blocked();
}

export async function deleteMaster(_featureKey: string, _id: string) {
  await requirePermission("organization.update");
  return blocked();
}
