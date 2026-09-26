import type {
  EmploymentType,
  PublicSalary,
  Seniority,
  WorkAuthorisation,
  WorkMode,
  ApplicationStatus,
} from "./api-types";

/**
 * Enum keys are the API's vocabulary; these are the reader's.
 *
 * Kept in one file so "full_time" reads as "Full time" on the board, on the
 * filter, in the profile and on an application without three near-misses.
 */

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time" },
  { value: "contract", label: "Contract" },
  { value: "temporary", label: "Temporary" },
  { value: "internship", label: "Internship" },
];

export const WORK_MODES: { value: WorkMode; label: string }[] = [
  { value: "onsite", label: "On site" },
  { value: "hybrid", label: "Hybrid" },
  { value: "remote", label: "Remote" },
];

export const SENIORITIES: { value: Seniority; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "principal", label: "Principal" },
  { value: "executive", label: "Executive" },
];

export const WORK_AUTHORISATIONS: { value: WorkAuthorisation; label: string }[] = [
  { value: "unspecified", label: "Prefer not to say" },
  { value: "citizen", label: "Citizen" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "visa_holder", label: "Visa holder" },
  { value: "requires_sponsorship", label: "Requires sponsorship" },
];

function labelFrom<T extends string>(
  table: { value: T; label: string }[],
  value: T | undefined,
): string {
  if (!value) return "";
  return table.find((entry) => entry.value === value)?.label ?? humanise(value);
}

export const employmentTypeLabel = (value?: EmploymentType) =>
  labelFrom(EMPLOYMENT_TYPES, value);
export const workModeLabel = (value?: WorkMode) => labelFrom(WORK_MODES, value);
export const seniorityLabel = (value?: Seniority) => labelFrom(SENIORITIES, value);
export const workAuthorisationLabel = (value?: WorkAuthorisation) =>
  labelFrom(WORK_AUTHORISATIONS, value);

/** A fallback for a value the API added after this table was written. */
export function humanise(value: string): string {
  if (!value) return "";
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Submitted",
  in_review: "In review",
  interviewing: "Interviewing",
  offered: "Offer",
  hired: "Hired",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

/**
 * Money arrives as minor units plus a currency, never as a float, because a
 * salary band rounded by a binary fraction is a salary band that is wrong.
 */
export function formatSalaryRange(salary?: PublicSalary): string | null {
  if (!salary) return null;
  const currency = salary.currency || "USD";
  const min = salary.min === undefined ? null : formatMinor(salary.min, currency);
  const max = salary.max === undefined ? null : formatMinor(salary.max, currency);

  if (min && max) return `${min} – ${max}`;
  if (min) return `From ${min}`;
  if (max) return `Up to ${max}`;
  return null;
}

export function formatMinor(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(minor / 100);
  } catch {
    // An unknown ISO code should degrade to a readable number, not a crash.
    return `${(minor / 100).toLocaleString("en")} ${currency}`;
  }
}

export function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatMonth(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en", { year: "numeric", month: "short" });
}

export function formatDateTime(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 days ago" for anything recent, an absolute date once that stops helping. */
export function formatRelative(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDate(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
