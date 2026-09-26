"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Mail,
  MapPin,
  FileText,
  Star,
  Loader2,
  Trash2,
  Edit2,
  Eye,
  BookmarkCheck,
  Bookmark,
  Calendar,
  Building,
  Briefcase,
  Award,
  Linkedin,
  Github,
  ExternalLink,
  Download,
  Globe,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getCandidates,
  getCandidateById,
  updateCandidate,
  deleteCandidate,
  toggleTalentPool,
} from "@/features/candidates/server/actions";
import { Can } from "@/components/rbac/can";
import { toast } from "sonner";

function CandidatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");

  const normalizeTab = (t: string | null): string => {
    if (!t || t === "all") return "all";
    if (t === "talent-pool" || t === "pool") return "talent-pool";
    return "all";
  };

  const [tab, setTab] = useState(normalizeTab(tabParam));
  const [searchQuery, setSearchQuery] = useState("");
  const [candidatesList, setCandidatesList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting & Client Pagination
  const [sortField, setSortField] = useState<string>("fullName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Candidate detail drawer
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Edit candidate modal
  const [editingCandidate, setEditingCandidate] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editExp, setEditExp] = useState<string>("4 Years");
  const [editSalary, setEditSalary] = useState<string>("$140,000 / year");
  const [editNotice, setEditNotice] = useState<string>("30 Days / Immediate");
  const [editLinkedIn, setEditLinkedIn] = useState<string>("");
  const [editPortfolio, setEditPortfolio] = useState<string>("");
  const [editResume, setEditResume] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const data = await getCandidates({
        search: searchQuery || undefined,
        inTalentPool: tab === "talent-pool" ? true : undefined,
      });
      setCandidatesList(data);
      setPage(1);
    } catch (err) {
      console.error("Failed to load candidates:", err);
      toast.error("Failed to load candidates directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setTab(normalizeTab(tabParam));
  }, [tabParam]);

  useEffect(() => {
    loadCandidates();
  }, [tab, searchQuery]);

  const handleTabChange = (newTab: string) => {
    setTab(newTab);
    const params = new URLSearchParams(window.location.search);
    if (newTab === "all") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    router.push(`/candidates?${params.toString()}`);
  };

  const handleViewDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const cand = await getCandidateById(id);
      setSelectedCandidate(cand);
    } catch {
      toast.error("Failed to load candidate details");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTogglePool = async (cand: any) => {
    try {
      const newState = !cand.inTalentPool;
      await toggleTalentPool(cand.id, newState);
      toast.success(
        newState ? `Added ${cand.fullName} to Talent Pool` : `Removed from Talent Pool`,
      );
      await loadCandidates();
    } catch {
      toast.error("Failed to toggle talent pool");
    }
  };

  const handleOpenEdit = (cand: any) => {
    setEditingCandidate(cand);
    setEditName(cand.fullName || "");
    setEditEmail(cand.email || "");
    setEditRole(cand.currentDesignation || "");
    setEditCompany(cand.currentCompany || "");
    setEditExp(cand.totalExperienceText || (cand.totalExperienceYears ? `${cand.totalExperienceYears} Years` : "4 Years"));
    setEditSalary(cand.expectedSalaryText || (cand.expectedSalary ? `$${cand.expectedSalary.toLocaleString()} / year` : "$140,000 / year"));
    setEditNotice(cand.noticePeriodText || (cand.noticePeriodDays ? `${cand.noticePeriodDays} Days` : "30 Days / Immediate"));
    setEditLinkedIn(cand.linkedInUrl || "");
    setEditPortfolio(cand.portfolioUrl || "");
    setEditResume(cand.resumeUrl || "");
  };

  const handleSaveEdit = async () => {
    if (!editingCandidate) return;
    setIsSaving(true);
    try {
      const expNumeric = parseInt(String(editExp).replace(/[^0-9]/g, "")) || 0;
      const salaryNumeric = parseInt(String(editSalary).replace(/[^0-9]/g, "")) || 0;
      const noticeNumeric = parseInt(String(editNotice).replace(/[^0-9]/g, "")) || 30;

      await updateCandidate(editingCandidate.id, {
        fullName: editName.trim(),
        email: editEmail.trim(),
        currentDesignation: editRole.trim(),
        currentCompany: editCompany.trim(),
        totalExperienceYears: expNumeric,
        totalExperienceText: editExp.trim(),
        expectedSalary: salaryNumeric,
        expectedSalaryText: editSalary.trim(),
        noticePeriodDays: noticeNumeric,
        noticePeriodText: editNotice.trim(),
        linkedInUrl: editLinkedIn.trim() || undefined,
        portfolioUrl: editPortfolio.trim() || undefined,
        resumeUrl: editResume.trim() || undefined,
      });
      toast.success("Candidate updated successfully!");
      setEditingCandidate(null);
      await loadCandidates();
    } catch {
      toast.error("Failed to update candidate");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete candidate "${name}"?`)) return;
    try {
      await deleteCandidate(id);
      toast.success(`Deleted candidate: ${name}`);
      await loadCandidates();
    } catch {
      toast.error("Failed to delete candidate");
    }
  };

  const handleSort = (field: string, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Processed sorted & paginated candidates
  const sortedCandidates = useMemo(() => {
    return [...candidatesList].sort((a, b) => {
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
  }, [candidatesList, sortField, sortDirection]);

  const paginatedCandidates = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedCandidates.slice(from, from + pageSize);
  }, [sortedCandidates, page, pageSize]);

  return (
    <div className="page space-y-4">
      <PageHeader
        title="Candidate Directory &amp; Talent Pool"
        description="Unified database of applicants, sourced talent, evaluation scorecards, and resumes."
        actions={
          <Can permission="candidates.create">
            <Link href="/candidates/new">
              <Button size="sm" variant="accent" className="gap-1 text-xs">
                <Plus className="size-3.5" />
                <span>Add Candidate</span>
              </Button>
            </Link>
          </Can>
        }
      />

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4 border-b border-border w-fit">
          <button
            type="button"
            onClick={() => handleTabChange("all")}
            className={cn(
              "text-xs py-2 px-1 font-medium transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer",
              tab === "all"
                ? "border-copper text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
            )}
          >
            All Candidates ({candidatesList.length})
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("talent-pool")}
            className={cn(
              "text-xs py-2 px-1 font-medium transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer",
              tab === "talent-pool"
                ? "border-copper text-foreground font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border/60",
            )}
          >
            Curated Talent Pool
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search candidate, skill, role..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs bg-card"
          />
        </div>
      </div>

      {/* StoqBook TableShell */}
      <TableShell>
        <Table>
          <THead>
            <SortableTH
              field="fullName"
              currentSort={sortField === "fullName" ? (sortDirection === "asc" ? "fullName" : "-fullName") : ""}
              onSort={handleSort}
            >
              Candidate
            </SortableTH>
            <TH>Current Role &amp; Company</TH>
            <SortableTH
              field="totalExperienceYears"
              currentSort={sortField === "totalExperienceYears" ? (sortDirection === "asc" ? "totalExperienceYears" : "-totalExperienceYears") : ""}
              onSort={handleSort}
            >
              Experience &amp; Notice
            </SortableTH>
            <TH>Core Skills</TH>
            <TH align="center">Rating</TH>
            <TH align="center">Talent Pool</TH>
            <TH align="right">Actions</TH>
          </THead>
          <TBody>
            {loading ? (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <Loader2 className="size-5 animate-spin text-copper" />
                  <span className="text-xs text-muted-foreground">Loading candidates from database...</span>
                </div>
              </EmptyRow>
            ) : paginatedCandidates.length === 0 ? (
              <EmptyRow colSpan={7}>
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No candidates match your criteria.</p>
                  <Can permission="candidates.create">
                    <Link href="/candidates/new">
                      <Button size="xs" variant="outline" className="gap-1 text-xs">
                        <Plus className="size-3" />
                        <span>Add First Candidate</span>
                      </Button>
                    </Link>
                  </Can>
                </div>
              </EmptyRow>
            ) : (
              paginatedCandidates.map((cand) => (
                <TR key={cand.id}>
                  {/* Candidate */}
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      <button
                        onClick={() => handleViewDetails(cand.id)}
                        className="font-semibold text-xs text-foreground hover:text-copper transition-colors text-left block cursor-pointer"
                      >
                        {cand.fullName}
                      </button>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span className="flex items-center gap-1">
                          <Mail className="size-3 text-muted-foreground shrink-0" />
                          <span>{cand.email}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-copper shrink-0" />
                          <span>{cand.city || "San Francisco"}</span>
                        </span>
                      </div>
                    </div>
                  </TD>

                  {/* Current Role & Company */}
                  <TD>
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground text-xs">
                        {cand.currentDesignation || "Software Engineer"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {cand.currentCompany || "Enterprise Corp"}
                      </div>
                    </div>
                  </TD>

                  {/* Experience & Notice */}
                  <TD>
                    <div className="text-xs text-foreground font-medium">
                      {cand.totalExperienceYears || 3} yrs exp
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {cand.noticePeriodDays ? `${cand.noticePeriodDays} days notice` : "notice period not stated"}
                    </span>
                  </TD>

                  {/* Core Skills */}
                  <TD>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(cand.skills || []).slice(0, 3).map((skill: string) => (
                        <Badge
                          key={skill}
                          variant="outline"
                          className="px-1.5 py-0 text-[10px] text-muted-foreground bg-muted/40 border-border font-normal"
                        >
                          {skill}
                        </Badge>
                      ))}
                      {(cand.skills || []).length > 3 && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground px-1 py-0 border-border">
                          +{cand.skills.length - 3}
                        </Badge>
                      )}
                    </div>
                  </TD>

                  {/* Rating */}
                  <TD align="center">
                    <div className="inline-flex items-center gap-1 text-xs font-semibold text-foreground px-1.5 py-0.5 rounded-xs bg-muted/40">
                      <Star className="size-3 text-amber-500 fill-amber-500" />
                      <span>{cand.rating || "4.8"}</span>
                    </div>
                  </TD>

                  {/* Talent Pool Toggle */}
                  <TD align="center">
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={() => handleTogglePool(cand)}
                      title={cand.inTalentPool ? "In Talent Pool" : "Add to Talent Pool"}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      {cand.inTalentPool ? (
                        <>
                          <BookmarkCheck className="size-3.5 text-copper" />
                          <span className="text-[11px] text-copper font-semibold">Curated</span>
                        </>
                      ) : (
                        <>
                          <Bookmark className="size-3.5 text-muted-foreground" />
                          <span className="text-[11px] text-muted-foreground">Add to Pool</span>
                        </>
                      )}
                    </Button>
                  </TD>

                  {/* Actions */}
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        title="View Profile"
                        onClick={() => handleViewDetails(cand.id)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-copper"
                      >
                        <Eye className="size-3.5" />
                      </Button>

                      <Can permission="candidates.update">
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Edit Profile"
                          onClick={() => handleOpenEdit(cand)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Edit2 className="size-3.5" />
                        </Button>
                      </Can>

                      <Can permission="candidates.delete">
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Delete Candidate"
                          onClick={() => handleDelete(cand.id, cand.fullName)}
                          className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </Can>
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
          total={candidatesList.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          limitOptions={[10, 25, 50, 100]}
        />
      </TableShell>

      {/* Candidate Profile Details Modal */}
      <Dialog open={!!selectedCandidate} onOpenChange={(open) => !open && setSelectedCandidate(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-lg font-semibold flex items-center gap-2">
                  <span>{selectedCandidate?.fullName}</span>
                  <Badge variant="outline" className="text-[10px]">
                    {selectedCandidate?.rating} ★
                  </Badge>
                </DialogTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {selectedCandidate?.currentDesignation || "Applicant"} • {selectedCandidate?.currentCompany || "Previous Employer"}
                </div>
              </div>

              {/* Action Links: Resume, LinkedIn, GitHub */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedCandidate?.resumeUrl && (
                  <a
                    href={selectedCandidate.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="xs" variant="outline" className="h-7 text-xs gap-1.5 border-copper/30 text-copper hover:bg-copper/10">
                      <FileText className="size-3.5" />
                      <span>{selectedCandidate.resumeFileName || "View Resume / CV"}</span>
                      <ExternalLink className="size-3 opacity-60" />
                    </Button>
                  </a>
                )}
                {selectedCandidate?.linkedInUrl && (
                  <a
                    href={selectedCandidate.linkedInUrl.startsWith("http") ? selectedCandidate.linkedInUrl : `https://${selectedCandidate.linkedInUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="xs" variant="outline" className="h-7 text-xs gap-1 border-border hover:bg-muted/40">
                      <Linkedin className="size-3.5 text-[#0A66C2]" />
                      <span>LinkedIn</span>
                      <ExternalLink className="size-3 opacity-60" />
                    </Button>
                  </a>
                )}
                {selectedCandidate?.portfolioUrl && (
                  <a
                    href={selectedCandidate.portfolioUrl.startsWith("http") ? selectedCandidate.portfolioUrl : `https://${selectedCandidate.portfolioUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="xs" variant="outline" className="h-7 text-xs gap-1 border-border hover:bg-muted/40">
                      <Github className="size-3.5 text-foreground" />
                      <span>Portfolio / GitHub</span>
                      <ExternalLink className="size-3 opacity-60" />
                    </Button>
                  </a>
                )}
              </div>
            </div>
          </DialogHeader>

          {selectedCandidate && (
            <div className="space-y-4 py-2 text-xs">
              {/* Contact & Meta */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-muted/40 rounded-xs border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground">Email</div>
                  <div className="font-medium text-foreground truncate">{selectedCandidate.email}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Phone</div>
                  <div className="font-medium text-foreground">{selectedCandidate.phone || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Expected Comp</div>
                  <div className="font-medium text-foreground">
                    {selectedCandidate.expectedSalaryText || (selectedCandidate.expectedSalary ? `$${selectedCandidate.expectedSalary.toLocaleString()}` : "—")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Notice Period</div>
                  <div className="font-medium text-foreground">
                    {selectedCandidate.noticePeriodText || (selectedCandidate.noticePeriodDays ? `${selectedCandidate.noticePeriodDays} days` : "30 days")}
                  </div>
                </div>
              </div>

              {/* Professional Background */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 p-3 bg-card rounded-xs border border-border">
                <div>
                  <div className="text-[10px] text-muted-foreground">Current Company</div>
                  <div className="font-medium text-foreground">{selectedCandidate.currentCompany || "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Total Experience</div>
                  <div className="font-medium text-foreground">
                    {selectedCandidate.totalExperienceText || (selectedCandidate.totalExperienceYears ? `${selectedCandidate.totalExperienceYears} yrs` : "—")}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Location</div>
                  <div className="font-medium text-foreground">
                    {selectedCandidate.city || "San Francisco"}{selectedCandidate.country ? `, ${selectedCandidate.country}` : ""}
                  </div>
                </div>
              </div>

              {/* Skills */}
              <div className="space-y-1.5">
                <div className="font-medium text-foreground">Skills &amp; Competencies</div>
                <div className="flex flex-wrap gap-1">
                  {(selectedCandidate.skills || []).map((s: string) => (
                    <Badge key={s} variant="outline" className="text-[11px] font-normal">
                      {s}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Cover Letter / Introduction Note */}
              {(selectedCandidate.coverLetter || selectedCandidate.notes) && (
                <div className="space-y-1.5 p-3 rounded-xs border border-border bg-muted/20">
                  <div className="font-semibold text-foreground text-xs">Introduction Note / Cover Letter</div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {selectedCandidate.coverLetter || selectedCandidate.notes}
                  </p>
                </div>
              )}

              {/* Work History */}
              {selectedCandidate.experienceHistory?.length > 0 && (
                <div className="space-y-2">
                  <div className="font-medium text-foreground">Experience History</div>
                  <div className="space-y-1.5">
                    {selectedCandidate.experienceHistory.map((exp: any, i: number) => (
                      <div key={i} className="p-2.5 rounded-xs border border-border bg-card">
                        <div className="font-semibold text-foreground text-xs">{exp.role}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {exp.company} • {exp.duration}
                        </div>
                        {exp.highlights && (
                          <p className="text-[11px] text-muted-foreground mt-1">{exp.highlights}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setSelectedCandidate(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Candidate Modal */}
      <Dialog open={!!editingCandidate} onOpenChange={(open) => !open && setEditingCandidate(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Edit Candidate Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="field-label">Full Name</label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Email</label>
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="field-label">Current Role</label>
                <Input
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. Senior Backend Engineer"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Current Company</label>
                <Input
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. Acme Technologies"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="field-label">Total Exp</label>
                <Input
                  value={editExp}
                  onChange={(e) => setEditExp(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 4 Years"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Expected Salary</label>
                <Input
                  value={editSalary}
                  onChange={(e) => setEditSalary(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. ₹20L / year"
                />
              </div>
              <div className="space-y-1">
                <label className="field-label">Notice Period</label>
                <Input
                  value={editNotice}
                  onChange={(e) => setEditNotice(e.target.value)}
                  className="h-8 text-xs"
                  placeholder="e.g. 30 Days"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="field-label">LinkedIn Profile URL</label>
              <Input
                value={editLinkedIn}
                onChange={(e) => setEditLinkedIn(e.target.value)}
                className="h-8 text-xs"
                placeholder="https://linkedin.com/in/rahul"
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">Portfolio / GitHub URL</label>
              <Input
                value={editPortfolio}
                onChange={(e) => setEditPortfolio(e.target.value)}
                className="h-8 text-xs"
                placeholder="https://github.com/rahulsharma"
              />
            </div>

            <div className="space-y-1">
              <label className="field-label">Resume / CV Document URL</label>
              <Input
                value={editResume}
                onChange={(e) => setEditResume(e.target.value)}
                className="h-8 text-xs"
                placeholder="https://drive.google.com/file/... or /uploads/resumes/..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setEditingCandidate(null)}>
              Cancel
            </Button>
            <Button
              size="xs"
              variant="accent"
              disabled={isSaving}
              onClick={handleSaveEdit}
              className="gap-1"
            >
              {isSaving ? <Loader2 className="size-3 animate-spin" /> : null}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CandidatesPage() {
  return (
    <Suspense
      fallback={
        <div className="page flex items-center justify-center p-12">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin text-copper" />
            <span>Loading candidates directory...</span>
          </div>
        </div>
      }
    >
      <CandidatesContent />
    </Suspense>
  );
}
