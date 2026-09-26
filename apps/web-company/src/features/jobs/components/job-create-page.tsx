"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import {
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Plus,
  Building2,
  MapPin,
  Laptop,
  Briefcase,
  DollarSign,
  Tag,
  X,
  Sparkles,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Can } from "@/components/rbac/can";
import { createJob } from "@/features/jobs/server/actions";
import {
  getDepartments,
  createDepartment,
  getLocations,
  createLocation,
  getWorkModes,
  createWorkMode,
  getEmploymentTypes,
  createEmploymentType,
  getExperienceLevels,
  createExperienceLevel,
  getEducationLevels,
  createEducationLevel,
  getCurrencies,
  createCurrency,
  getPayFrequencies,
  createPayFrequency,
} from "@/features/masters/server/actions";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { BenefitsRepeater, BenefitItem, BENEFIT_PRESETS } from "@/features/jobs/components/benefits-repeater";

export function JobCreatePage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [workModesList, setWorkModesList] = useState<any[]>([]);
  const [employmentTypesList, setEmploymentTypesList] = useState<any[]>([]);
  const [experienceLevelsList, setExperienceLevelsList] = useState<any[]>([]);
  const [educationLevelsList, setEducationLevelsList] = useState<any[]>([]);
  const [currenciesList, setCurrenciesList] = useState<any[]>([]);
  const [payFrequenciesList, setPayFrequenciesList] = useState<any[]>([]);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State - Core Info
  const [title, setTitle] = useState("");
  const [reqCode, setReqCode] = useState(`REQ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [departmentId, setDepartmentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [locationText, setLocationText] = useState("San Francisco, CA / Remote");
  const [workMode, setWorkMode] = useState("hybrid");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [experienceLevel, setExperienceLevel] = useState("senior");
  const [educationLevel, setEducationLevel] = useState("bachelors");
  const [vacancies, setVacancies] = useState("1");
  const [targetStartDate, setTargetStartDate] = useState("");

  // Compensation
  const [currency, setCurrency] = useState("USD");
  const [payFrequency, setPayFrequency] = useState("annual");
  const [salaryMin, setSalaryMin] = useState("140000");
  const [salaryMax, setSalaryMax] = useState("190000");
  const [isSalaryPublic, setIsSalaryPublic] = useState(true);
  const [equityRange, setEquityRange] = useState("0.10% – 0.25% ISO Stock Options");
  const [bonusStructure, setBonusStructure] = useState("Up to 15% annual performance bonus");
  const [relocationAssistance, setRelocationAssistance] = useState("Visa sponsorship and relocation stipend available");

  // Benefits Repeater
  const [benefitsList, setBenefitsList] = useState<BenefitItem[]>([
    {
      id: "b1",
      title: BENEFIT_PRESETS[0].title,
      description: BENEFIT_PRESETS[0].description,
      category: BENEFIT_PRESETS[0].category,
    },
    {
      id: "b2",
      title: BENEFIT_PRESETS[1].title,
      description: BENEFIT_PRESETS[1].description,
      category: BENEFIT_PRESETS[1].category,
    },
    {
      id: "b3",
      title: BENEFIT_PRESETS[3].title,
      description: BENEFIT_PRESETS[3].description,
      category: BENEFIT_PRESETS[3].category,
    },
    {
      id: "b4",
      title: BENEFIT_PRESETS[4].title,
      description: BENEFIT_PRESETS[4].description,
      category: BENEFIT_PRESETS[4].category,
    },
  ]);

  // Skills
  const [primarySkills, setPrimarySkills] = useState<string[]>(["TypeScript", "React", "Node.js", "PostgreSQL"]);
  const [secondarySkills, setSecondarySkills] = useState<string[]>(["Docker", "AWS", "GraphQL", "Redis"]);
  const [primarySkillInput, setPrimarySkillInput] = useState("");
  const [secondarySkillInput, setSecondarySkillInput] = useState("");

  // Rich Text Fields
  const [summary, setSummary] = useState(
    "<p>We are seeking an experienced specialist to join our core engineering organization. In this role, you will build scalable distributed systems, champion architecture best practices, and collaborate closely with product management and design to deliver mission-critical software.</p>"
  );
  const [responsibilities, setResponsibilities] = useState(
    "<ul><li>Architect, develop, and maintain performant backend services and APIs.</li><li>Collaborate with cross-functional teams to define technical scope and roadmap deliverables.</li><li>Mentor fellow engineers and conduct thorough, constructive code reviews.</li><li>Identify and remediate performance bottlenecks, security vulnerabilities, and reliability concerns.</li></ul>"
  );
  const [requirements, setRequirements] = useState(
    "<ul><li>5+ years of demonstrable software engineering experience in production environments.</li><li>Solid understanding of relational database schema design, indexing, and query optimization.</li><li>Strong background building type-safe modern applications with TypeScript / Node.js / Go.</li><li>Excellent communication and problem-solving skills in a high-velocity environment.</li></ul>"
  );
  const [niceToHave, setNiceToHave] = useState(
    "<ul><li>Hands-on experience with Kubernetes, Terraform, and cloud-native infrastructure.</li><li>Prior contribution to open-source developer tooling or developer platforms.</li><li>Familiarity with distributed caching, event streaming (Kafka/RabbitMQ), and service mesh tooling.</li></ul>"
  );
  const [aboutTeam, setAboutTeam] = useState(
    "<p>Our team values autonomy, direct ownership, continuous learning, and pragmatic engineering. We believe in building resilient software while fostering a collaborative, supportive, and inclusive culture.</p>"
  );

  // Quick-Add Modals State
  const [addDeptOpen, setAddDeptOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [isAddingDept, setIsAddingDept] = useState(false);

  const [addLocOpen, setAddLocOpen] = useState(false);
  const [newLocName, setNewLocName] = useState("");
  const [newLocCity, setNewLocCity] = useState("");
  const [newLocCountry, setNewLocCountry] = useState("United States");
  const [isAddingLoc, setIsAddingLoc] = useState(false);

  const [addWorkModeOpen, setAddWorkModeOpen] = useState(false);
  const [newWorkModeName, setNewWorkModeName] = useState("");
  const [newWorkModeSlug, setNewWorkModeSlug] = useState("");
  const [newWorkModeDesc, setNewWorkModeDesc] = useState("");
  const [isAddingWorkMode, setIsAddingWorkMode] = useState(false);

  const [addEmpTypeOpen, setAddEmpTypeOpen] = useState(false);
  const [newEmpTypeName, setNewEmpTypeName] = useState("");
  const [newEmpTypeSlug, setNewEmpTypeSlug] = useState("");
  const [newEmpTypeDesc, setNewEmpTypeDesc] = useState("");
  const [isAddingEmpType, setIsAddingEmpType] = useState(false);

  const [addExpLevelOpen, setAddExpLevelOpen] = useState(false);
  const [newExpLevelName, setNewExpLevelName] = useState("");
  const [newExpLevelSlug, setNewExpLevelSlug] = useState("");
  const [newExpLevelMinYears, setNewExpLevelMinYears] = useState(0);
  const [newExpLevelMaxYears, setNewExpLevelMaxYears] = useState(2);
  const [newExpLevelDesc, setNewExpLevelDesc] = useState("");
  const [isAddingExpLevel, setIsAddingExpLevel] = useState(false);

  const [addEduLevelOpen, setAddEduLevelOpen] = useState(false);
  const [newEduLevelName, setNewEduLevelName] = useState("");
  const [newEduLevelSlug, setNewEduLevelSlug] = useState("");
  const [newEduLevelDesc, setNewEduLevelDesc] = useState("");
  const [isAddingEduLevel, setIsAddingEduLevel] = useState(false);

  const [addCurrencyOpen, setAddCurrencyOpen] = useState(false);
  const [newCurrCode, setNewCurrCode] = useState("");
  const [newCurrSymbol, setNewCurrSymbol] = useState("");
  const [newCurrName, setNewCurrName] = useState("");
  const [isAddingCurrency, setIsAddingCurrency] = useState(false);

  const [addPayFreqOpen, setAddPayFreqOpen] = useState(false);
  const [newPayFreqName, setNewPayFreqName] = useState("");
  const [newPayFreqSlug, setNewPayFreqSlug] = useState("");
  const [newPayFreqDesc, setNewPayFreqDesc] = useState("");
  const [isAddingPayFreq, setIsAddingPayFreq] = useState(false);

  const loadMetadata = async () => {
    try {
      const [deptList, locList, wmList, etList, expList, eduList, currList, freqList] = await Promise.all([
        getDepartments(),
        getLocations(),
        getWorkModes(),
        getEmploymentTypes(),
        getExperienceLevels(),
        getEducationLevels(),
        getCurrencies(),
        getPayFrequencies(),
      ]);
      setDepartments(deptList);
      setLocations(locList);
      setWorkModesList(wmList);
      setEmploymentTypesList(etList);
      setExperienceLevelsList(expList);
      setEducationLevelsList(eduList);
      setCurrenciesList(currList);
      setPayFrequenciesList(freqList);

      if (deptList[0] && !departmentId) setDepartmentId(deptList[0].id);
      if (locList[0] && !locationId) setLocationId(locList[0].id);
      if (wmList[0] && !workMode) setWorkMode(wmList[0].slug);
      if (etList[0] && !employmentType) setEmploymentType(etList[0].slug);
      if (expList[0] && !experienceLevel) setExperienceLevel(expList[0].slug);
      if (eduList[0] && !educationLevel) setEducationLevel(eduList[0].slug);
      if (currList[0] && !currency) setCurrency(currList[0].code);
      if (freqList[0] && !payFrequency) setPayFrequency(freqList[0].slug);
    } catch (err) {
      console.error("Failed to load metadata:", err);
    } finally {
      setLoadingLookups(false);
    }
  };

  useEffect(() => {
    loadMetadata();
  }, []);

  // Skill Chip Handlers
  const handleAddPrimarySkill = (val?: string) => {
    const clean = (val || primarySkillInput).trim();
    if (!clean) return;
    if (!primarySkills.includes(clean)) setPrimarySkills([...primarySkills, clean]);
    setPrimarySkillInput("");
  };

  const handleAddSecondarySkill = (val?: string) => {
    const clean = (val || secondarySkillInput).trim();
    if (!clean) return;
    if (!secondarySkills.includes(clean)) setSecondarySkills([...secondarySkills, clean]);
    setSecondarySkillInput("");
  };

  // Quick inline creation handlers
  const handleQuickAddDept = async () => {
    if (!newDeptName.trim() || !newDeptCode.trim()) {
      toast.error("Please provide department name and code");
      return;
    }
    setIsAddingDept(true);
    try {
      const res = await createDepartment({
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
      });
      toast.success(`Department "${newDeptName}" added`);
      setAddDeptOpen(false);
      setNewDeptName("");
      setNewDeptCode("");
      await loadMetadata();
      if (res?.id) setDepartmentId(res.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to add department");
    } finally {
      setIsAddingDept(false);
    }
  };

  const handleQuickAddLoc = async () => {
    if (!newLocName.trim() || !newLocCity.trim()) {
      toast.error("Please provide location name and city");
      return;
    }
    setIsAddingLoc(true);
    try {
      const res = await createLocation({
        name: newLocName.trim(),
        city: newLocCity.trim(),
        country: newLocCountry.trim() || "United States",
      });
      toast.success(`Location "${newLocName}" added`);
      setAddLocOpen(false);
      setNewLocName("");
      setNewLocCity("");
      await loadMetadata();
      if (res.id) setLocationId(res.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to add location");
    } finally {
      setIsAddingLoc(false);
    }
  };

  const handleQuickAddWorkMode = async () => {
    if (!newWorkModeName.trim()) {
      toast.error("Please provide work mode name");
      return;
    }
    setIsAddingWorkMode(true);
    try {
      const slug = (newWorkModeSlug || newWorkModeName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      await createWorkMode({
        name: newWorkModeName.trim(),
        slug,
        description: newWorkModeDesc.trim() || undefined,
      });
      toast.success(`Work mode "${newWorkModeName}" added`);
      setAddWorkModeOpen(false);
      setNewWorkModeName("");
      setNewWorkModeSlug("");
      setNewWorkModeDesc("");
      await loadMetadata();
      setWorkMode(slug);
    } catch (err: any) {
      toast.error(err.message || "Failed to add work mode");
    } finally {
      setIsAddingWorkMode(false);
    }
  };

  const handleQuickAddEmpType = async () => {
    if (!newEmpTypeName.trim()) {
      toast.error("Please provide employment type name");
      return;
    }
    setIsAddingEmpType(true);
    try {
      const slug = (newEmpTypeSlug || newEmpTypeName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      await createEmploymentType({
        name: newEmpTypeName.trim(),
        slug,
        description: newEmpTypeDesc.trim() || undefined,
      });
      toast.success(`Employment type "${newEmpTypeName}" added`);
      setAddEmpTypeOpen(false);
      setNewEmpTypeName("");
      setNewEmpTypeSlug("");
      setNewEmpTypeDesc("");
      await loadMetadata();
      setEmploymentType(slug);
    } catch (err: any) {
      toast.error(err.message || "Failed to add employment type");
    } finally {
      setIsAddingEmpType(false);
    }
  };

  const handleQuickAddExpLevel = async () => {
    if (!newExpLevelName.trim()) {
      toast.error("Please provide experience level name");
      return;
    }
    setIsAddingExpLevel(true);
    try {
      const slug = (newExpLevelSlug || newExpLevelName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      await createExperienceLevel({
        name: newExpLevelName.trim(),
        slug,
        minYears: Number(newExpLevelMinYears) || 0,
        maxYears: Number(newExpLevelMaxYears) || 0,
        description: newExpLevelDesc.trim() || undefined,
      });
      toast.success(`Experience level "${newExpLevelName}" added`);
      setAddExpLevelOpen(false);
      setNewExpLevelName("");
      setNewExpLevelSlug("");
      setNewExpLevelMinYears(0);
      setNewExpLevelMaxYears(2);
      setNewExpLevelDesc("");
      await loadMetadata();
      setExperienceLevel(slug);
    } catch (err: any) {
      toast.error(err.message || "Failed to add experience level");
    } finally {
      setIsAddingExpLevel(false);
    }
  };

  const handleQuickAddEduLevel = async () => {
    if (!newEduLevelName.trim()) {
      toast.error("Please provide education requirement name");
      return;
    }
    setIsAddingEduLevel(true);
    try {
      const slug = (newEduLevelSlug || newEduLevelName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      await createEducationLevel({
        name: newEduLevelName.trim(),
        slug,
        description: newEduLevelDesc.trim() || undefined,
      });
      toast.success(`Education requirement "${newEduLevelName}" added`);
      setAddEduLevelOpen(false);
      setNewEduLevelName("");
      setNewEduLevelSlug("");
      setNewEduLevelDesc("");
      await loadMetadata();
      setEducationLevel(slug);
    } catch (err: any) {
      toast.error(err.message || "Failed to add education requirement");
    } finally {
      setIsAddingEduLevel(false);
    }
  };

  const handleQuickAddCurrency = async () => {
    if (!newCurrCode.trim() || !newCurrSymbol.trim() || !newCurrName.trim()) {
      toast.error("Please provide currency code, symbol, and full name");
      return;
    }
    setIsAddingCurrency(true);
    try {
      const code = newCurrCode.trim().toUpperCase();
      await createCurrency({
        code,
        symbol: newCurrSymbol.trim(),
        name: newCurrName.trim(),
      });
      toast.success(`Currency "${code}" added`);
      setAddCurrencyOpen(false);
      setNewCurrCode("");
      setNewCurrSymbol("");
      setNewCurrName("");
      await loadMetadata();
      setCurrency(code);
    } catch (err: any) {
      toast.error(err.message || "Failed to add currency");
    } finally {
      setIsAddingCurrency(false);
    }
  };

  const handleQuickAddPayFreq = async () => {
    if (!newPayFreqName.trim()) {
      toast.error("Please provide pay frequency name");
      return;
    }
    setIsAddingPayFreq(true);
    try {
      const slug = (newPayFreqSlug || newPayFreqName).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
      await createPayFrequency({
        name: newPayFreqName.trim(),
        slug,
        description: newPayFreqDesc.trim() || undefined,
      });
      toast.success(`Pay frequency "${newPayFreqName}" added`);
      setAddPayFreqOpen(false);
      setNewPayFreqName("");
      setNewPayFreqSlug("");
      setNewPayFreqDesc("");
      await loadMetadata();
      setPayFrequency(slug);
    } catch (err: any) {
      toast.error(err.message || "Failed to add pay frequency");
    } finally {
      setIsAddingPayFreq(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent, publish = true) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a job title");
      return;
    }

    setIsSubmitting(true);
    try {
      await createJob({
        title: title.trim(),
        reqCode: reqCode.trim() || undefined,
        departmentId: departmentId || undefined,
        locationId: locationId || undefined,
        locationText: locationText.trim() || undefined,
        workMode,
        employmentType,
        experienceLevel,
        educationLevel,
        vacancies: parseInt(vacancies) || 1,
        targetStartDate: targetStartDate ? new Date(targetStartDate) : null,
        // Undefined, not a default. A blank band is "not stated"; inventing
        // 100000–150000 publishes a salary range nobody agreed to.
        salaryMin: salaryMin.trim() ? parseInt(salaryMin) : undefined,
        salaryMax: salaryMax.trim() ? parseInt(salaryMax) : undefined,
        currency,
        payFrequency,
        isSalaryPublic,
        equityRange: equityRange.trim() || undefined,
        bonusStructure: bonusStructure.trim() || undefined,
        relocationAssistance: relocationAssistance.trim() || undefined,
        summary,
        responsibilities,
        requirements,
        niceToHave,
        aboutTeam,
        benefitsList,
        benefits: benefitsList.map((b) => b.title).join(", "),
        skills: primarySkills,
        secondarySkills,
        status: publish ? "published" : "draft",
      });

      toast.success(
        publish
          ? `Job opening "${title}" published live to Careers portal!`
          : `Job draft "${title}" saved successfully.`,
      );

      router.push("/jobs");
    } catch (err: any) {
      toast.error(err.message || "Failed to create job requisition");
    } finally {
      setIsSubmitting(false);
    }
  };

  const jobTokens = [
    { token: "{{job_title}}", label: "Job Title" },
    { token: "{{department}}", label: "Department" },
    { token: "{{location}}", label: "Location" },
    { token: "{{work_mode}}", label: "Work Mode" },
    { token: "{{employment_type}}", label: "Employment Type" },
    { token: "{{salary_range}}", label: "Salary Band" },
    { token: "{{company_name}}", label: "Company Name" },
  ];

  return (
    <div className="page max-w-4xl pb-20">
      <PageHeader
        title="Create Job Opening"
        description="Configure complete requisition specifications, departmental allocation, compensation band, benefits repeater, and candidate requirements."
        breadcrumbs={[
          { label: "Jobs", href: "/jobs" },
          { label: "Create Opening" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/jobs">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <ArrowLeft className="size-3.5" />
                <span>Cancel</span>
              </Button>
            </Link>
            <Button
              size="sm"
              variant="outline"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, false)}
              className="text-xs"
            >
              Save as Draft
            </Button>
            <Button
              size="sm"
              variant="accent"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, true)}
              className="gap-1 text-xs"
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              <span>Publish Opening</span>
            </Button>
          </div>
        }
      />

      <form onSubmit={(e) => handleSubmit(e, true)} className="space-y-6">
        {/* 1. Basic Information & Organization Context */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">1. Role Information &amp; Organizational Context</CardTitle>
            <CardDescription className="text-xs">
              Primary designation, requisition reference, department allocation, and work arrangement
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="field-label">Job Title *</label>
                <Input
                  placeholder="e.g. Staff Backend Engineer (Distributed Systems)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Requisition Code / Ref #</label>
                <Input
                  placeholder="e.g. REQ-2026-042"
                  value={reqCode}
                  onChange={(e) => setReqCode(e.target.value)}
                  className="h-8 text-xs uppercase"
                />
              </div>

              {/* Department */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1">
                    <Building2 className="size-3 text-copper" />
                    <span>Department *</span>
                  </label>
                  <Can permission="departments.create">
                    <button
                      type="button"
                      onClick={() => setAddDeptOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Office Location */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1">
                    <MapPin className="size-3 text-copper" />
                    <span>Office Location</span>
                  </label>
                  <Can permission="locations.create">
                    <button
                      type="button"
                      onClick={() => setAddLocOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.city}, {l.country})
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Mode */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1">
                    <Laptop className="size-3 text-copper" />
                    <span>Work Mode</span>
                  </label>
                  <Can permission="work-modes.create">
                    <button
                      type="button"
                      onClick={() => setAddWorkModeOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={workMode}
                  onChange={(e) => setWorkMode(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {workModesList.map((wm) => (
                    <option key={wm.id} value={wm.slug}>
                      {wm.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Employment Type */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1">
                    <Briefcase className="size-3 text-copper" />
                    <span>Employment Type</span>
                  </label>
                  <Can permission="employment-types.create">
                    <button
                      type="button"
                      onClick={() => setAddEmpTypeOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {employmentTypesList.map((et) => (
                    <option key={et.id} value={et.slug}>
                      {et.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Experience Level */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label">Experience Level</label>
                  <Can permission="experience-levels.create">
                    <button
                      type="button"
                      onClick={() => setAddExpLevelOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={experienceLevel}
                  onChange={(e) => setExperienceLevel(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {experienceLevelsList.length === 0 ? (
                    <>
                      <option value="entry">Entry Level (0-2 yrs)</option>
                      <option value="mid">Mid Level (3-5 yrs)</option>
                      <option value="senior">Senior Level (5-8 yrs)</option>
                      <option value="lead_staff">Staff / Principal (8+ yrs)</option>
                      <option value="director_executive">Director / Executive (10+ yrs)</option>
                    </>
                  ) : (
                    experienceLevelsList.map((exp) => (
                      <option key={exp.id} value={exp.slug}>
                        {exp.name} ({exp.minYears}–{exp.maxYears} yrs)
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Education Requirement */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label">Education Requirement</label>
                  <Can permission="education-levels.create">
                    <button
                      type="button"
                      onClick={() => setAddEduLevelOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={educationLevel}
                  onChange={(e) => setEducationLevel(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {educationLevelsList.length === 0 ? (
                    <>
                      <option value="none">No Specific Degree Required</option>
                      <option value="bachelors">Bachelor's Degree or Equivalent</option>
                      <option value="masters">Master's Degree</option>
                      <option value="doctorate">Doctorate / PhD</option>
                    </>
                  ) : (
                    educationLevelsList.map((edu) => (
                      <option key={edu.id} value={edu.slug}>
                        {edu.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Number of Vacancies</label>
                <Input
                  type="number"
                  min="1"
                  max="999"
                  value={vacancies}
                  onChange={(e) => setVacancies(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Target Start Date</label>
                <Input
                  type="date"
                  value={targetStartDate}
                  onChange={(e) => setTargetStartDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Location Tagline / Detail</label>
                <Input
                  placeholder="e.g. London EMEA / Remote Eligible"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Compensation & Salary Transparency */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">2. Compensation, Equity &amp; Transparency</CardTitle>
            <CardDescription className="text-xs">
              Target salary band, equity grant structures, performance bonuses, and public visibility
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label flex items-center gap-1">
                    <DollarSign className="size-3 text-copper" />
                    <span>Currency</span>
                  </label>
                  <Can permission="currencies.create">
                    <button
                      type="button"
                      onClick={() => setAddCurrencyOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {currenciesList.length === 0 ? (
                    <>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="INR">INR (₹)</option>
                    </>
                  ) : (
                    currenciesList.map((c) => (
                      <option key={c.id} value={c.code}>
                        {c.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="field-label">Pay Frequency</label>
                  <Can permission="pay-frequencies.create">
                    <button
                      type="button"
                      onClick={() => setAddPayFreqOpen(true)}
                      className="text-[10px] text-copper hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="size-2.5" />
                      <span>Add New</span>
                    </button>
                  </Can>
                </div>
                <select
                  value={payFrequency}
                  onChange={(e) => setPayFrequency(e.target.value)}
                  className="h-8 w-full rounded-xs border border-border bg-card px-2.5 text-xs text-foreground focus:border-ring"
                >
                  {payFrequenciesList.length === 0 ? (
                    <>
                      <option value="annual">Annual Salary</option>
                      <option value="monthly">Monthly Salary</option>
                      <option value="hourly">Hourly Rate</option>
                    </>
                  ) : (
                    payFrequenciesList.map((f) => (
                      <option key={f.id} value={f.slug}>
                        {f.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Minimum Pay ({currency})</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    step="1000"
                    placeholder="120000"
                    value={salaryMin}
                    onChange={(e) => setSalaryMin(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Maximum Pay ({currency})</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    step="1000"
                    placeholder="180000"
                    value={salaryMax}
                    onChange={(e) => setSalaryMax(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="space-y-1.5">
                <label className="field-label">Equity / Stock Grant</label>
                <Input
                  placeholder="e.g. 0.15% – 0.35% ISO Options"
                  value={equityRange}
                  onChange={(e) => setEquityRange(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Bonus &amp; Incentives</label>
                <Input
                  placeholder="e.g. 15% annual performance bonus"
                  value={bonusStructure}
                  onChange={(e) => setBonusStructure(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="field-label">Relocation / Visa Support</label>
                <Input
                  placeholder="e.g. Visa sponsorship & relocation provided"
                  value={relocationAssistance}
                  onChange={(e) => setRelocationAssistance(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border/70">
              <input
                type="checkbox"
                id="isSalaryPublic"
                checked={isSalaryPublic}
                onChange={(e) => setIsSalaryPublic(e.target.checked)}
                className="h-4 w-4 rounded-xs border-border text-copper focus:ring-copper cursor-pointer"
              />
              <label htmlFor="isSalaryPublic" className="text-xs text-foreground font-medium cursor-pointer">
                Display salary range publicly on public Careers &amp; Application portal
              </label>
            </div>
          </CardContent>
        </Card>

        {/* 3. Benefits & Perks Repeater */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">3. Benefits, Perks &amp; Total Rewards (Structured Repeater)</CardTitle>
            <CardDescription className="text-xs">
              Structured company offerings shown with dedicated category icons on the Careers board
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <BenefitsRepeater items={benefitsList} onChange={setBenefitsList} />
          </CardContent>
        </Card>

        {/* 4. Skills & Competencies */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">4. Technical Skills &amp; Candidate Matching Tags</CardTitle>
            <CardDescription className="text-xs">
              Categorize mandatory vs. secondary technical skills used for candidate auto-matching and scorecards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            {/* Primary Skills */}
            <div className="space-y-2">
              <label className="field-label flex items-center justify-between">
                <span>Primary / Mandatory Skills ({primarySkills.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">Press Enter or comma to add</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Type primary skill (e.g. TypeScript, Distributed Systems)..."
                    value={primarySkillInput}
                    onChange={(e) => setPrimarySkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddPrimarySkill();
                      }
                    }}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => handleAddPrimarySkill()}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  <span>Add Skill</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-muted/30 rounded-xs border border-border">
                {primarySkills.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">No primary skills added.</span>
                ) : (
                  primarySkills.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="gap-1 bg-card text-xs py-0.5 px-2 border-copper/40 text-foreground font-medium"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => setPrimarySkills(primarySkills.filter((x) => x !== s))}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>

            {/* Secondary Skills */}
            <div className="space-y-2 pt-2 border-t border-border/60">
              <label className="field-label flex items-center justify-between">
                <span>Secondary / Nice-to-Have Skills ({secondarySkills.length})</span>
                <span className="text-[11px] text-muted-foreground font-normal">Press Enter or comma to add</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Type secondary skill (e.g. Kafka, GraphQL, Terraform)..."
                    value={secondarySkillInput}
                    onChange={(e) => setSecondarySkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddSecondarySkill();
                      }
                    }}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => handleAddSecondarySkill()}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="size-3" />
                  <span>Add Skill</span>
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5 min-h-8 p-2 bg-muted/30 rounded-xs border border-border">
                {secondarySkills.length === 0 ? (
                  <span className="text-[11px] text-muted-foreground italic">No secondary skills added.</span>
                ) : (
                  secondarySkills.map((s) => (
                    <Badge
                      key={s}
                      variant="outline"
                      className="gap-1 bg-card text-xs py-0.5 px-2 border-border text-muted-foreground font-medium"
                    >
                      <span>{s}</span>
                      <button
                        type="button"
                        onClick={() => setSecondarySkills(secondarySkills.filter((x) => x !== s))}
                        className="text-muted-foreground hover:text-destructive cursor-pointer"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Comprehensive Job Description (Rich Text Editors) */}
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">5. Detailed Job Description &amp; Candidate Specifications</CardTitle>
            <CardDescription className="text-xs">
              Formatted markdown/HTML content with floating external editor and dynamic template variables
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 text-xs">
            <div className="space-y-1.5">
              <label className="field-label">Role Overview &amp; Mission</label>
              <RichTextEditor
                value={summary}
                onChange={setSummary}
                placeholder="High-level overview of the role, department objectives, and impact..."
                placeholders={jobTokens}
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">Key Responsibilities &amp; Deliverables</label>
              <RichTextEditor
                value={responsibilities}
                onChange={setResponsibilities}
                placeholder="List day-to-day deliverables, technical expectations, and milestones..."
                placeholders={jobTokens}
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">Mandatory Requirements &amp; Qualifications</label>
              <RichTextEditor
                value={requirements}
                onChange={setRequirements}
                placeholder="Required years of experience, technical skills, core domain knowledge..."
                placeholders={jobTokens}
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">Preferred / Nice-to-Have Qualifications</label>
              <RichTextEditor
                value={niceToHave}
                onChange={setNiceToHave}
                placeholder="Preferred industry experience, supplementary certifications, nice-to-haves..."
                placeholders={jobTokens}
              />
            </div>

            <div className="space-y-1.5">
              <label className="field-label">About the Team &amp; Work Culture</label>
              <RichTextEditor
                value={aboutTeam}
                onChange={setAboutTeam}
                placeholder="Working style, values, team collaboration practices, and culture..."
                placeholders={jobTokens}
              />
            </div>
          </CardContent>
        </Card>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between p-4 bg-card rounded-xs border border-border">
          <Link href="/jobs">
            <Button type="button" variant="outline" size="sm" className="text-xs">
              Cancel
            </Button>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={(e) => handleSubmit(e, false)}
              className="text-xs"
            >
              Save as Draft
            </Button>

            <Button
              type="submit"
              variant="accent"
              size="sm"
              disabled={isSubmitting}
              className="gap-1 text-xs min-w-32.5"
            >
              {isSubmitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
              <span>Publish Opening</span>
            </Button>
          </div>
        </div>
      </form>

      {/* Quick Add Department Modal */}
      <Dialog open={addDeptOpen} onOpenChange={setAddDeptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Department</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Department Name *</label>
              <Input
                value={newDeptName}
                onChange={(e) => setNewDeptName(e.target.value)}
                placeholder="e.g. Product Design"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Code / Abbreviation *</label>
              <Input
                value={newDeptCode}
                onChange={(e) => setNewDeptCode(e.target.value.toUpperCase())}
                placeholder="e.g. DSGN"
                className="h-8 text-xs uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddDeptOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingDept}
              onClick={handleQuickAddDept}
              className="gap-1"
            >
              {isAddingDept ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Location Modal */}
      <Dialog open={addLocOpen} onOpenChange={setAddLocOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Office Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Office Location Name *</label>
              <Input
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder="e.g. London EMEA Office"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">City *</label>
              <Input
                value={newLocCity}
                onChange={(e) => setNewLocCity(e.target.value)}
                placeholder="e.g. London"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Country</label>
              <Input
                value={newLocCountry}
                onChange={(e) => setNewLocCountry(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddLocOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingLoc}
              onClick={handleQuickAddLoc}
              className="gap-1"
            >
              {isAddingLoc ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Work Mode Modal */}
      <Dialog open={addWorkModeOpen} onOpenChange={setAddWorkModeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Work Mode</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Work Mode Name *</label>
              <Input
                value={newWorkModeName}
                onChange={(e) => {
                  setNewWorkModeName(e.target.value);
                  if (!newWorkModeSlug) {
                    setNewWorkModeSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                    );
                  }
                }}
                placeholder="e.g. Client Site"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Identifier Slug</label>
              <Input
                value={newWorkModeSlug}
                onChange={(e) => setNewWorkModeSlug(e.target.value)}
                placeholder="e.g. client_site"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Description</label>
              <Input
                value={newWorkModeDesc}
                onChange={(e) => setNewWorkModeDesc(e.target.value)}
                placeholder="e.g. Based primarily at client physical location"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddWorkModeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingWorkMode}
              onClick={handleQuickAddWorkMode}
              className="gap-1"
            >
              {isAddingWorkMode ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Employment Type Modal */}
      <Dialog open={addEmpTypeOpen} onOpenChange={setAddEmpTypeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Employment Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Employment Type Name *</label>
              <Input
                value={newEmpTypeName}
                onChange={(e) => {
                  setNewEmpTypeName(e.target.value);
                  if (!newEmpTypeSlug) {
                    setNewEmpTypeSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                    );
                  }
                }}
                placeholder="e.g. Freelance / Retainer"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Identifier Slug</label>
              <Input
                value={newEmpTypeSlug}
                onChange={(e) => setNewEmpTypeSlug(e.target.value)}
                placeholder="e.g. freelance_retainer"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Description</label>
              <Input
                value={newEmpTypeDesc}
                onChange={(e) => setNewEmpTypeDesc(e.target.value)}
                placeholder="e.g. Retainer-based contract"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddEmpTypeOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingEmpType}
              onClick={handleQuickAddEmpType}
              className="gap-1"
            >
              {isAddingEmpType ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Experience Level Modal */}
      <Dialog open={addExpLevelOpen} onOpenChange={setAddExpLevelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Experience Level</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Experience Level Name *</label>
              <Input
                value={newExpLevelName}
                onChange={(e) => {
                  setNewExpLevelName(e.target.value);
                  if (!newExpLevelSlug) {
                    setNewExpLevelSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                    );
                  }
                }}
                placeholder="e.g. Lead Staff Engineer"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Identifier Slug</label>
              <Input
                value={newExpLevelSlug}
                onChange={(e) => setNewExpLevelSlug(e.target.value)}
                placeholder="e.g. lead_staff"
                className="h-8 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="field-label">Min Yrs</label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={newExpLevelMinYears}
                  onChange={(e) => setNewExpLevelMinYears(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Max Yrs</label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  value={newExpLevelMaxYears}
                  onChange={(e) => setNewExpLevelMaxYears(Number(e.target.value))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="field-label">Description</label>
              <Input
                value={newExpLevelDesc}
                onChange={(e) => setNewExpLevelDesc(e.target.value)}
                placeholder="e.g. 8+ years domain mastery"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddExpLevelOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingExpLevel}
              onClick={handleQuickAddExpLevel}
              className="gap-1"
            >
              {isAddingExpLevel ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Education Requirement Modal */}
      <Dialog open={addEduLevelOpen} onOpenChange={setAddEduLevelOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Education Requirement</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Education Requirement Name *</label>
              <Input
                value={newEduLevelName}
                onChange={(e) => {
                  setNewEduLevelName(e.target.value);
                  if (!newEduLevelSlug) {
                    setNewEduLevelSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                    );
                  }
                }}
                placeholder="e.g. Post-Graduate Diploma"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Identifier Slug</label>
              <Input
                value={newEduLevelSlug}
                onChange={(e) => setNewEduLevelSlug(e.target.value)}
                placeholder="e.g. pg_diploma"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Description</label>
              <Input
                value={newEduLevelDesc}
                onChange={(e) => setNewEduLevelDesc(e.target.value)}
                placeholder="e.g. Advanced post-graduate diploma"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddEduLevelOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingEduLevel}
              onClick={handleQuickAddEduLevel}
              className="gap-1"
            >
              {isAddingEduLevel ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Currency Modal */}
      <Dialog open={addCurrencyOpen} onOpenChange={setAddCurrencyOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Currency Master</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="field-label">Currency Code *</label>
                <Input
                  value={newCurrCode}
                  onChange={(e) => {
                    setNewCurrCode(e.target.value);
                    if (!newCurrName) setNewCurrName(`${e.target.value.toUpperCase()} (${newCurrSymbol || "$"})`);
                  }}
                  placeholder="e.g. JPY"
                  className="h-8 text-xs uppercase"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Symbol *</label>
                <Input
                  value={newCurrSymbol}
                  onChange={(e) => {
                    setNewCurrSymbol(e.target.value);
                    if (newCurrCode) setNewCurrName(`${newCurrCode.toUpperCase()} (${e.target.value})`);
                  }}
                  placeholder="e.g. ¥"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="field-label">Display Name *</label>
              <Input
                value={newCurrName}
                onChange={(e) => setNewCurrName(e.target.value)}
                placeholder="e.g. Japanese Yen (¥)"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddCurrencyOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingCurrency}
              onClick={handleQuickAddCurrency}
              className="gap-1"
            >
              {isAddingCurrency ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Add Pay Frequency Modal */}
      <Dialog open={addPayFreqOpen} onOpenChange={setAddPayFreqOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Quick Add Pay Frequency</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="field-label">Frequency Name *</label>
              <Input
                value={newPayFreqName}
                onChange={(e) => {
                  setNewPayFreqName(e.target.value);
                  if (!newPayFreqSlug) {
                    setNewPayFreqSlug(
                      e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")
                    );
                  }
                }}
                placeholder="e.g. Bi-Weekly Pay"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Identifier Slug</label>
              <Input
                value={newPayFreqSlug}
                onChange={(e) => setNewPayFreqSlug(e.target.value)}
                placeholder="e.g. bi_weekly"
                className="h-8 text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="field-label">Description</label>
              <Input
                value={newPayFreqDesc}
                onChange={(e) => setNewPayFreqDesc(e.target.value)}
                placeholder="e.g. 26 pay periods per calendar year"
                className="h-8 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setAddPayFreqOpen(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isAddingPayFreq}
              onClick={handleQuickAddPayFreq}
              className="gap-1"
            >
              {isAddingPayFreq ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save &amp; Select</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
