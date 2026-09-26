"use server";

import { getApplications, getPipelineStages } from "@/features/applications/server/actions";
import { getInterviews } from "@/features/interviews/server/actions";
import { getJobs } from "@/features/jobs/server/actions";
import { getOffers } from "@/features/offers/server/actions";
import { gatewayRead } from "@/lib/gateway/client";
import { requireAuth } from "@/lib/rbac/guard";

export interface NavigationBadgeCounts {
  openJobs: number;
  activeApplications: number;
  screeningCount: number;
  interviewsToday: number;
  pendingFeedback: number;
  draftOffers: number;
  pendingOffers: number;
  [key: string]: number;
}

const EMPTY: NavigationBadgeCounts = {
  openJobs: 0,
  activeApplications: 0,
  screeningCount: 0,
  interviewsToday: 0,
  pendingFeedback: 0,
  draftOffers: 0,
  pendingOffers: 0,
};

/**
 * Sidebar badge counts.
 *
 * Each counter is only computed when the actor can read the module it belongs
 * to, so a badge never leaks the size of a pipeline the user cannot open.
 *
 * Every counter is real. A zero still renders as no badge, which is the right
 * answer for an empty module — but it now means "nothing there" rather than
 * "nothing serves this".
 */
export async function getNavigationBadgeCounts(): Promise<NavigationBadgeCounts> {
  const { access } = await requireAuth();

  // A badge is decoration. When a count fails the sidebar still has to render,
  // so gatewayRead returns the fallback rather than taking every page down for
  // a number nobody navigates by.
  const canReadApplications = access.can("applications.read");
  const canReadInterviews = access.can("interviews.read");
  const canReadOffers = access.can("offers.read");

  const [jobs, applications, stages, interviews, offers] = await Promise.all([
    access.can("jobs.read")
      ? gatewayRead(() => getJobs({ status: "open" }), [])
      : Promise.resolve([]),
    canReadApplications ? gatewayRead(() => getApplications(), []) : Promise.resolve([]),
    canReadApplications ? gatewayRead(() => getPipelineStages(), []) : Promise.resolve([]),
    canReadInterviews ? gatewayRead(() => getInterviews(), []) : Promise.resolve([]),
    canReadOffers ? gatewayRead(() => getOffers(), []) : Promise.resolve([]),
  ]);

  const active = applications.filter((application) => application.status === "active");

  // "Screening" is whichever stage the company put second, read from their own
  // pipeline rather than assumed. A tenant is free to rename or reorder every
  // stage, so a hard-coded key would be wrong for most of them.
  const screeningStage = [...stages].sort((a, b) => a.order - b.order)[1];

  // Today in the viewer's own timezone, which is the only sense in which a
  // recruiter means "today" when they glance at a sidebar.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const scheduled = interviews.filter((interview) => interview.status === "scheduled");

  return {
    ...EMPTY,
    openJobs: jobs.length,
    activeApplications: active.length,
    screeningCount: screeningStage
      ? active.filter((application) => application.stageId === screeningStage.id).length
      : 0,
    interviewsToday: scheduled.filter((interview) => {
      const at = interview.scheduledStart;
      return at !== null && at >= startOfDay && at < endOfDay;
    }).length,
    // A round that has happened and has no verdict on it yet. This is the badge
    // that actually moves a hiring decision along, which is why it counts
    // completed-without-a-scorecard rather than everything completed.
    pendingFeedback: interviews.filter(
      (interview) => interview.status === "completed" && !interview.hasScorecard,
    ).length,
    draftOffers: offers.filter((offer) => offer.status === "draft").length,
    pendingOffers: offers.filter((offer) => offer.status === "pending_approval").length,
  };
}
