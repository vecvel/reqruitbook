"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { StatTile, StatGrid } from "@/components/shared/stat-tile";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Briefcase,
  Users,
  Calendar,
  UserCheck,
  Plus,
  ArrowUpRight,
  Clock,
  Layers,
  Share2,
  ChevronRight,
  Loader2,
  Video,
} from "lucide-react";
import { getDashboardMetrics } from "@/features/dashboard/server/actions";
import { updateApplicationStage, type ApplicationStage } from "@/features/applications/server/actions";
import { Can } from "@/components/rbac/can";
import { toast } from "sonner";

export function DashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [advancingId, setAdvancingId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to load dashboard metrics:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStageAdvance = async (appId: string, currentStage: string) => {
    const nextStageMap: Record<string, ApplicationStage> = {
      applied: "screening",
      screening: "shortlisted",
      shortlisted: "interview",
      interview: "evaluation",
      evaluation: "selected",
      selected: "offer",
      offer: "hired",
    };

    const nextStage = nextStageMap[currentStage] || "screening";
    setAdvancingId(appId);
    try {
      await updateApplicationStage(appId, nextStage);
      toast.success(`Candidate advanced to ${nextStage.toUpperCase()}`);
      await loadData();
    } catch {
      toast.error("Failed to advance candidate stage");
    } finally {
      setAdvancingId(null);
    }
  };

  const pipelineStages = metrics?.pipelineStages || [
    { name: "Applied", count: 0, percentage: 0, color: "bg-bark-muted" },
    { name: "Screening", count: 0, percentage: 0, color: "bg-copper-deep" },
    { name: "Shortlisted", count: 0, percentage: 0, color: "bg-copper" },
    { name: "Interviewing", count: 0, percentage: 0, color: "bg-sage-deep" },
    { name: "Evaluation", count: 0, percentage: 0, color: "bg-sage" },
    { name: "Selected", count: 0, percentage: 0, color: "bg-bark" },
    { name: "Offer Stage", count: 0, percentage: 0, color: "bg-accent" },
    { name: "Hired (HRM)", count: 0, percentage: 0, color: "bg-success" },
  ];

  return (
    <div className="page">
      <PageHeader
        title="Recruitment Operations"
        description="Real-time talent acquisition pipeline, active job requisitions, and scheduled panel scorecards."
        actions={
          <div className="flex items-center gap-2">
            <Can permission="jobs.create">
              <Link href="/jobs/new">
                <Button size="sm" variant="accent" className="gap-1 text-xs">
                  <Plus className="size-3.5" />
                  <span>Create Requisition</span>
                </Button>
              </Link>
            </Can>
            <Can permission="interviews.create">
              <Link href="/interviews/schedule">
                <Button size="sm" variant="outline" className="gap-1 text-xs">
                  <Calendar className="size-3.5" />
                  <span>Schedule Interview</span>
                </Button>
              </Link>
            </Can>
          </div>
        }
      />

      {/* Primary Metrics Grid */}
      <StatGrid>
        <StatTile
          label="Active Requisitions"
          value={loading ? "..." : String(metrics?.activeJobsCount || 0)}
          sublabel="+2 new this week"
          icon="Briefcase"
          tone="accent"
        />
        <StatTile
          label="Total Candidates"
          value={loading ? "..." : String(metrics?.candidatesCount || 0)}
          sublabel="Active talent pool"
          icon="Users"
          tone="neutral"
        />
        <StatTile
          label="Upcoming Interviews"
          value={loading ? "..." : String(metrics?.upcomingInterviewsCount || 0)}
          sublabel="Next 7 days"
          icon="Calendar"
          tone="warning"
        />
        <StatTile
          label="Hired / HRM Synced"
          value={loading ? "..." : String(metrics?.hiredCount || 0)}
          sublabel="Offers accepted"
          icon="UserCheck"
          tone="success"
        />
      </StatGrid>

      {/* 8-Stage ATS Pipeline Progression Bar */}
      <Card className="shadow-none">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>Unified Hiring Pipeline Funnel</span>
                <Badge variant="outline" className="text-[10px] font-normal">
                  8 ATS Stages
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Distribution of {metrics?.totalApps || 0} active candidate applications across stages
              </CardDescription>
            </div>
            <Link
              href="/applications"
              className="text-xs text-copper hover:text-copper-deep font-medium flex items-center gap-0.5"
            >
              <span>View Full ATS Kanban</span>
              <ChevronRight className="size-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress Segment Bar */}
          <div className="flex h-3 w-full rounded-xs overflow-hidden bg-muted/60 p-0.5 gap-0.5">
            {pipelineStages.map((stage: any) => (
              <div
                key={stage.name}
                className={`h-full rounded-xs transition-all ${stage.color}`}
                style={{ width: `${Math.max(stage.percentage, 4)}%` }}
                title={`${stage.name}: ${stage.count} candidates (${stage.percentage}%)`}
              />
            ))}
          </div>

          {/* Stage Count Pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 pt-1">
            {pipelineStages.map((stage: any) => (
              <div
                key={stage.name}
                className="p-2 rounded-xs border border-border/80 bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-muted-foreground truncate">
                    {stage.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground/80">
                    {stage.percentage}%
                  </span>
                </div>
                <div className="text-base font-semibold text-foreground mt-0.5">
                  {stage.count}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Two Column Section: Recent Applications & Live Interviews / HRM Bridge */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Live Candidate Applications */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">
                    Recent Candidate Applications
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Latest submissions ready for review and panel assignment
                  </CardDescription>
                </div>
                <Link href="/applications">
                  <Button variant="ghost" size="xs" className="gap-1 text-xs">
                    <span>All Applications</span>
                    <ArrowUpRight className="size-3" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  <span>Loading live applications...</span>
                </div>
              ) : !metrics?.recentApps || metrics.recentApps.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No active candidate applications found. Create a requisition to start hiring!
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead>Candidate</TableHead>
                      <TableHead>Target Position</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Fit Score</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.recentApps.map((app: any) => (
                      <TableRow key={app.id} className="text-xs">
                        <TableCell className="font-medium">
                          <div>
                            <span className="font-semibold text-foreground block">
                              {app.candidateName}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {app.candidateEmail}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-foreground font-medium">
                            {app.jobTitle}
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {app.departmentName}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={app.stage} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {app.fitScore}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleStageAdvance(app.id, app.stage)}
                            disabled={advancingId === app.id || app.stage === "hired"}
                            className="text-[11px] h-6 px-2"
                          >
                            {advancingId === app.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              "Advance Stage"
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Upcoming Panel Interviews */}
        <div className="space-y-5">
          {/* Upcoming Interviews Widget */}
          <Card className="shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <Calendar className="size-4 text-copper" />
                  <span>Scheduled Interviews</span>
                </CardTitle>
                <Link
                  href="/interviews"
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  View All
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {!metrics?.upcomingInterviews || metrics.upcomingInterviews.length === 0 ? (
                <div className="text-xs text-muted-foreground py-4 text-center">
                  No upcoming interviews scheduled.
                </div>
              ) : (
                metrics.upcomingInterviews.map((intv: any) => (
                  <div
                    key={intv.id}
                    className="p-2.5 rounded-xs border border-border bg-card flex items-start justify-between gap-2"
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-foreground">
                        {intv.candidateName}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {intv.roundTitle} • {intv.jobTitle}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1">
                        <Clock className="size-3 text-copper" />
                        <span>
                          {new Date(intv.scheduledStart).toLocaleDateString()} at{" "}
                          {new Date(intv.scheduledStart).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    {intv.meetingLink && (
                      <a
                        href={intv.meetingLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1 rounded-xs bg-muted hover:bg-copper/20 hover:text-copper transition-colors"
                        title="Join Meeting"
                      >
                        <Video className="size-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
