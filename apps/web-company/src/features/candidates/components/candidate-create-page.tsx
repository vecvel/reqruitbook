"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Upload,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  FileText,
  Link2,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createCandidate } from "@/features/candidates/server/actions";
import { getJobs } from "@/features/jobs/server/actions";
import { createApplicationForCandidate } from "@/features/applications/server/actions";

export function CandidateCreatePage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("San Francisco, CA");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [totalExperience, setTotalExperience] = useState("4 Years");
  const [expectedSalary, setExpectedSalary] = useState("$140,000 / year");
  const [noticePeriod, setNoticePeriod] = useState("30 Days / Immediate");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState("React, TypeScript, Node.js");
  const [targetJobId, setTargetJobId] = useState("");
  const [notes, setNotes] = useState("");

  // Resume Upload / Link Mode
  const [resumeMode, setResumeMode] = useState<"upload" | "link">("upload");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileSize, setResumeFileSize] = useState<number | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const jList = await getJobs();
        setJobs(jList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingJobs(false);
      }
    }
    load();
  }, []);

  const handleFileUpload = async (file: File) => {
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      toast.error("File size exceeds 5 MB limit.");
      return;
    }

    const allowed = [".pdf", ".doc", ".docx"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext)) {
      toast.error("Only PDF, DOC, or DOCX files are supported.");
      return;
    }

    setIsUploadingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload file.");
      }

      setResumeUrl(data.fileUrl);
      setResumeFileName(data.fileName);
      setResumeFileSize(data.fileSize);
      toast.success("Resume uploaded successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload resume.");
    } finally {
      setIsUploadingResume(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleRemoveResume = () => {
    setResumeUrl("");
    setResumeFileName("");
    setResumeFileSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) {
      toast.error("Please fill in candidate name and email.");
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = skills.split(",").map((s) => s.trim()).filter(Boolean);
      const expNumeric = parseInt(totalExperience.replace(/[^0-9]/g, "")) || 0;
      const salaryNumeric = parseInt(expectedSalary.replace(/[^0-9]/g, "")) || 0;
      const noticeNumeric = parseInt(noticePeriod.replace(/[^0-9]/g, "")) || 30;

      if (targetJobId) {
        await createApplicationForCandidate({
          jobId: targetJobId,
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          currentDesignation: currentDesignation.trim(),
          currentCompany: currentCompany.trim(),
          totalExperienceYears: expNumeric,
          totalExperienceText: totalExperience.trim(),
          expectedSalary: salaryNumeric,
          expectedSalaryText: expectedSalary.trim(),
          noticePeriodDays: noticeNumeric,
          noticePeriodText: noticePeriod.trim(),
          linkedInUrl: linkedInUrl.trim(),
          portfolioUrl: portfolioUrl.trim(),
          resumeUrl: resumeUrl.trim(),
          resumeFileName: resumeFileName.trim(),
          skills: skillsArray,
          coverLetter: notes.trim(),
        });
      } else {
        await createCandidate({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          city: city.trim(),
          currentDesignation: currentDesignation.trim(),
          currentCompany: currentCompany.trim(),
          totalExperienceYears: expNumeric,
          totalExperienceText: totalExperience.trim(),
          expectedSalary: salaryNumeric,
          expectedSalaryText: expectedSalary.trim(),
          noticePeriodDays: noticeNumeric,
          noticePeriodText: noticePeriod.trim(),
          linkedInUrl: linkedInUrl.trim(),
          portfolioUrl: portfolioUrl.trim(),
          resumeUrl: resumeUrl.trim(),
          resumeFileName: resumeFileName.trim(),
          skills: skillsArray,
          coverLetter: notes.trim(),
          notes: notes.trim(),
          inTalentPool: true,
        });
      }

      toast.success(`Candidate ${fullName} saved to recruitment directory!`);
      router.push("/candidates");
    } catch (err: any) {
      toast.error(err.message || "Failed to create candidate");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page max-w-4xl space-y-4">
      <PageHeader
        title="Add New Candidate"
        description="Direct candidate entry, resume intake, professional background, and requisition assignment."
        breadcrumbs={[
          { label: "Candidates", href: "/candidates" },
          { label: "New Candidate" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/candidates">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <ArrowLeft className="size-3.5" />
                <span>Cancel</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="accent"
              disabled={isSubmitting || isUploadingResume}
              onClick={handleSubmit}
              className="gap-1 text-xs cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              <span>Save Candidate</span>
            </Button>
          </div>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 1. Basic Information */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">1. Basic Information</CardTitle>
            <CardDescription className="text-xs">
              Primary candidate contact coordinates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="field-label">Full Legal Name *</label>
                <Input
                  placeholder="e.g. Rahul Sharma"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="h-8 text-xs bg-card"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Email Address *</label>
                <Input
                  type="email"
                  placeholder="e.g. rahul@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs bg-card"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Phone Number</label>
                <Input
                  placeholder="+91 98765 43210 or +1 (555) 000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Current City / Location</label>
                <Input
                  placeholder="e.g. Bengaluru, India or London, UK"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Professional Background & Compensation */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">2. Professional Background &amp; Compensation</CardTitle>
            <CardDescription className="text-xs">
              Current employment, total experience, compensation expectations, and target job opening
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="field-label">Current Designation / Role</label>
                <Input
                  placeholder="e.g. Senior Software Engineer"
                  value={currentDesignation}
                  onChange={(e) => setCurrentDesignation(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Current Company</label>
                <Input
                  placeholder="e.g. Acme Technologies"
                  value={currentCompany}
                  onChange={(e) => setCurrentCompany(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Total Experience</label>
                <Input
                  placeholder="e.g. 4 Years"
                  value={totalExperience}
                  onChange={(e) => setTotalExperience(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Notice Period</label>
                <Input
                  placeholder="e.g. 30 Days / Immediate"
                  value={noticePeriod}
                  onChange={(e) => setNoticePeriod(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Expected Salary</label>
                <Input
                  placeholder="e.g. ₹20L / year or $160,000 / year"
                  value={expectedSalary}
                  onChange={(e) => setExpectedSalary(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Target Requisition (Optional)</label>
                <select
                  value={targetJobId}
                  onChange={(e) => setTargetJobId(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  <option value="">General Talent Pool (No Specific Job)</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} ({j.departmentName || "General"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Key Skills (comma separated)</label>
                <Input
                  placeholder="e.g. TypeScript, React, PostgreSQL, AWS"
                  value={skills}
                  onChange={(e) => setSkills(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Online Presence & Profiles */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">3. Online Presence &amp; Profiles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="field-label">LinkedIn Profile URL</label>
                <Input
                  type="url"
                  placeholder="https://linkedin.com/in/rahul"
                  value={linkedInUrl}
                  onChange={(e) => setLinkedInUrl(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Portfolio / GitHub URL</label>
                <Input
                  type="url"
                  placeholder="https://github.com/rahulsharma"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  className="h-8 text-xs bg-card"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 4. Resume / CV Attachment */}
        <Card className="shadow-none">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="size-4 text-copper" />
              <span>4. Resume / CV</span>
            </CardTitle>

            {/* Upload File vs Paste Link Tabs */}
            <div className="inline-flex rounded-xs p-0.5 bg-muted border border-border">
              <button
                type="button"
                onClick={() => setResumeMode("upload")}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-all cursor-pointer ${
                  resumeMode === "upload"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setResumeMode("link")}
                className={`px-2.5 py-1 text-xs font-medium rounded-xs transition-all cursor-pointer ${
                  resumeMode === "link"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Paste Link
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {resumeMode === "upload" ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {resumeUrl && resumeFileName ? (
                  <div className="p-3.5 bg-muted/40 rounded-xs border border-copper/40 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="size-9 rounded-xs bg-copper/10 text-copper border border-copper/20 flex items-center justify-center shrink-0">
                        <FileText className="size-4.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-foreground block truncate">
                          {resumeFileName}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          {resumeFileSize && (
                            <span>{(resumeFileSize / (1024 * 1024)).toFixed(2)} MB</span>
                          )}
                          <span className="text-emerald-600 font-medium flex items-center gap-0.5">
                            <CheckCircle2 className="size-3" />
                            <span>Uploaded successfully</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={handleRemoveResume}
                      className="h-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 gap-1 text-xs cursor-pointer"
                    >
                      <Trash2 className="size-3.5" />
                      <span>Remove</span>
                    </Button>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-6 border-2 border-dashed rounded-xs text-center cursor-pointer transition-all ${
                      isDragging
                        ? "border-copper bg-copper/10"
                        : "border-border hover:border-copper/60 bg-card/60 hover:bg-muted/20"
                    }`}
                  >
                    {isUploadingResume ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-6 animate-spin text-copper" />
                        <span className="text-xs font-medium text-foreground">Uploading resume document...</span>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <div className="size-9 rounded-full bg-copper/10 text-copper mx-auto flex items-center justify-center">
                          <Upload className="size-4.5" />
                        </div>
                        <div className="font-semibold text-xs text-foreground">
                          Click to upload candidate resume
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          PDF, DOC or DOCX · max 5 MB
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="field-label">Resume / CV Public Document Link</label>
                <div className="relative">
                  <Link2 className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                  <Input
                    type="url"
                    value={resumeUrl}
                    onChange={(e) => {
                      setResumeUrl(e.target.value);
                      setResumeFileName(e.target.value);
                    }}
                    placeholder="https://drive.google.com/file/... or https://dropbox.com/..."
                    className="pl-8 h-8 text-xs bg-card"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. Notes & Cover Letter */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">5. Recruiter Notes &amp; Introduction</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <Textarea
              rows={3}
              placeholder="Initial sourcing notes, referrals, or candidate introduction note..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs bg-card"
            />
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Link href="/candidates">
            <Button variant="outline" size="sm" className="text-xs">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            size="sm"
            variant="accent"
            disabled={isSubmitting || isUploadingResume}
            className="gap-1.5 text-xs cursor-pointer"
          >
            {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            <span>Save Candidate</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
