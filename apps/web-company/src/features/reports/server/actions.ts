"use server";

import { getApplications, getPipelineStages } from "@/features/applications/server/actions";
import { getJobs } from "@/features/jobs/server/actions";
import { getOffers } from "@/features/offers/server/actions";
import { gatewayRead } from "@/lib/gateway/client";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * The reporting screen's aggregates.
 *
 * All three series are real now: requisitions carry a department, applications
 * carry a stage, and offers carry a status. Each groups from the same list the
 * corresponding screen reads, so a number here and a number there cannot
 * disagree.
 *
 * Each read is gated on the permission for the module it summarises, and
 * `reports.read` alone is not enough — a report is a different rendering of
 * records, not a way around who may see them. Counting offers needs no
 * `offers.view_compensation`: a count is not a salary.
 */
export async function getReportsData() {
  const { access } = await requirePermission("reports.read");

  const [jobs, applications, stages, offers] = await Promise.all([
    access.can("jobs.read") ? gatewayRead(() => getJobs(), []) : Promise.resolve([]),
    access.can("applications.read") ? gatewayRead(() => getApplications(), []) : Promise.resolve([]),
    access.can("applications.read") ? gatewayRead(() => getPipelineStages(), []) : Promise.resolve([]),
    access.can("offers.read") ? gatewayRead(() => getOffers(), []) : Promise.resolve([]),
  ]);

  const byDepartment = new Map<string, number>();
  for (const job of jobs) {
    // Department is free text on the platform; an unset one is still a real
    // group rather than a row to drop, or the totals would not add up.
    const name = job.departmentName?.trim() || "Unassigned";
    byDepartment.set(name, (byDepartment.get(name) ?? 0) + 1);
  }

  // Requisitions, pipeline and offers per department, joined through the job.
  // Applications and offers both name an application rather than a department,
  // so the requisition is what carries the department through.
  const departmentOfJob = new Map(
    jobs.map((job) => [job.id, job.departmentName?.trim() || "Unassigned"]),
  );
  const departmentOfApplication = new Map(
    applications.map((application) => [
      application.id,
      departmentOfJob.get(application.jobId) ?? "Unassigned",
    ]),
  );

  const velocity = new Map<string, { jobs: number; pipeline: number; offers: number }>();
  const bucket = (name: string) => {
    const row = velocity.get(name) ?? { jobs: 0, pipeline: 0, offers: 0 };
    velocity.set(name, row);
    return row;
  };
  for (const job of jobs) bucket(departmentOfJob.get(job.id) ?? "Unassigned").jobs += 1;
  for (const application of applications) {
    bucket(departmentOfApplication.get(application.id) ?? "Unassigned").pipeline += 1;
  }
  for (const offer of offers) {
    bucket(departmentOfApplication.get(offer.applicationId) ?? "Unassigned").offers += 1;
  }

  const stageNames = new Map(stages.map((stage) => [stage.id, stage.name]));
  const byStage = new Map<string, number>();
  for (const application of applications) {
    const name = stageNames.get(application.stageId) ?? application.stageName ?? "Unknown";
    byStage.set(name, (byStage.get(name) ?? 0) + 1);
  }

  const byStatus = new Map<string, number>();
  for (const offer of offers) {
    byStatus.set(offer.status, (byStatus.get(offer.status) ?? 0) + 1);
  }

  // Attribution, from the channel the applications service already records on
  // every application. Previously this table was four invented rows that
  // rendered for every tenant, including one with no applications at all.
  const bySource = new Map<string, { count: number; hires: number }>();
  for (const application of applications) {
    const key = application.source || "unknown";
    const row = bySource.get(key) ?? { count: 0, hires: 0 };
    row.count += 1;
    if (application.status === "hired") row.hires += 1;
    bySource.set(key, row);
  }

  const hired = applications.filter((application) => application.status === "hired");

  // Days between an application arriving and it reaching hired. The platform
  // records no separate hire timestamp, so `updatedAt` stands in — which is
  // accurate as long as being hired is the last thing that happens to an
  // application, and is why this is reported as null rather than 0 when there
  // is nothing to measure. A zero would read as "instant", not "unknown".
  const hireDurations = hired
    .map((application) => {
      const from = application.createdAt?.getTime();
      const to = application.updatedAt?.getTime() ?? from;
      return from !== undefined && to !== undefined ? (to - from) / 86_400_000 : null;
    })
    .filter((days): days is number => days !== null && days >= 0);

  const avgTimeToHireDays = hireDurations.length
    ? Math.round(hireDurations.reduce((sum, days) => sum + days, 0) / hireDurations.length)
    : null;

  // Of the offers that got an answer. Counting undecided offers as declines
  // would make a healthy pipeline look like a rejection problem.
  const answered = offers.filter(
    (offer) => offer.status === "accepted" || offer.status === "declined",
  );
  const offerAcceptanceRate = answered.length
    ? Math.round(
        (answered.filter((offer) => offer.status === "accepted").length / answered.length) * 100,
      )
    : null;

  return {
    jobsByDept: [...byDepartment].map(([departmentName, count]) => ({ departmentName, count })),
    appsByStage: [...byStage].map(([stage, count]) => ({ stage, count })),
    offersByStatus: [...byStatus].map(([status, count]) => ({ status, count })),
    sources: [...bySource]
      .map(([source, row]) => ({
        source,
        count: row.count,
        hires: row.hires,
        conversion: row.count ? `${((row.hires / row.count) * 100).toFixed(1)}%` : "0.0%",
      }))
      .sort((a, b) => b.count - a.count),
    // Null where there is nothing to measure. Every one of these was a
    // hard-coded figure before — 18 days, 92%, "+4.5% vs last quarter" — shown
    // to tenants with an empty pipeline.
    avgTimeToHireDays,
    offerAcceptanceRate,
    totalApplications: applications.length,
    totalHired: hired.length,
    totalOffers: offers.length,
    departments: [...velocity]
      .map(([name, row]) => ({ name, ...row }))
      .sort((a, b) => b.pipeline - a.pipeline || b.jobs - a.jobs),
  };
}
