"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck,
  Building2,
  Mail,
  ArrowRight,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";

export function CareersPortalPage() {
  const [candidate] = useState({
    name: "Sophia Chen",
    email: "sophia.chen@example.com",
    role: "Staff Backend Engineer",
    stage: "Interview Round",
    appliedDate: "12 Aug 2026",
    timeline: [
      { step: "Applied", date: "12 Aug 2026", status: "completed" },
      { step: "Screening Passed", date: "13 Aug 2026", status: "completed" },
      { step: "Technical Interview", date: "Today, 10:30 AM", status: "current" },
      { step: "Final Evaluation", date: "Upcoming", status: "pending" },
      { step: "Offer Decision", date: "Pending", status: "pending" },
    ],
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="My Organisation Logo"
              width={32}
              height={32}
              className="size-8 rounded-xs object-contain"
            />
            <div>
              <span className="font-semibold text-sm">My Organisation</span>
              <span className="text-xs text-muted-foreground ml-2">Candidate Portal</span>
            </div>
          </div>
          <Link href="/careers">
            <Button size="xs" variant="outline" className="text-xs">
              Careers Board
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1 space-y-6">
        <div className="surface p-5 rounded-xs border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Welcome, {candidate.name}</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tracking your active application for <strong>{candidate.role}</strong>
            </p>
          </div>
          <Badge variant="soft-accent">Application in Progress</Badge>
        </div>

        {/* Application Stage Progress Bar */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Hiring Stage Progression</CardTitle>
            <CardDescription className="text-xs">
              Live status updates on your recruitment journey
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              {candidate.timeline.map((item, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-xs border text-xs flex flex-col gap-1 ${
                    item.status === "completed"
                      ? "border-success/40 bg-success/5 text-success"
                      : item.status === "current"
                      ? "border-copper bg-copper/10 text-copper-deep font-semibold"
                      : "border-border bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span>Step {idx + 1}</span>
                    {item.status === "completed" && <CheckCircle2 className="size-3.5" />}
                    {item.status === "current" && <Clock className="size-3.5" />}
                  </div>
                  <div className="font-medium text-foreground">{item.step}</div>
                  <div className="text-[10px] text-muted-foreground">{item.date}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Next Step / Upcoming Action */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Upcoming Interview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xs border border-border space-y-1">
                <div className="font-semibold text-copper">Technical System Architecture</div>
                <div className="text-[11px] text-muted-foreground">Today at 10:30 AM (60 min)</div>
                <div className="text-[11px] text-muted-foreground">Panel: David Kim &amp; James Walker</div>
              </div>
              <Button size="xs" variant="accent" className="w-full text-xs gap-1">
                <Calendar className="size-3.5" />
                <span>Join Google Meet</span>
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Application Documents</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-xs border border-border flex items-center justify-between">
                <div>
                  <div className="font-medium">Resume_Sophia_Chen.pdf</div>
                  <div className="text-[10px] text-muted-foreground">Uploaded 12 Aug 2026</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Verified</Badge>
              </div>
              <div className="p-3 bg-muted/40 rounded-xs border border-border flex items-center justify-between">
                <div>
                  <div className="font-medium">Portfolio_Architecture.pdf</div>
                  <div className="text-[10px] text-muted-foreground">Uploaded 12 Aug 2026</div>
                </div>
                <Badge variant="outline" className="text-[10px]">Verified</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
