"use server";

import { getApplications, getPipelineStages } from "@/features/applications/server/actions";
import { getCandidates } from "@/features/candidates/server/actions";
import { getInterviews } from "@/features/interviews/server/actions";
import { getJobs } from "@/features/jobs/server/actions";
import { gatewayRead } from "@/lib/gateway/client";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * The dashboard's numbers.
 *
 * Composed from the same endpoints the pipeline and requisition screens read,
 * rather than from counting queries against a local database. Each block is
 * gated on the permission for the module it describes, so a recruiter without
 * candidate access never sees how many candidates exist.
 *
 * Upcoming interviews are read from the interviews service, gated on
 * `interviews.read` like every other block — a dashboard that summarises a
 * module the viewer cannot open would be a way around the permission.
 */
export async function getDashboardMetrics() {
  const { access } = await requirePermission("reports.read");

  const canReadJobs = access.can("jobs.read");
  const canReadApplications = access.can("applications.read");
  const canReadCandidates = access.can("candidates.read");
  const canReadInterviews = access.can("interviews.read");

  const [jobs, applications, stages, candidates, interviews] = await Promise.all([
    canReadJobs ? gatewayRead(() => getJobs({ status: "open" }), []) : Promise.resolve([]),
    canReadApplications ? gatewayRead(() => getApplications(), []) : Promise.resolve([]),
    canReadApplications ? gatewayRead(() => getPipelineStages(), []) : Promise.resolve([]),
    canReadCandidates ? gatewayRead(() => getCandidates(), []) : Promise.resolve([]),
    canReadInterviews
      ? gatewayRead(() => getInterviews({ status: "scheduled" }), [])
      : Promise.resolve([]),
  ]);

  // "Upcoming" is the next seven days, and only rounds still ahead of now — a
  // scheduled round that has already passed is somebody's forgotten housekeeping,
  // not something to put on a dashboard as pending.
  const now = Date.now();
  const horizon = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = interviews
    .filter((interview) => {
      const at = interview.scheduledStart?.getTime();
      return at !== undefined && at >= now && at <= horizon;
    })
    .sort((a, b) => (a.scheduledStart?.getTime() ?? 0) - (b.scheduledStart?.getTime() ?? 0));

  const totalApps = applications.length;

  // The pipeline is the company's own — built from their stages in their order,
  // not from a hard-coded list that would be wrong for any tenant who renamed
  // or reordered one.
  const pipelineStages = [...stages]
    .sort((a, b) => a.order - b.order)
    .map((stage) => {
      const count = applications.filter((application) => application.stageId === stage.id).length;
      return {
        name: stage.name,
        count,
        percentage: totalApps > 0 ? Math.round((count / totalApps) * 100) : 0,
        color: stage.color,
      };
    });

  const recentApps = [...applications]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 6)
    .map((application) => ({
      id: application.id,
      candidateName: application.candidateName,
      candidateEmail: application.candidateEmail,
      jobTitle: application.jobTitle,
      departmentName: application.departmentName ?? "",
      stage: application.stage,
      fitScore: application.fitScore,
      createdAt: application.createdAt,
    }));

  return {
    activeJobsCount: jobs.length,
    candidatesCount: candidates.length,
    upcomingInterviewsCount: upcoming.length,
    hiredCount: applications.filter((application) => application.status === "hired").length,
    totalApps,
    pipelineStages,
    recentApps,
    upcomingInterviews: upcoming.slice(0, 6).map((interview) => ({
      id: interview.id,
      roundTitle: interview.roundTitle,
      scheduledStart: interview.scheduledStart,
      durationMinutes: interview.durationMinutes,
      meetingLink: interview.meetingLink,
      status: interview.status,
      candidateName: interview.candidateName,
      jobTitle: interview.jobTitle,
    })),
  };
}
