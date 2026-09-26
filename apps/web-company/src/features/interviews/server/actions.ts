"use server";

import { revalidatePath } from "next/cache";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * Interview scheduling and scorecards, served by the interviews service.
 *
 * The two scorecard permissions are not interchangeable and this module does not
 * try to smooth that over. `interviews.submit_scorecard` is the right to file
 * your own verdict and read it back; `interviews.view_scorecards` is the right
 * to read the panel's. The service decides which you get, and it also reports a
 * total that matches what it returned — so a narrow reader cannot infer how many
 * colleagues have already filed. A panel that reads each other first produces
 * one opinion with four signatures on it.
 */

export interface ScheduleInterviewInput {
  applicationId: string;
  candidateId: string;
  roundTitle: string;
  roundType?: string;
  scheduledStart: Date | string;
  durationMinutes?: number;
  format?: string;
  meetingLink?: string;
  panelMemberIds?: string[];
  notes?: string;
}

export interface ScorecardInput {
  interviewId: string;
  overallRating: number;
  recommendation: "strong_hire" | "hire" | "no_hire" | "strong_no_hire";
  technicalScore?: number;
  communicationScore?: number;
  cultureScore?: number;
  strengths?: string;
  concerns?: string;
  feedbackNotes?: string;
}

export interface InterviewRow {
  id: string;
  applicationId: string;
  candidateId: string | null;
  candidateName: string | null;
  jobTitle: string | null;
  scheduledStart: Date | null;
  roundTitle: string;
  roundType: string | null;
  durationMinutes: number | null;
  format: string | null;
  meetingLink: string | null;
  status: string;
  notes: string | null;
  hasScorecard: boolean;
  panelMemberIds: string[];
}

export interface ScorecardRow {
  id: string;
  interviewId: string;
  authorId: string;
  overallRating: number;
  recommendation: string;
  technicalScore: number | null;
  communicationScore: number | null;
  cultureScore: number | null;
  strengths: string | null;
  concerns: string | null;
  feedbackNotes: string | null;
  createdAt: Date;
}

/** What the interviews service returns. */
interface PlatformInterview {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  jobTitle: string;
  roundTitle: string;
  roundType: string;
  scheduledStart: string | null;
  durationMinutes: number | null;
  format: string | null;
  meetingLink?: string;
  notes?: string;
  status: string;
  panelMemberIds: string[];
  hasScorecard: boolean;
}

interface PlatformScorecard {
  id: string;
  interviewId: string;
  authorId: string;
  overallRating: number;
  recommendation: string;
  technicalScore?: number;
  communicationScore?: number;
  cultureScore?: number;
  strengths?: string;
  concerns?: string;
  feedbackNotes?: string;
  createdAt: string;
}

// The service omits an unknown name rather than sending null, and the screens
// type these as `string | null` so an absent one renders a placeholder instead
// of an empty cell.
const orNull = (value: string | undefined | null): string | null => value || null;

function toInterviewRow(interview: PlatformInterview): InterviewRow {
  return {
    id: interview.id,
    applicationId: interview.applicationId,
    candidateId: orNull(interview.candidateId),
    candidateName: orNull(interview.candidateName),
    jobTitle: orNull(interview.jobTitle),
    scheduledStart: interview.scheduledStart ? new Date(interview.scheduledStart) : null,
    roundTitle: interview.roundTitle,
    roundType: orNull(interview.roundType),
    durationMinutes: interview.durationMinutes,
    format: interview.format,
    meetingLink: orNull(interview.meetingLink),
    status: interview.status,
    notes: orNull(interview.notes),
    hasScorecard: interview.hasScorecard,
    panelMemberIds: interview.panelMemberIds ?? [],
  };
}

function toScorecardRow(card: PlatformScorecard): ScorecardRow {
  return {
    id: card.id,
    interviewId: card.interviewId,
    authorId: card.authorId,
    overallRating: card.overallRating,
    recommendation: card.recommendation,
    technicalScore: card.technicalScore ?? null,
    communicationScore: card.communicationScore ?? null,
    cultureScore: card.cultureScore ?? null,
    strengths: orNull(card.strengths),
    concerns: orNull(card.concerns),
    feedbackNotes: orNull(card.feedbackNotes),
    createdAt: new Date(card.createdAt),
  };
}

