// "use server", not just "server-only": the careers board and apply screens are
// client components that call these directly. Without the directive Next treats
// this as an ordinary module and bundles it for the browser, where its
// transitive next/headers import fails the build.
"use server";

import { publicGatewayFetch } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import type { PlatformApplicationForm, PlatformPublicJob } from "@/lib/gateway/types";

/**
 * The company's public careers page.
 *
 * Unauthenticated by design, and scoped by hostname rather than by anything in
 * the request: the gateway resolves `{slug}.{hostname}` to a tenant before the
 * jobs service sees the call, so this careers page cannot be made to list
 * another company's openings.
 *
 * A careers page only exists once the company publishes it. Until then
 * `/api/v1/public/company` answers 404 and `getPublicOrganization` returns null,
 * which is what the page renders its "not published" state from.
 */

export interface PublicOrganization {
  id: string;
  name: string;
  logoUrl: string | null;
  careersDomain: string | null;
  defaultCurrency: string;
  tagline: string;
  aboutMarkdown: string;
  benefits: string[];
  brandColor: string;
  heroImageKey: string;
  description: string;
  industry: string;
  size: string;
  website: string;
  headquarters: string;
}

interface PublicCompanyResponse {
  slug: string;
  displayName: string;
  description: string;
  logoKey: string;
  website: string;
  industry: string;
  size: string;
  foundedYear: number | null;
  headquarters: string;
  locations: { city: string; country: string }[];
  socialLinks: Record<string, string>;
  brand: {
    brandColor: string;
    heroImageKey: string;
    tagline: string;
    aboutMarkdown: string;
    benefits: string[];
  };
}

export async function getPublicOrganization(): Promise<PublicOrganization | null> {
  try {
    const company = await publicGatewayFetch<PublicCompanyResponse>("/api/v1/public/company", {
      // Careers pages change rarely and are read by strangers; a short shared
      // cache keeps a burst of traffic off the companies service.
      revalidate: 60,
      tags: ["public-company"],
    });

    return {
      id: company.slug,
      name: company.displayName,
      // An object key, not a URL. Serving it needs a public asset route the
      // companies service does not expose yet — reported as a gap.
      logoUrl: null,
      careersDomain: null,
      defaultCurrency: "USD",
      tagline: company.brand?.tagline ?? "",
      aboutMarkdown: company.brand?.aboutMarkdown ?? "",
      benefits: company.brand?.benefits ?? [],
      brandColor: company.brand?.brandColor ?? "",
      heroImageKey: company.brand?.heroImageKey ?? "",
      description: company.description ?? "",
      industry: company.industry ?? "",
      size: company.size ?? "",
      website: company.website ?? "",
      headquarters: company.headquarters ?? "",
    };
  } catch {
    // 404 means the portal is unpublished, which is a state and not an error.
    return null;
  }
}

function mapPublicJob(job: PlatformPublicJob) {
  const locations = job.locations ?? [];
  return {
    id: job.id,
    slug: job.slug,
    title: job.title,
    status: "open",
    workMode: job.workMode,
    employmentType: job.employmentType,
    experienceLevel: job.seniority,
    vacancies: 1,
    locationText: locations.join(", "),
    salaryMin: job.salary?.min ?? 0,
    salaryMax: job.salary?.max ?? 0,
    currency: job.salary?.currency ?? "USD",
    // The service omits salary entirely when the recruiter marked it private,
    // so its presence is the flag.
    isSalaryPublic: Boolean(job.salary),
    summary: job.description ?? "",
    requirements: job.requirements ?? "",
    skills: [] as string[],
    publishedAt: job.publishedAt ? new Date(job.publishedAt) : null,
    createdAt: job.publishedAt ? new Date(job.publishedAt) : new Date(),
    departmentId: null,
    departmentName: job.department || null,
    locationId: null,
    locationName: locations[0] ?? null,
    locationCity: locations[0] ?? null,
    locationCountry: null,
  };
}

export type PublicJob = ReturnType<typeof mapPublicJob>;

export async function getPublishedJobs(filters?: {
  q?: string;
  department?: string;
  location?: string;
  workMode?: string;
  employmentType?: string;
}): Promise<PublicJob[]> {
  try {
    const payload = await publicGatewayFetch<unknown>("/api/v1/public/jobs", {
      query: {
        limit: 100,
        ...(filters?.q ? { q: filters.q } : {}),
        ...(filters?.department ? { department: filters.department } : {}),
        ...(filters?.location ? { location: filters.location } : {}),
        ...(filters?.workMode ? { workMode: filters.workMode } : {}),
        ...(filters?.employmentType ? { employmentType: filters.employmentType } : {}),
      },
      revalidate: 30,
      tags: ["public-jobs"],
    });
    return unwrap<PlatformPublicJob>(payload, "jobs").map(mapPublicJob);
  } catch {
    return [];
  }
}

/**
 * One published requisition, by slug.
 *
 * The public route is keyed by slug rather than id — an id is an internal
 * handle and a public URL should not depend on one. Callers holding an id fall
 * back to matching within the published list.
 */
export async function getPublishedJobById(idOrSlug: string): Promise<PublicJob | null> {
  try {
    const job = await publicGatewayFetch<PlatformPublicJob>(
      `/api/v1/public/jobs/${encodeURIComponent(idOrSlug)}`,
      { revalidate: 30 },
    );
    return mapPublicJob(job);
  } catch {
    const jobs = await getPublishedJobs();
    return jobs.find((job) => job.id === idOrSlug || job.slug === idOrSlug) ?? null;
  }
}

/** The custom application form a requisition declares. */
export async function getPublishedJobForm(slug: string): Promise<PlatformApplicationForm | null> {
  try {
    const payload = await publicGatewayFetch<{ form: PlatformApplicationForm }>(
      `/api/v1/public/jobs/${encodeURIComponent(slug)}/form`,
      { revalidate: 30 },
    );
    return payload.form ?? null;
  } catch {
    return null;
  }
}

/**
 * The filter options the careers page offers.
 *
 * Derived from the published jobs themselves rather than from master-data
 * tables, which no longer exist: departments and locations are free text on a
 * platform requisition, so the only honest source is what is actually posted.
 */
export async function getPublicJobFilters() {
  const jobs = await getPublishedJobs();

  const departments = [...new Set(jobs.map((job) => job.departmentName).filter(Boolean))] as string[];
  const locations = [
    ...new Set(jobs.flatMap((job) => job.locationText.split(",").map((part) => part.trim()))),
  ].filter(Boolean);
  const workModes = [...new Set(jobs.map((job) => job.workMode).filter(Boolean))];
  const employmentTypes = [...new Set(jobs.map((job) => job.employmentType).filter(Boolean))];

  return {
    departments: departments.sort(),
    locations: locations.sort(),
    workModes: workModes.sort(),
    experienceLevels: [...new Set(jobs.map((job) => job.experienceLevel).filter(Boolean))].sort(),
    employmentTypes: employmentTypes.sort(),
  };
}
