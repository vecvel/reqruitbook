"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  CalendarDays,
  Clock,
  Video,
  Users,
  CheckCircle2,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getApplications } from "@/features/applications/server/actions";
import { scheduleInterview } from "@/features/interviews/server/actions";
import {
  getInterviewTypes,
} from "@/features/masters/server/actions";

function ScheduleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramCandidateId = searchParams.get("candidateId");
  const paramApplicationId = searchParams.get("applicationId");

  const [applications, setApplications] = useState<any[]>([]);
  const [interviewTypesList, setInterviewTypesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [selectedAppId, setSelectedAppId] = useState(paramApplicationId || "");
  const [roundTitle, setRoundTitle] = useState("Technical System Architecture");
  const [roundType, setRoundType] = useState("technical");
  const [date, setDate] = useState("2026-08-20");
  const [time, setTime] = useState("10:30");
  const [duration, setDuration] = useState("60");
  const [format, setFormat] = useState("video");
  const [meetingLink, setMeetingLink] = useState("https://meet.google.com/xyz-rec-int");
  const [notes, setNotes] = useState("Please have your development environment ready.");

  useEffect(() => {
    async function loadApps() {
      try {
        const [apps, types] = await Promise.all([
          getApplications(),
          getInterviewTypes(),
        ]);
        setApplications(apps);
        setInterviewTypesList(types);
        if (types[0]) {
          setRoundType(types[0].slug);
          if (types[0].defaultDurationMinutes) setDuration(String(types[0].defaultDurationMinutes));
        }
        if (paramApplicationId) {
          setSelectedAppId(paramApplicationId);
        } else if (paramCandidateId) {
          const match = apps.find((a) => a.candidateId === paramCandidateId);
          if (match) setSelectedAppId(match.id);
        } else if (apps[0]) {
          setSelectedAppId(apps[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadApps();
  }, [paramApplicationId, paramCandidateId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppId) {
      toast.error("Please select a candidate application");
      return;
    }

    const app = applications.find((a) => a.id === selectedAppId);
    if (!app) {
      toast.error("Application not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const scheduledDateTime = new Date(`${date}T${time}:00`);

      await scheduleInterview({
        applicationId: app.id,
        candidateId: app.candidateId,
        roundTitle,
        roundType,
        scheduledStart: scheduledDateTime,
        durationMinutes: parseInt(duration) || 60,
        format,
        meetingLink,
        notes,
      });

      toast.success(`Interview scheduled for ${app.candidateName}! Invites recorded.`);
      router.push("/interviews");
    } catch (err: any) {
      toast.error(err.message || "Failed to schedule interview");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page max-w-3xl">
      <PageHeader
        title="Schedule Interview Round"
        description="Book panel interview session, candidate invitation link, and evaluation criteria scorecard."
        breadcrumbs={[
          { label: "Interviews", href: "/interviews" },
          { label: "Schedule Round" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/interviews">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <ArrowLeft className="size-3.5" />
                <span>Cancel</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="accent"
              disabled={isSubmitting || loading}
              onClick={handleSubmit}
              className="gap-1 text-xs"
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              <span>Confirm &amp; Send Invites</span>
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">1. Interview Parameters</CardTitle>
            <CardDescription className="text-xs">
              Candidate, interview stage, panel members, and format
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Candidate &amp; Application *</label>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {applications.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.candidateName} — {a.jobTitle} ({a.stage.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Interview Round / Topic *</label>
                <Input
                  value={roundTitle}
                  onChange={(e) => setRoundTitle(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Round Type</label>
                <select
                  value={roundType}
                  onChange={(e) => {
                    setRoundType(e.target.value);
                    const match = interviewTypesList.find((t) => t.slug === e.target.value);
                    if (match && match.defaultDurationMinutes) {
                      setDuration(String(match.defaultDurationMinutes));
                    }
                  }}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {interviewTypesList.length === 0 ? (
                    <>
                      <option value="screening">Initial Recruiter Screening</option>
                      <option value="technical">Technical Architecture &amp; Coding</option>
                      <option value="culture">Culture &amp; Core Values</option>
                      <option value="executive">Executive Leadership Final</option>
                    </>
                  ) : (
                    interviewTypesList.map((t) => (
                      <option key={t.id} value={t.slug}>
                        {t.name} ({t.defaultDurationMinutes} mins)
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Duration (Minutes)</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">60 minutes</option>
                  <option value="90">90 minutes</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Start Time</label>
                <Input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Meeting URL / Room Link</label>
                <Input
                  value={meetingLink}
                  onChange={(e) => setMeetingLink(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Candidate Preparation Instructions</label>
                <Textarea
                  rows={3}
                  placeholder="Notes for the candidate regarding system requirements or code editor..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/interviews">
            <Button variant="outline" size="sm" className="text-xs">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="sm"
            variant="accent"
            disabled={isSubmitting}
            className="gap-1.5 text-xs"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            <span>Schedule &amp; Notify Panel</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

export function InterviewSchedulePage() {
  return (
    <Suspense fallback={<div className="page p-8 text-xs text-muted-foreground">Loading schedule form...</div>}>
      <ScheduleContent />
    </Suspense>
  );
}
