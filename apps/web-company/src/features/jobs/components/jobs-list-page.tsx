"use client";

import Link from "next/link";
import { useState, useEffect, useMemo, Suspense } from "react";
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
  Users,
  Building2,
  ExternalLink,
  MapPin,
  Loader2,
  Copy,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
  Briefcase,
  DollarSign,
  Laptop,
} from "lucide-react";
import { getJobs, updateJob, deleteJob, duplicateJob } from "@/features/jobs/server/actions";
import { Can } from "@/components/rbac/can";
import { toast } from "sonner";

function JobsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");

  const normalizeStatus = (s: string | null): string => {
    if (!s || s === "all") return "all";
    if (s === "published" || s === "open") return "published";
    if (s === "draft") return "draft";
    if (s === "on_hold") return "on_hold";
    if (s === "closed") return "closed";
    return "all";
  };

  const [filter, setFilter] = useState(normalizeStatus(statusParam));
  const [searchQuery, setSearchQuery] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting and Client Pagination
  const [sortField, setSortField] = useState<string>("title");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await getJobs({
        status: filter === "all" ? undefined : filter,
        search: searchQuery || undefined,
      });
      setJobs(data);
      setPage(1);
    } catch (error) {
      console.error("Failed to load jobs:", error);
      toast.error("Failed to load job openings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFilter(normalizeStatus(statusParam));
  }, [statusParam]);

  useEffect(() => {
    loadJobs();
  }, [filter, searchQuery]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    const targetUrl = newFilter === "all" ? "/jobs" : `/jobs?status=${newFilter}`;
    router.replace(targetUrl);
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;
    try {
      await deleteJob(id);
      toast.success(`Deleted job: ${title}`);
      await loadJobs();
    } catch {
      toast.error("Failed to delete job");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await duplicateJob(id);
      toast.success("Job duplicated as draft!");
      await loadJobs();
    } catch {
      toast.error("Failed to duplicate job");
    }
  };

  const handleQuickStatusChange = async (id: string, status: any) => {
    try {
      await updateJob(id, { status });
      toast.success(`Job marked as ${status}`);
      await loadJobs();
    } catch {
      toast.error("Failed to change status");
    }
  };

  const handleSort = (field: string, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Processed sorted & paginated jobs
  const sortedJobs = useMemo(() => {
    return [...jobs].sort((a, b) => {
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
  }, [jobs, sortField, sortDirection]);

  const paginatedJobs = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedJobs.slice(from, from + pageSize);
  }, [sortedJobs, page, pageSize]);

  return (
    <div className="page space-y-4">
      <PageHeader
        title="Job Openings &amp; Requisitions"
        description="Create, publish, and manage hiring requisitions across global departments."
        actions={
          <Can permission="jobs.create">
            <Link href="/jobs/new">
              <Button size="sm" variant="accent" className="gap-1 text-xs">
                <Plus className="size-3.5" />
                <span>Create Requisition</span>
              </Button>
            </Link>
          </Can>
        }
      />

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-4 border-b border-border w-fit overflow-x-auto">
          {[
            { id: "all", label: "All Openings" },
            { id: "published", label: "Published" },
            { id: "draft", label: "Drafts" },
            { id: "on_hold", label: "On Hold" },
            { id: "closed", label: "Closed" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleFilterChange(tab.id)}
              className={cn(
                "text-xs py-2 px-1 font-medium transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer",
                filter === tab.id
                  ? "border-copper text-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search requisition or code..."
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
              field="title"
              currentSort={sortField === "title" ? (sortDirection === "asc" ? "title" : "-title") : ""}
              onSort={handleSort}
            >
              Job Title &amp; Ref
            </SortableTH>
            <TH>Department</TH>
            <TH>Location &amp; Work Mode</TH>
            <SortableTH
              field="salaryMin"
              currentSort={sortField === "salaryMin" ? (sortDirection === "asc" ? "salaryMin" : "-salaryMin") : ""}
              onSort={handleSort}
            >
              Salary Range
            </SortableTH>
            <TH align="center">Applicants</TH>
            <TH>Status</TH>
            <TH align="right">Actions</TH>
          </THead>
          <TBody>
            {loading ? (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <Loader2 className="size-5 animate-spin text-copper" />
                  <span className="text-xs text-muted-foreground">Loading requisitions...</span>
                </div>
              </EmptyRow>
            ) : paginatedJobs.length === 0 ? (
              <EmptyRow colSpan={7}>
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No job requisitions match your criteria.</p>
                  <Can permission="jobs.create">
                    <Link href="/jobs/new">
                      <Button size="xs" variant="outline" className="gap-1 text-xs">
                        <Plus className="size-3" />
                        <span>Post First Requisition</span>
                      </Button>
                    </Link>
                  </Can>
                </div>
              </EmptyRow>
            ) : (
              paginatedJobs.map((job) => (
                <TR key={job.id} muted={job.status === "closed"}>
                  {/* Job Title & Ref */}
                  <TD>
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/jobs/${job.id}/edit`}
                        className="font-semibold text-xs text-foreground hover:text-copper transition-colors"
                      >
                        {job.title}
                      </Link>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        {job.reqCode && (
                          <span className="text-[10px] text-muted-foreground">
                            {job.reqCode}
                          </span>
                        )}
                        <span>•</span>
                        <span className="capitalize">{job.employmentType?.replace(/_/g, " ")}</span>
                        {job.experienceLevel && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{job.experienceLevel.replace(/_/g, " ")}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </TD>

                  {/* Department */}
                  <TD>
                    <div className="flex items-center gap-1.5 text-xs text-foreground">
                      <Building2 className="size-3 text-copper shrink-0" />
                      <span>{job.departmentName || "Engineering"}</span>
                    </div>
                  </TD>

                  {/* Location & Work Mode */}
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3 text-copper shrink-0" />
                        <span>{job.locationName || job.locationText || "Remote"}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold border-border bg-card px-1.5 py-0">
                        {job.workMode?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </TD>

                  {/* Compensation Band */}
                  <TD>
                    {job.salaryMin ? (
                      <span className="text-xs font-medium text-foreground">
                        {job.currency || "$"}{(job.salaryMin || 0).toLocaleString()} – {(job.salaryMax || 0).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">—</span>
                    )}
                  </TD>

                  {/* Applicants */}
                  <TD align="center">
                    <Link
                      href={`/applications?jobId=${job.id}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-xs bg-muted/60 hover:bg-copper/10 hover:text-copper transition-colors text-xs font-medium"
                    >
                      <Users className="size-3 text-muted-foreground" />
                      <span className="font-semibold">{job.applicantCount || 0}</span>
                    </Link>
                  </TD>

                  {/* Status */}
                  <TD>
                    <StatusBadge status={job.status} />
                  </TD>

                  {/* Actions */}
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      {job.status === "published" && (
                        <Link href={`/careers/apply/${job.id}`} target="_blank">
                          <Button
                            size="xs"
                            variant="ghost"
                            title="View on Careers"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-copper"
                          >
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </Link>
                      )}

                      <Can permission="jobs.publish">
                        {job.status === "published" ? (
                          <Button
                            size="xs"
                            variant="ghost"
                            title="Close Requisition"
                            onClick={() => handleQuickStatusChange(job.id, "closed")}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          >
                            <XCircle className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="ghost"
                            title="Publish Requisition"
                            onClick={() => handleQuickStatusChange(job.id, "published")}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-600"
                          >
                            <CheckCircle2 className="size-3.5" />
                          </Button>
                        )}
                      </Can>

                      <Can permission="jobs.duplicate">
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Duplicate Job"
                          onClick={() => handleDuplicate(job.id)}
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      </Can>

                      {/* Direct Edit Page Link */}
                      <Can permission="jobs.update">
                        <Link href={`/jobs/${job.id}/edit`}>
                          <Button
                            size="xs"
                            variant="ghost"
                            title="Edit Full Requisition"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-copper"
                          >
                            <Edit2 className="size-3.5" />
                          </Button>
                        </Link>
                      </Can>

                      <Can permission="jobs.delete">
                        <Button
                          size="xs"
                          variant="ghost"
                          title="Delete Job"
                          onClick={() => handleDelete(job.id, job.title)}
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
          total={jobs.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          limitOptions={[10, 25, 50, 100]}
        />
      </TableShell>
    </div>
  );
}

export function JobsListPage() {
  return (
    <Suspense
      fallback={
        <div className="page flex items-center justify-center p-12">
          <Loader2 className="size-6 animate-spin text-copper" />
        </div>
      }
    >
      <JobsContent />
    </Suspense>
  );
}