export async function getInterviews(params?: {
  status?: string;
  applicationId?: string;
  candidateId?: string;
}): Promise<InterviewRow[]> {
  await requirePermission("interviews.read");

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/interviews", {
      query: {
        limit: 100,
        ...(params?.status && params.status !== "all" ? { status: params.status } : {}),
        ...(params?.applicationId ? { applicationId: params.applicationId } : {}),
        ...(params?.candidateId ? { candidateId: params.candidateId } : {}),
      },
    });
    return unwrap<PlatformInterview>(payload, "interviews").map(toInterviewRow);
  }, []);
}

/**
 * The feedback on one round that this actor may read.
 *
 * `partial` is the service saying "you are seeing your own card, not the
 * panel's". The screen shows it rather than implying the panel said nothing,
 * which is what a bare empty-looking list would do.
 */
export async function getScorecards(
  interviewId: string,
): Promise<{ scorecards: ScorecardRow[]; total: number; partial: boolean }> {
  await requirePermission("interviews.read");

  return gatewayRead(
    async () => {
      const payload = await gatewayFetch<{
        scorecards?: PlatformScorecard[];
        total?: number;
        partial?: boolean;
      }>(`/api/v1/interviews/${encodeURIComponent(interviewId)}/scorecards`);

      return {
        scorecards: (payload.scorecards ?? []).map(toScorecardRow),
        total: payload.total ?? 0,
        partial: Boolean(payload.partial),
      };
    },
    { scorecards: [], total: 0, partial: false },
  );
}

function revalidateInterviews() {
  revalidatePath("/interviews");
  revalidatePath("/dashboard");
}

export async function scheduleInterview(data: ScheduleInterviewInput) {
  await requirePermission("interviews.create");

  const interview = await gatewayFetch<PlatformInterview>("/api/v1/interviews", {
    method: "POST",
    body: {
      applicationId: data.applicationId,
      candidateId: data.candidateId,
      roundTitle: data.roundTitle,
      ...(data.roundType ? { roundType: data.roundType } : {}),
      scheduledStart:
        data.scheduledStart instanceof Date
          ? data.scheduledStart.toISOString()
          : new Date(data.scheduledStart).toISOString(),
      ...(data.durationMinutes ? { durationMinutes: data.durationMinutes } : {}),
      ...(data.format ? { format: data.format } : {}),
      ...(data.meetingLink ? { meetingLink: data.meetingLink } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
      panelMemberIds: data.panelMemberIds ?? [],
    },
  });

  revalidateInterviews();
  return { success: true as const, interview: toInterviewRow(interview) };
}

/**
 * Moving a round to its next state.
 *
 * Cancelling and completing are their own endpoints rather than a status field,
 * because each records something the other does not — a reason, an outcome — and
 * because the service refuses an illegal transition with a 409 that names what
 * it refused.
 */
export async function updateInterviewStatus(id: string, status: string, note?: string) {
  await requirePermission("interviews.update");

  const path = `/api/v1/interviews/${encodeURIComponent(id)}`;
  if (status === "cancelled") {
    await gatewayFetch(`${path}/cancel`, { method: "POST", body: { reason: note ?? "" } });
  } else if (status === "completed") {
    await gatewayFetch(`${path}/complete`, { method: "POST", body: { note: note ?? "" } });
  } else {
    await gatewayFetch(path, { method: "PATCH", body: { status } });
  }

  revalidateInterviews();
  return { success: true as const };
}

export async function deleteInterview(id: string) {
  await requirePermission("interviews.delete");

  await gatewayFetch(`/api/v1/interviews/${encodeURIComponent(id)}`, { method: "DELETE" });

  revalidateInterviews();
  return { success: true as const };
}

export async function submitScorecard(data: ScorecardInput) {
  await requirePermission("interviews.submit_scorecard");

  const card = await gatewayFetch<PlatformScorecard>(
    `/api/v1/interviews/${encodeURIComponent(data.interviewId)}/scorecard`,
    {
      method: "POST",
      body: {
        overallRating: data.overallRating,
        recommendation: data.recommendation,
        ...(data.technicalScore !== undefined ? { technicalScore: data.technicalScore } : {}),
        ...(data.communicationScore !== undefined
          ? { communicationScore: data.communicationScore }
          : {}),
        ...(data.cultureScore !== undefined ? { cultureScore: data.cultureScore } : {}),
        ...(data.strengths ? { strengths: data.strengths } : {}),
        ...(data.concerns ? { concerns: data.concerns } : {}),
        ...(data.feedbackNotes ? { feedbackNotes: data.feedbackNotes } : {}),
      },
    },
  );

  revalidateInterviews();
  return { success: true as const, scorecard: toScorecardRow(card) };
}
