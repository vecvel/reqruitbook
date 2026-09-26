"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Briefcase,
  MapPin,
  Building2,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  DollarSign,
  Clock,
  GraduationCap,
  Award,
  Globe,
  Share2,
  Upload,
  FileText,
  Link2,
  X,
  Paperclip,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { getPublishedJobById } from "@/features/careers/server/public-queries";
import { submitApplicationFromPortal } from "@/features/careers/server/public-actions";
import { BENEFIT_CATEGORIES, BenefitItem } from "@/features/jobs/components/benefits-repeater";

export function CareersApplyPage({ jobId }: { jobId: string }) {
  const router = useRouter();
  const id = jobId;

  const [job, setJob] = useState<any>(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("San Francisco, CA");
  const [currentDesignation, setCurrentDesignation] = useState("");
  const [currentCompany, setCurrentCompany] = useState("");
  const [totalExperience, setTotalExperience] = useState("4 Years");
  const [expectedSalary, setExpectedSalary] = useState("$160,000 / year");
  const [noticePeriod, setNoticePeriod] = useState("30 Days / Immediate");
  const [linkedInUrl, setLinkedInUrl] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [skills, setSkills] = useState("TypeScript, React, Node.js, PostgreSQL");
  const [coverLetter, setCoverLetter] = useState("");

  // Resume Upload / Link Mode
  const [resumeMode, setResumeMode] = useState<"upload" | "link">("upload");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileSize, setResumeFileSize] = useState<number | null>(null);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadJob() {
      try {
        const j = await getPublishedJobById(id);
        setJob(j);
        if (j?.skills && Array.isArray(j.skills) && j.skills.length > 0) {
          setSkills(j.skills.join(", "));
        }
        if (j?.currency === "INR" || j?.locationText?.includes("India")) {
          setExpectedSalary("₹20L / year");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingJob(false);
      }
    }
    loadJob();
  }, [id]);

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
      toast.error("Please fill in your name and email address.");
      return;
    }

    if (!resumeUrl.trim()) {
      toast.error("Please upload your Resume/CV or paste a link.");
      return;
    }

    setIsSubmitting(true);
    try {
      const skillsArray = skills.split(",").map((s) => s.trim()).filter(Boolean);

      // Extract numeric approximations for database integer columns
      const expNumeric = parseInt(totalExperience.replace(/[^0-9]/g, "")) || 0;
      const salaryNumeric = parseInt(expectedSalary.replace(/[^0-9]/g, "")) || 0;
      const noticeNumeric = parseInt(noticePeriod.replace(/[^0-9]/g, "")) || 30;

      const result = await submitApplicationFromPortal({
        jobId: id,
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
        coverLetter: coverLetter.trim(),
      });

      setSubmitted(true);
      toast.success("Application submitted successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit application");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getCategoryMeta = (cat: string) => {
    return BENEFIT_CATEGORIES.find((c) => c.value === cat) || BENEFIT_CATEGORIES[6];
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8 shadow-none border border-border space-y-4">
          <div className="size-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">Application Received</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Thank you for applying for <strong>{job?.title || "the position"}</strong>. Our talent acquisition team will review your profile and reach out shortly.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/careers">
              <Button size="sm" variant="accent" className="text-xs">
                Back to Careers Page
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  // Parse benefits list
  let benefitsListToRender: BenefitItem[] = [];
  if (job?.benefitsList && Array.isArray(job.benefitsList) && job.benefitsList.length > 0) {
    benefitsListToRender = job.benefitsList;
  } else if (job?.benefits && typeof job.benefits === "string") {
    benefitsListToRender = job.benefits.split(",").map((b: string, idx: number) => ({
      id: `legacy_${idx}`,
      title: b.trim(),
      category: "custom",
    }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link
            href="/careers"
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            <span>Back to All Openings</span>
          </Link>
          <span className="text-xs text-muted-foreground">
            Requisition {job?.reqCode ? `#${job.reqCode}` : ""}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 flex-1 w-full space-y-8">
        {loadingJob ? (
          <div className="p-16 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="size-4 animate-spin text-copper" />
            <span>Loading requisition details...</span>
          </div>
        ) : !job ? (
          <div className="p-12 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xs">
            Job requisition not found or has been unlisted.
          </div>
        ) : (
          <>
            {/* Job Header & Details */}
            <div className="space-y-6 pb-6 border-b border-border">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-copper/10 text-copper border-copper/30">
                    {job.departmentName || "Engineering"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] border-border text-muted-foreground">
                    {job.locationName || job.locationText}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-[10px] border-border text-muted-foreground">
                    {job.workMode?.replace(/_/g, " ")}
                  </Badge>
                  <Badge variant="outline" className="capitalize text-[10px] border-border text-muted-foreground">
                    {job.employmentType?.replace(/_/g, " ")}
                  </Badge>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {job.title}
                </h1>

                {/* Salary & Experience highlight strip */}
                <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-muted-foreground">
                  {job.salaryMin ? (
                    <div className="text-sm sm:text-base font-bold text-copper">
                      {job.currency || "USD"} {(job.salaryMin || 0).toLocaleString()} – {(job.salaryMax || 0).toLocaleString()}
                      <span className="text-xs text-muted-foreground font-normal ml-1">
                        / {job.payFrequency === "hourly" ? "hr" : "yr"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs font-semibold text-copper">Competitive Market Compensation</div>
                  )}

                  {job.experienceLevel && (
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5 text-copper" />
                      <span className="capitalize">{job.experienceLevel?.replace(/_/g, " ")} Level</span>
                    </span>
                  )}
                  {job.educationLevel && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="size-3.5 text-copper" />
                      <span className="capitalize">{job.educationLevel?.replace(/_/g, " ")}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Summary */}
              {job.summary && (
                <div className="space-y-1.5 text-xs">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">Role Summary</h3>
                  <div
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: job.summary }}
                  />
                </div>
              )}

              {/* Responsibilities */}
              {job.responsibilities && (
                <div className="space-y-1.5 text-xs pt-3 border-t border-border/60">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">Key Responsibilities</h3>
                  <div
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: job.responsibilities }}
                  />
                </div>
              )}

              {/* Requirements */}
              {job.requirements && (
                <div className="space-y-1.5 text-xs pt-3 border-t border-border/60">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">Qualifications &amp; Requirements</h3>
                  <div
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: job.requirements }}
                  />
                </div>
              )}

              {/* Nice to have */}
              {job.niceToHave && (
                <div className="space-y-1.5 text-xs pt-3 border-t border-border/60">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">Nice to Have</h3>
                  <div
                    className="text-muted-foreground leading-relaxed prose prose-sm max-w-none text-xs"
                    dangerouslySetInnerHTML={{ __html: job.niceToHave }}
                  />
                </div>
              )}

              {/* Required Skills Chips */}
              {job.skills && Array.isArray(job.skills) && job.skills.length > 0 && (
                <div className="space-y-1.5 text-xs pt-3 border-t border-border/60">
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">Primary Tech Stack &amp; Skills</h3>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {job.skills.map((s: string) => (
                      <Badge key={s} variant="outline" className="text-[11px] px-2 py-0.5 bg-card border-border text-foreground">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefits & Perks */}
              {benefitsListToRender.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-copper">
                      Benefits, Perks &amp; Total Rewards ({benefitsListToRender.length})
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {benefitsListToRender.map((b) => {
                      const meta = getCategoryMeta(b.category || "custom");

                      return (
                        <div
                          key={b.id || b.title}
                          className="p-3.5 rounded-xs border border-border bg-card/60 hover:border-copper/40 transition-colors space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-foreground block">
                              {b.title}
                            </span>
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 border shrink-0 ${meta.color}`}>
                              {meta.label}
                            </Badge>
                          </div>
                          {b.description && (
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                              {b.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Application Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="text-center space-y-1 pt-2">
                <h2 className="text-lg font-bold text-foreground">Apply for this Position</h2>
                <p className="text-xs text-muted-foreground">
                  Submit your credentials directly to the hiring team for <strong>{job.title}</strong>.
                </p>
              </div>

              {/* 1. Candidate Contact Information */}
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">1. Candidate Contact Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="field-label">Full Legal Name *</label>
                      <Input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="h-8 text-xs bg-card"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Email Address *</label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. rahul@example.com"
                        className="h-8 text-xs bg-card"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Phone Number</label>
                      <Input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210 or +1 (555) 000-0000"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Current City &amp; Country</label>
                      <Input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Bengaluru, India or London, UK"
                        className="h-8 text-xs bg-card"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 2. Professional Background & Compensation Expectations */}
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">2. Experience &amp; Compensation Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="field-label">Current Designation / Role</label>
                      <Input
                        value={currentDesignation}
                        onChange={(e) => setCurrentDesignation(e.target.value)}
                        placeholder="e.g. Senior Backend Engineer"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Current Company</label>
                      <Input
                        value={currentCompany}
                        onChange={(e) => setCurrentCompany(e.target.value)}
                        placeholder="e.g. Acme Technologies"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Total Experience</label>
                      <Input
                        value={totalExperience}
                        onChange={(e) => setTotalExperience(e.target.value)}
                        placeholder="e.g. 4 Years"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Notice Period</label>
                      <Input
                        value={noticePeriod}
                        onChange={(e) => setNoticePeriod(e.target.value)}
                        placeholder="e.g. 30 Days / Immediate"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="field-label">Expected Salary</label>
                      <Input
                        value={expectedSalary}
                        onChange={(e) => setExpectedSalary(e.target.value)}
                        placeholder="e.g. ₹20L / year or $180,000 / year"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <label className="field-label">Primary Tech Stack &amp; Key Competencies</label>
                      <Input
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="e.g. TypeScript, Distributed Systems, PostgreSQL, AWS"
                        className="h-8 text-xs bg-card"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 3. Links & Online Presence */}
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
                        value={linkedInUrl}
                        onChange={(e) => setLinkedInUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/rahul"
                        className="h-8 text-xs bg-card"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="field-label">Portfolio / GitHub URL</label>
                      <Input
                        type="url"
                        value={portfolioUrl}
                        onChange={(e) => setPortfolioUrl(e.target.value)}
                        placeholder="https://github.com/rahulsharma"
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
                    <span>4. Resume / CV *</span>
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
                                  <span>Ready to submit</span>
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
                                Click to upload your resume
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
                      <label className="field-label">Resume / CV Public Document Link *</label>
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
                          required={resumeMode === "link"}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Ensure link permissions are set to "Anyone with the link can view".
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 5. Cover Letter / Introduction Note */}
              <Card className="shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">5. Cover Letter / Introduction Note</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <Textarea
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    placeholder="Brief summary of your background, key achievements, and introduction note for the hiring team..."
                    className="text-xs bg-card"
                  />
                </CardContent>
              </Card>

              {/* Submit Actions */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Link href="/careers">
                  <Button variant="outline" size="sm" className="text-xs">
                    Cancel
                  </Button>
                </Link>
                <Button
                  type="submit"
                  size="sm"
                  variant="accent"
                  disabled={isSubmitting || isUploadingResume}
                  className="gap-1.5 text-xs min-w-35 cursor-pointer"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-3.5" />
                  )}
                  <span>Submit Application</span>
                </Button>
              </div>
            </form>
          </>
        )}
      </main>
    </div>
  );
}
