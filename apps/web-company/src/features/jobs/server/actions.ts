"use server";

import { revalidatePath } from "next/cache";

import { gatewayFetch } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import type { PlatformApplication, PlatformJob } from "@/lib/gateway/types";
import { requirePermission } from "@/lib/rbac/guard";
import { recordAuditLog } from "@/lib/security/audit";

/**
 * Requisitions, served by the jobs service.
 *
 * The platform's job is narrower than the one this app used to store: it has a
 * department and a location list as free text rather than foreign keys, and it
 * has no req code, pay frequency, equity range, benefits list or skills. The
 * mapper below fills those with empty values rather than dropping the keys,
 * because the existing forms and tables read them and a missing key renders as
 * "undefined" on screen. Anything a recruiter types into one of those inputs is
 * not persisted — listed in the migration report as a field-level gap.
 */

/** The row shape every jobs screen in this app already reads. */
export interface JobRow {
  id: string;
  title: string;
  slug: string;
  reqCode: string;
  status: string;
  workMode: string;
  employmentType: string;
  experienceLevel: string;
  educationLevel: string;
  vacancies: number;
  locationText: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  payFrequency: string;
  isSalaryPublic: boolean;
  equityRange: string | null;
  bonusStructure: string | null;
  relocationAssistance: string | null;
  targetStartDate: Date | null;
  summary: string;
  responsibilities: string;
  requirements: string;
  niceToHave: string;
  aboutTeam: string;
  benefits: string;
  benefitsList: { title: string; description?: string; category?: string }[];
  skills: string[];
  secondarySkills: string[];
  customQuestions: unknown[];
  internalNotes: string;
  visibleOnPortal: boolean;
  visibleOnNetwork: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  departmentId: string | null;
  departmentName: string | null;
  departmentCode: string | null;
  locationId: string | null;
  locationName: string | null;
  locationCity: string | null;
  locationCountry: string | null;
  hiringManagerId: string | null;
  recruiterId: string | null;
  recruiterName: string | null;
  applicantCount: number;
}

function toDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function mapJob(job: PlatformJob, applicantCount = 0): JobRow {
  const locations = job.locations ?? [];
  const openedAt = toDate(job.openedAt);

  return {
    id: job.id,
    title: job.title,
    slug: job.slug,
    // The platform identifies a requisition by its slug; the req code was a
    // local invention, so the slug stands in where the UI shows a reference.
    reqCode: job.slug,
    status: job.status,
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceLevel: job.seniority,
    educationLevel: "",
    vacancies: job.headcount ?? 1,
    locationText: locations.join(", "),
    salaryMin: job.salary?.min ?? 0,
    salaryMax: job.salary?.max ?? 0,
    currency: job.salary?.currency ?? "USD",
    payFrequency: "annual",
    isSalaryPublic: job.salary?.isPublic ?? false,
    equityRange: null,
    bonusStructure: null,
    relocationAssistance: null,
    targetStartDate: null,
    summary: job.description ?? "",
    responsibilities: "",
    requirements: job.requirements ?? "",
    niceToHave: "",
    aboutTeam: "",
    benefits: "",
    benefitsList: [],
    skills: [],
    secondarySkills: [],
    customQuestions: [],
    internalNotes: job.internalNotes ?? "",
    visibleOnPortal: job.visibility?.portal ?? false,
    visibleOnNetwork: job.visibility?.network ?? false,
    // A requisition is "published" from the moment it opened on any surface.
    publishedAt: job.visibility?.portal || job.visibility?.network ? openedAt : null,
    createdAt: toDate(job.createdAt) ?? new Date(),
    updatedAt: toDate(job.updatedAt) ?? new Date(),
    departmentId: null,
    departmentName: job.department || null,
    departmentCode: null,
    locationId: null,
    locationName: locations[0] ?? null,
    locationCity: locations[0] ?? null,
    locationCountry: null,
    hiringManagerId: job.hiringManagerId ?? null,
    recruiterId: job.recruiterId ?? job.createdBy ?? null,
    recruiterName: null,
    applicantCount,
  };
}

/* -------------------------------------------------------------------------- */
/* Queries                                                                    */
/* -------------------------------------------------------------------------- */

