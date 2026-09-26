"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TableShell,
  Table,
  THead,
  TH,
  SortableTH,
  TBody,
  TR,
  TD,
  EmptyRow,
  ClientPagination,
} from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatTile, StatGrid } from "@/components/shared/stat-tile";
import { cn } from "@/lib/utils";
import {
  Clock,
  Plus,
  Video,
  Star,
  CheckCircle2,
  XCircle,
  FileCheck,
  Loader2,
  Calendar,
  Eye,
  Award,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { getInterviews, submitScorecard, updateInterviewStatus } from "@/features/interviews/server/actions";
import { Can } from "@/components/rbac/can";
import { toast } from "sonner";

function InterviewsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");

  const normalizeView = (v: string | null): string => {
    if (!v || v === "all") return "all";
    if (v === "upcoming") return "upcoming";
    if (v === "completed") return "completed";
    if (v === "cancelled") return "cancelled";
    return "all";
  };

  const [activeView, setActiveView] = useState(normalizeView(viewParam));
  const [interviewsList, setInterviewsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting & Client Pagination
  const [sortField, setSortField] = useState<string>("scheduledStart");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Scorecard modal state
  const [activeScorecardInterview, setActiveScorecardInterview] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [recommendation, setRecommendation] = useState<"strong_hire" | "hire" | "no_hire" | "strong_no_hire">("strong_hire");
  const [techScore, setTechScore] = useState(5);
  const [cultureScore, setCultureScore] = useState(5);
  const [commScore, setCommScore] = useState(5);
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmittingScorecard, setIsSubmittingScorecard] = useState(false);

  // View scorecard modal
  const [viewScorecardInterview, setViewScorecardInterview] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getInterviews({
        status: activeView === "upcoming" ? "scheduled" : activeView === "completed" ? "completed" : activeView === "cancelled" ? "cancelled" : undefined,
      });
      setInterviewsList(data);
      setPage(1);
    } catch (err) {
      console.error("Failed to load interviews:", err);
      toast.error("Failed to load interviews");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActiveView(normalizeView(viewParam));
  }, [viewParam]);

  useEffect(() => {
    loadData();
  }, [activeView]);

  const handleViewChange = (newView: string) => {
    setActiveView(newView);
    const targetUrl = newView === "all" ? "/interviews" : `/interviews?view=${newView}`;
    router.replace(targetUrl);
  };

  const handleOpenScorecard = (intv: any) => {
    setActiveScorecardInterview(intv);
    setRating(5);
    setRecommendation("strong_hire");
    setTechScore(5);
    setCultureScore(5);
    setCommScore(5);
    setStrengths("Clear architectural thinking, strong concurrency fundamentals.");
    setConcerns("None noted.");
    setNotes("Excellent panel interaction.");
  };

  const handleSubmitScorecard = async () => {
    if (!activeScorecardInterview) return;
    setIsSubmittingScorecard(true);
    try {
      await submitScorecard({
        interviewId: activeScorecardInterview.id,
        overallRating: rating,
        recommendation,
        technicalScore: techScore,
        cultureScore,
        communicationScore: commScore,
        strengths,
        concerns,
        feedbackNotes: notes,
      });
      toast.success("Scorecard and feedback submitted successfully!");
      setActiveScorecardInterview(null);
      await loadData();
    } catch {
      toast.error("Failed to submit scorecard");
    } finally {
      setIsSubmittingScorecard(false);
    }
  };

  const handleCancelInterview = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this interview?")) return;
    try {
      await updateInterviewStatus(id, "cancelled");
      toast.success("Interview marked as cancelled");
      await loadData();
    } catch {
      toast.error("Failed to cancel interview");
    }
  };

  const scheduledCount = interviewsList.filter((i) => i.status === "scheduled").length;
  const completedCount = interviewsList.filter((i) => i.status === "completed").length;

  const handleSort = (field: string, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Processed sorted & paginated interviews
  const sortedInterviews = useMemo(() => {
    return [...interviewsList].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (typeof aVal === "string") {
        aVal = aVal.toLowerCase();
        bVal = (bVal || "").toLowerCase();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [interviewsList, sortField, sortDirection]);

  const paginatedInterviews = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedInterviews.slice(from, from + pageSize);
  }, [sortedInterviews, page, pageSize]);

  return (
    <div className="page space-y-4">
      <PageHeader
        title="Interview Scheduling &amp; Scorecards"
        description="Manage panel interview rounds, structured scorecards, candidate availability, and hiring recommendations."
        actions={
          <Can permission="interviews.create">
            <Link href="/interviews/schedule">
              <Button size="sm" variant="accent" className="gap-1 text-xs">
                <Plus className="size-3.5" />
                <span>Schedule Interview</span>
              </Button>
            </Link>
          </Can>
        }
      />

      <StatGrid>
        <StatTile
          label="Scheduled Rounds"
          value={String(scheduledCount)}
          sublabel="Pending evaluation"
          icon="Clock"
          tone="accent"
        />
        <StatTile
          label="Completed Evaluations"
          value={String(completedCount)}
          sublabel="Scorecards recorded"
          icon="CheckCircle"
          tone="success"
        />
        <StatTile
          label="Avg Panel Rating"
          value="4.8 / 5.0"
          sublabel="Top-tier candidate pool"
          icon="Star"
          tone="warning"
        />
      </StatGrid>

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border w-fit overflow-x-auto">
        {[
          { id: "all", label: "All Rounds" },
          { id: "upcoming", label: "Upcoming" },
          { id: "completed", label: "Completed & Evaluated" },
          { id: "cancelled", label: "Cancelled" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleViewChange(tab.id)}
            className={cn(
              "text-xs py-2 px-1 font-medium transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer",
              activeView === tab.id
                ? "border-copper text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* StoqBook TableShell */}
      <TableShell>
        <Table>
          <THead>
            <SortableTH
              field="candidateName"
              currentSort={sortField === "candidateName" ? (sortDirection === "asc" ? "candidateName" : "-candidateName") : ""}
              onSort={handleSort}
            >
              Candidate &amp; Position
            </SortableTH>
            <TH>Interview Round</TH>
            <SortableTH
              field="scheduledStart"
              currentSort={sortField === "scheduledStart" ? (sortDirection === "asc" ? "scheduledStart" : "-scheduledStart") : ""}
              onSort={handleSort}
            >
              Scheduled Time
            </SortableTH>
            <TH>Meeting Format</TH>
            <TH>Scorecard Status</TH>
            <TH>Status</TH>
            <TH align="right">Actions</TH>
          </THead>
          <TBody>
            {loading ? (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <Loader2 className="size-5 animate-spin text-copper" />
                  <span className="text-xs text-muted-foreground">Loading scheduled interviews...</span>
                </div>
              </EmptyRow>
            ) : paginatedInterviews.length === 0 ? (
              <EmptyRow colSpan={7}>
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No interview rounds found in this view.</p>
                  <Can permission="interviews.create">
                    <Link href="/interviews/schedule">
                      <Button size="xs" variant="outline" className="gap-1 text-xs">
                        <Plus className="size-3" />
                        <span>Schedule First Round</span>
                      </Button>
                    </Link>
                  </Can>
                </div>
              </EmptyRow>
            ) : (
              paginatedInterviews.map((intv) => (
                <TR key={intv.id}>
                  {/* Candidate & Position */}
                  <TD>
                    <div>
                      <span className="font-semibold text-foreground text-xs block">
                        {intv.candidateName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {intv.jobTitle}
                      </span>
                    </div>
                  </TD>

                  {/* Interview Round */}
                  <TD>
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground text-xs">
                        {intv.roundTitle}
                      </div>
                      <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                        {intv.roundType} ({intv.durationMinutes} min)
                      </Badge>
                    </div>
                  </TD>

                  {/* Scheduled Time */}
                  <TD>
                    <div className="text-xs text-foreground font-medium flex items-center gap-1">
                      <Clock className="size-3 text-copper shrink-0" />
                      <span>{new Date(intv.scheduledStart).toLocaleDateString()}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(intv.scheduledStart).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </TD>

                  {/* Meeting Format */}
                  <TD>
                    {intv.meetingLink ? (
                      <a
                        href={intv.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-muted hover:bg-copper/20 hover:text-copper transition-colors text-[11px] text-foreground font-medium"
                      >
                        <Video className="size-3 text-copper shrink-0" />
                        <span>Join Session</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground text-[11px] capitalize">
                        {intv.format}
                      </span>
                    )}
                  </TD>

                  {/* Scorecard Status */}
                  <TD>
                    {intv.scorecards && intv.scorecards.length > 0 ? (
                      <button
                        onClick={() => setViewScorecardInterview(intv)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:underline cursor-pointer"
                      >
                        <CheckCircle2 className="size-3 shrink-0" />
                        <span>{intv.scorecards[0].recommendation.replace("_", " ").toUpperCase()} ({intv.scorecards[0].overallRating}/5)</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Pending Evaluation
                      </span>
                    )}
                  </TD>

                  {/* Status */}
                  <TD>
                    <StatusBadge status={intv.status} />
                  </TD>

                  {/* Actions */}
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      {intv.scorecards && intv.scorecards.length > 0 ? (
                        <Can permission="interviews.view_scorecards">
                          <Button
                            size="xs"
                            variant="ghost"
                            title="View Scorecard"
                            onClick={() => setViewScorecardInterview(intv)}
                            className="h-7 px-2 text-xs gap-1 text-foreground hover:text-copper"
                          >
                            <Eye className="size-3.5" />
                            <span>Scorecard</span>
                          </Button>
                        </Can>
                      ) : (
                        <Can permission="interviews.submit_scorecard">
                          <Button
                            size="xs"
                            variant="accent"
                            title="Submit Scorecard"
                            onClick={() => handleOpenScorecard(intv)}
                            className="h-7 px-2 text-xs gap-1"
                          >
                            <Star className="size-3" />
                            <span>Evaluate</span>
                          </Button>
                        </Can>
                      )}

                      {intv.status === "scheduled" && (
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Cancel Round"
                          onClick={() => handleCancelInterview(intv.id)}
                          className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        >
                          <XCircle className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))
            )}
          </TBody>
        </Table>

        {/* StoqBook ClientPagination */}
        <ClientPagination
          page={page}
          limit={pageSize}
          total={interviewsList.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          limitOptions={[10, 25, 50, 100]}
        />
      </TableShell>

      {/* Submit Scorecard Modal */}
      <Dialog
        open={!!activeScorecardInterview}
        onOpenChange={(open) => !open && setActiveScorecardInterview(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Submit Scorecard: {activeScorecardInterview?.candidateName}
            </DialogTitle>
            <div className="text-xs text-muted-foreground">
              Round: {activeScorecardInterview?.roundTitle} • {activeScorecardInterview?.jobTitle}
            </div>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="field-label">Overall Rating (1 - 5 Stars)</label>
                <select
                  value={rating}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRating(Number(e.target.value))}
                  className="w-full h-8 px-2 text-xs rounded-xs border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-copper"
                >
                  <option value={5}>5 - Outstanding (Exceeds Bar)</option>
                  <option value={4}>4 - Strong Hire</option>
                  <option value={3}>3 - Neutral / Leaning Hire</option>
                  <option value={2}>2 - Leaning No Hire</option>
                  <option value={1}>1 - Strong No Hire</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="field-label">Recommendation</label>
                <select
                  value={recommendation}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setRecommendation(e.target.value as any)}
                  className="w-full h-8 px-2 text-xs rounded-xs border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-copper"
                >
                  <option value="strong_hire">Strong Hire</option>
                  <option value="hire">Hire</option>
                  <option value="no_hire">No Hire</option>
                  <option value="strong_no_hire">Strong No Hire</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="field-label">Technical (1-5)</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={techScore}
                  onChange={(e) => setTechScore(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Culture (1-5)</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={cultureScore}
                  onChange={(e) => setCultureScore(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Comm (1-5)</label>
                <Input
                  type="number"
                  min="1"
                  max="5"
                  value={commScore}
                  onChange={(e) => setCommScore(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="field-label">Key Strengths</label>
              <textarea
                rows={2}
                value={strengths}
                onChange={(e) => setStrengths(e.target.value)}
                placeholder="Observed exceptional abilities..."
                className="w-full rounded-xs border border-border bg-card p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-copper"
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">Key Concerns</label>
              <textarea
                rows={2}
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="Gaps or potential growth areas..."
                className="w-full rounded-xs border border-border bg-card p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-copper"
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">Detailed Notes &amp; Evidence</label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Panel conversation observations..."
                className="w-full rounded-xs border border-border bg-card p-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-copper"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              size="xs"
              variant="outline"
              onClick={() => setActiveScorecardInterview(null)}
            >
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isSubmittingScorecard}
              onClick={handleSubmitScorecard}
              className="gap-1"
            >
              {isSubmittingScorecard ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Submit Evaluation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Scorecard Modal */}
      <Dialog
        open={!!viewScorecardInterview}
        onOpenChange={(open) => !open && setViewScorecardInterview(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <Award className="size-4 text-copper" />
              <span>Scorecard Record: {viewScorecardInterview?.candidateName}</span>
            </DialogTitle>
            <div className="text-xs text-muted-foreground">
              Round: {viewScorecardInterview?.roundTitle} • Evaluator: {viewScorecardInterview?.scorecards?.[0]?.interviewerName || "Panel"}
            </div>
          </DialogHeader>

          {viewScorecardInterview?.scorecards?.[0] && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xs border border-border flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Recommendation
                  </div>
                  <div className="font-bold text-sm uppercase text-copper">
                    {viewScorecardInterview.scorecards[0].recommendation.replace("_", " ")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Overall Rating
                  </div>
                  <div className="font-bold text-foreground text-sm">
                    {viewScorecardInterview.scorecards[0].overallRating} / 5.0 ★
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 border border-border rounded-xs">
                  <div className="text-[10px] text-muted-foreground">Technical</div>
                  <div className="font-semibold text-foreground text-xs">
                    {viewScorecardInterview.scorecards[0].technicalScore || "—"} / 5
                  </div>
                </div>
                <div className="p-2 border border-border rounded-xs">
                  <div className="text-[10px] text-muted-foreground">Culture Fit</div>
                  <div className="font-semibold text-foreground text-xs">
                    {viewScorecardInterview.scorecards[0].cultureScore || "—"} / 5
                  </div>
                </div>
                <div className="p-2 border border-border rounded-xs">
                  <div className="text-[10px] text-muted-foreground">Communication</div>
                  <div className="font-semibold text-foreground text-xs">
                    {viewScorecardInterview.scorecards[0].communicationScore || "—"} / 5
                  </div>
                </div>
              </div>

              {viewScorecardInterview.scorecards[0].strengths && (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">Demonstrated Strengths</div>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded-xs border border-border">
                    {viewScorecardInterview.scorecards[0].strengths}
                  </p>
                </div>
              )}

              {viewScorecardInterview.scorecards[0].concerns && (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">Identified Concerns</div>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded-xs border border-border">
                    {viewScorecardInterview.scorecards[0].concerns}
                  </p>
                </div>
              )}

              {viewScorecardInterview.scorecards[0].feedbackNotes && (
                <div className="space-y-1">
                  <div className="font-medium text-foreground">Feedback Notes</div>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded-xs border border-border">
                    {viewScorecardInterview.scorecards[0].feedbackNotes}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setViewScorecardInterview(null)}>
              Close Scorecard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function InterviewsPage() {
  return (
    <Suspense
      fallback={
        <div className="page flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-copper" />
        </div>
      }
    >
      <InterviewsContent />
    </Suspense>
  );
}