export async function getJobs(params?: {
  status?: string;
  departmentId?: string;
  search?: string;
}): Promise<JobRow[]> {
  await requirePermission("jobs.read");

  const payload = await gatewayFetch<unknown>("/api/v1/jobs", {
    query: {
      limit: 100,
      ...(params?.status && params.status !== "all" ? { status: params.status } : {}),
      ...(params?.search ? { q: params.search } : {}),
      // Department is free text on the platform, and the screens pass a
      // department *name* through this parameter, so it filters server side.
      ...(params?.departmentId && params.departmentId !== "all"
        ? { department: params.departmentId }
        : {}),
    },
  });
  const jobs = unwrap<PlatformJob>(payload, "jobs");

  // The jobs service does not report an application count, so it is tallied
  // from the applications list. One extra call for the whole page rather than
  // one per row, and a failure leaves the counts at zero instead of the page
  // blank — the count is decoration, the requisition list is the content.
  const counts = await applicationCounts();

  return jobs.map((job) => mapJob(job, counts.get(job.id) ?? 0));
}

async function applicationCounts(): Promise<Map<string, number>> {
  try {
    const payload = await gatewayFetch<unknown>("/api/v1/applications", { query: { limit: 100 } });
    const counts = new Map<string, number>();
    for (const application of unwrap<PlatformApplication>(payload, "applications")) {
      counts.set(application.jobId, (counts.get(application.jobId) ?? 0) + 1);
    }
    return counts;
  } catch {
    return new Map();
  }
}

export async function getJobById(id: string): Promise<JobRow | null> {
  await requirePermission("jobs.read");

  try {
    const job = await gatewayFetch<PlatformJob>(`/api/v1/jobs/${encodeURIComponent(id)}`);
    return mapJob(job);
  } catch (error) {
    // A 404 here is also what another tenant's id looks like, by design.
    if (isNotFound(error)) return null;
    throw error;
  }
}

/** The custom application form attached to a requisition. */
export async function getJobForm(id: string) {
  await requirePermission("jobs.read");
  return gatewayFetch<{ form: { fields: unknown[] }; allowedFileTypes: string[] }>(
    `/api/v1/jobs/${encodeURIComponent(id)}/form`,
  );
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: number }).status === 404;
}

/* -------------------------------------------------------------------------- */
/* Mutations                                                                  */
/* -------------------------------------------------------------------------- */

export interface JobInput {
  title: string;
  slug?: string;
  reqCode?: string;
  departmentId?: string | null;
  departmentName?: string;
  locationId?: string | null;
  locationText?: string;
  workMode?: string;
  employmentType?: string;
  experienceLevel?: string;
  educationLevel?: string;
  vacancies?: number;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  payFrequency?: string;
  isSalaryPublic?: boolean;
  equityRange?: string | null;
  bonusStructure?: string | null;
  relocationAssistance?: string | null;
  targetStartDate?: Date | null;
  summary?: string;
  responsibilities?: string;
  requirements?: string;
  niceToHave?: string;
  aboutTeam?: string;
  benefits?: string;
  benefitsList?: { id?: string; title: string; description?: string; category?: string }[];
  skills?: string[];
  secondarySkills?: string[];
  customQuestions?: unknown[];
  hiringManagerId?: string | null;
  recruiterId?: string | null;
  internalNotes?: string;
  status?: string;
}

/** Slugs are the platform's identifier for a requisition on a public surface. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Folds the local form's several description fields into the platform's two.
 *
 * The platform carries `description` and `requirements` as markdown. This app's
 * form has summary, responsibilities, "about the team" and "nice to have" as
 * separate inputs; concatenating them under headings preserves what the
 * recruiter wrote rather than silently discarding three of the four.
 */
function composeDescription(data: Partial<JobInput>): string {
  const sections: string[] = [];
  if (data.summary) sections.push(data.summary.trim());
  if (data.responsibilities) sections.push(`## Responsibilities\n\n${data.responsibilities.trim()}`);
  if (data.aboutTeam) sections.push(`## About the team\n\n${data.aboutTeam.trim()}`);
  if (data.benefits) sections.push(`## Benefits\n\n${data.benefits.trim()}`);
  return sections.join("\n\n");
}

function composeRequirements(data: Partial<JobInput>): string {
  const sections: string[] = [];
  if (data.requirements) sections.push(data.requirements.trim());
  if (data.niceToHave) sections.push(`## Nice to have\n\n${data.niceToHave.trim()}`);
  return sections.join("\n\n");
}

function toLocations(data: Partial<JobInput>): string[] {
  if (!data.locationText) return [];
  return data.locationText
    .split(/[,/]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export async function createJob(data: JobInput) {
  const { user } = await requirePermission("jobs.create");

  const body: Record<string, unknown> = {
    title: data.title,
    slug: data.slug || slugify(data.title),
    department: data.departmentName ?? "",
    locations: toLocations(data),
    workMode: data.workMode || "hybrid",
    employmentType: data.employmentType || "full_time",
    seniority: data.experienceLevel || "mid",
    description: composeDescription(data),
    requirements: composeRequirements(data),
    salary: {
      min: data.salaryMin ?? 0,
      max: data.salaryMax ?? 0,
      currency: data.currency || "USD",
      isPublic: data.isSalaryPublic ?? true,
    },
    headcount: data.vacancies ?? 1,
    internalNotes: data.internalNotes ?? "",
  };

  const job = await gatewayFetch<PlatformJob>("/api/v1/jobs", { method: "POST", body });

  // A requisition is created as a draft. Publishing is a separate capability
  // and a separate call, so it is only attempted when asked for.
  if (data.status && data.status !== "draft") {
    await gatewayFetch<PlatformJob>(`/api/v1/jobs/${encodeURIComponent(job.id)}/publish`, {
      method: "POST",
      body: { portal: true, network: false },
    });
  }

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.created",
    entityType: "job",
    entityId: job.id,
    metadata: { title: data.title, status: data.status ?? "draft" },
  });

  revalidatePath("/jobs");
  revalidatePath("/careers");
  revalidatePath("/dashboard");

  return { success: true, id: job.id };
}

export async function updateJob(id: string, data: Partial<JobInput>) {
  const { user } = await requirePermission("jobs.update");

  const body: Record<string, unknown> = {};
  if (data.title !== undefined) body.title = data.title;
  if (data.departmentName !== undefined) body.department = data.departmentName;
  if (data.locationText !== undefined) body.locations = toLocations(data);
  if (data.workMode !== undefined) body.workMode = data.workMode;
  if (data.employmentType !== undefined) body.employmentType = data.employmentType;
  if (data.experienceLevel !== undefined) body.seniority = data.experienceLevel;
  if (data.internalNotes !== undefined) body.internalNotes = data.internalNotes;
  if (data.vacancies !== undefined) body.headcount = data.vacancies;

  const touchesDescription =
    data.summary !== undefined ||
    data.responsibilities !== undefined ||
    data.aboutTeam !== undefined ||
    data.benefits !== undefined;
  if (touchesDescription) body.description = composeDescription(data);

  if (data.requirements !== undefined || data.niceToHave !== undefined) {
    body.requirements = composeRequirements(data);
  }

  if (
    data.salaryMin !== undefined ||
    data.salaryMax !== undefined ||
    data.currency !== undefined ||
    data.isSalaryPublic !== undefined
  ) {
    body.salary = {
      min: data.salaryMin ?? 0,
      max: data.salaryMax ?? 0,
      currency: data.currency || "USD",
      isPublic: data.isSalaryPublic ?? true,
    };
  }

  await gatewayFetch<PlatformJob>(`/api/v1/jobs/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body,
  });

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.updated",
    entityType: "job",
    entityId: id,
    metadata: { fields: Object.keys(body) },
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/careers");

  return { success: true };
}

/** Publishes or unpublishes a requisition on either public surface. */
export async function setJobVisibility(
  id: string,
  visibility: { portal: boolean; network: boolean },
) {
  const { user } = await requirePermission("jobs.publish");

  await gatewayFetch<PlatformJob>(`/api/v1/jobs/${encodeURIComponent(id)}/publish`, {
    method: "POST",
    body: visibility,
  });

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.visibility_changed",
    entityType: "job",
    entityId: id,
    metadata: visibility,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  revalidatePath("/careers");

  return { success: true };
}

export async function closeJob(id: string) {
  const { user } = await requirePermission("jobs.update");

  await gatewayFetch<PlatformJob>(`/api/v1/jobs/${encodeURIComponent(id)}/close`, {
    method: "POST",
    body: {},
  });

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.closed",
    entityType: "job",
    entityId: id,
  });

  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return { success: true };
}

export async function deleteJob(id: string) {
  const { user } = await requirePermission("jobs.delete");

  // The jobs service archives rather than destroys: a requisition with
  // applications against it must not disappear from their history.
  await gatewayFetch<void>(`/api/v1/jobs/${encodeURIComponent(id)}`, { method: "DELETE" });

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.archived",
    entityType: "job",
    entityId: id,
  });

  revalidatePath("/jobs");
  revalidatePath("/careers");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function duplicateJob(id: string) {
  const { user } = await requirePermission("jobs.duplicate");

  const copy = await gatewayFetch<PlatformJob>(
    `/api/v1/jobs/${encodeURIComponent(id)}/duplicate`,
    { method: "POST", body: {} },
  );

  await recordAuditLog({
    actorId: user.id,
    orgId: user.orgId,
    action: "jobs.duplicated",
    entityType: "job",
    entityId: copy.id,
    metadata: { sourceId: id },
  });

  revalidatePath("/jobs");
  return { success: true, id: copy.id };
}
