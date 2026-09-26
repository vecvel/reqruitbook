"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
  Plus,
  UserCheck,
  Send,
  Loader2,
  Eye,
  CheckCircle2,
  RefreshCw,
  Gift,
  Building,
  DollarSign,
  Calendar,
  Zap,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { getOffers, updateOfferStatus, syncOfferToHRM, deleteOffer } from "@/features/offers/server/actions";
import { Can } from "@/components/rbac/can";

function OffersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusParam = searchParams.get("status");

  const normalizeStatus = (s: string | null): string => {
    if (!s || s === "all") return "all";
    if (s === "draft") return "draft";
    if (s === "pending_approval") return "pending_approval";
    if (s === "approved") return "approved";
    if (s === "sent") return "sent";
    if (s === "accepted") return "accepted";
    if (s === "declined") return "declined";
    return "all";
  };

  const [filter, setFilter] = useState(normalizeStatus(statusParam));
  const [offersList, setOffersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting & Client Pagination
  const [sortField, setSortField] = useState<string>("candidateName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Offer Letter Preview Modal
  const [previewOffer, setPreviewOffer] = useState<any>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await getOffers({
        status: filter === "all" ? undefined : filter,
      });
      setOffersList(data);
      setPage(1);
    } catch (err) {
      console.error("Failed to load offers:", err);
      toast.error("Failed to load offers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setFilter(normalizeStatus(statusParam));
  }, [statusParam]);

  useEffect(() => {
    loadData();
  }, [filter]);

  const handleFilterChange = (newFilter: string) => {
    setFilter(newFilter);
    const targetUrl = newFilter === "all" ? "/offers" : `/offers?status=${newFilter}`;
    router.replace(targetUrl);
  };

  const handleStatusChange = async (id: string, newStatus: any) => {
    try {
      await updateOfferStatus(id, newStatus);
      toast.success(`Offer marked as ${newStatus.replace("_", " ").toUpperCase()}`);
      await loadData();
    } catch {
      toast.error("Failed to update offer status");
    }
  };

  const handleTriggerHrmSync = async (offer: any) => {
    setSyncingId(offer.id);
    try {
      await syncOfferToHRM(offer.id);

      toast.success(
        `🎉 ${offer.candidateName} successfully synchronized to HRM! Employee record provisioned.`,
      );
      await loadData();
    } catch (err: any) {
      toast.error(err.message || "Failed to synchronize offer with HRM");
    } finally {
      setSyncingId(null);
    }
  };

  const handleSort = (field: string, direction: "asc" | "desc") => {
    setSortField(field);
    setSortDirection(direction);
  };

  // Processed sorted & paginated offers
  const sortedOffers = useMemo(() => {
    return [...offersList].sort((a, b) => {
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
  }, [offersList, sortField, sortDirection]);

  const paginatedOffers = useMemo(() => {
    const from = (page - 1) * pageSize;
    return sortedOffers.slice(from, from + pageSize);
  }, [sortedOffers, page, pageSize]);

  return (
    <div className="page space-y-4">
      <PageHeader
        title="Offer Management &amp; HRM Synchronization"
        description="Draft compensation packages, route approvals, send offer letters, and auto-onboard accepted hires directly into HRM."
        actions={
          <Can permission="offers.create">
            <Link href="/offers/new">
              <Button size="sm" variant="accent" className="gap-1 text-xs">
                <Plus className="size-3.5" />
                <span>Create Offer Package</span>
              </Button>
            </Link>
          </Can>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-border w-fit overflow-x-auto">
        {[
          { id: "all", label: "All Offers" },
          { id: "draft", label: "Drafts" },
          { id: "pending_approval", label: "Pending Approval" },
          { id: "approved", label: "Approved" },
          { id: "sent", label: "Sent to Candidate" },
          { id: "accepted", label: "Accepted & HRM Synced" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleFilterChange(tab.id)}
            className={cn(
              "text-xs py-2 px-1 font-medium transition-all border-b-2 -mb-px whitespace-nowrap cursor-pointer",
              filter === tab.id
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
              Candidate &amp; Role
            </SortableTH>
            <TH>Department</TH>
            <SortableTH
              field="baseSalary"
              currentSort={sortField === "baseSalary" ? (sortDirection === "asc" ? "baseSalary" : "-baseSalary") : ""}
              onSort={handleSort}
            >
              Base Salary
            </SortableTH>
            <TH>Target Joining Date</TH>
            <TH>Status</TH>
            <TH>HRM Sync</TH>
            <TH align="right">Actions</TH>
          </THead>
          <TBody>
            {loading ? (
              <EmptyRow colSpan={7}>
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <Loader2 className="size-5 animate-spin text-copper" />
                  <span className="text-xs text-muted-foreground">Loading offers from database...</span>
                </div>
              </EmptyRow>
            ) : paginatedOffers.length === 0 ? (
              <EmptyRow colSpan={7}>
                <div className="py-6 text-center space-y-2">
                  <p className="text-xs text-muted-foreground">No offers found matching your filter.</p>
                  <Can permission="offers.create">
                    <Link href="/offers/new">
                      <Button size="xs" variant="outline" className="gap-1 text-xs">
                        <Plus className="size-3" />
                        <span>Create First Offer Package</span>
                      </Button>
                    </Link>
                  </Can>
                </div>
              </EmptyRow>
            ) : (
              paginatedOffers.map((off) => (
                <TR key={off.id}>
                  {/* Candidate & Role */}
                  <TD>
                    <div>
                      <span className="font-semibold text-foreground text-xs block">
                        {off.candidateName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {off.designation}
                      </span>
                    </div>
                  </TD>

                  {/* Department */}
                  <TD>
                    <div className="text-xs text-foreground font-medium">
                      {off.departmentName}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Manager: {off.reportingManager || "Department Lead"}
                    </span>
                  </TD>

                  {/* Base Salary */}
                  <TD>
                    <Can
                      permission="offers.view_compensation"
                      fallback={<span className="text-[11px] text-muted-foreground italic">Confidential</span>}
                    >
                      <span className="text-xs font-medium text-foreground">
                        ${(off.baseSalary || 0).toLocaleString()} {off.currency}
                      </span>
                    </Can>
                  </TD>

                  {/* Joining Date */}
                  <TD>
                    <div className="flex items-center gap-1 text-xs text-foreground">
                      <Calendar className="size-3 text-copper shrink-0" />
                      <span>{off.joiningDate}</span>
                    </div>
                  </TD>

                  {/* Status */}
                  <TD>
                    <StatusBadge status={off.status} />
                  </TD>

                  {/* HRM Sync */}
                  <TD>
                    {off.hrmSynced ? (
                      <Badge variant="soft-success" className="gap-1 text-[10px]">
                        <CheckCircle2 className="size-3" />
                        <span>HRM Synced</span>
                      </Badge>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        Not Synced
                      </span>
                    )}
                  </TD>

                  {/* Actions */}
                  <TD align="right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="xs"
                        variant="ghost"
                        title="Preview Offer Letter"
                        onClick={() => setPreviewOffer(off)}
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-copper"
                      >
                        <Eye className="size-3.5" />
                      </Button>

                      {off.status === "draft" && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleStatusChange(off.id, "pending_approval")}
                          className="h-7 px-2 text-[11px]"
                        >
                          Request Approval
                        </Button>
                      )}

                      {off.status === "pending_approval" && (
                        <Can permission="offers.approve">
                          <Button
                            size="xs"
                            variant="accent"
                            onClick={() => handleStatusChange(off.id, "approved")}
                            className="h-7 px-2 text-[11px] gap-1"
                          >
                            <CheckCircle2 className="size-3" />
                            <span>Approve</span>
                          </Button>
                        </Can>
                      )}

                      {off.status === "approved" && (
                        <Button
                          size="xs"
                          variant="accent"
                          onClick={() => handleStatusChange(off.id, "sent")}
                          className="h-7 px-2 text-[11px] gap-1"
                        >
                          <Send className="size-3" />
                          <span>Send</span>
                        </Button>
                      )}

                      {off.status === "sent" && (
                        <Button
                          size="xs"
                          variant="accent"
                          onClick={() => handleStatusChange(off.id, "accepted")}
                          className="h-7 px-2 text-[11px] gap-1"
                        >
                          <CheckCircle2 className="size-3" />
                          <span>Accept</span>
                        </Button>
                      )}

                      {/* Direct HRM Sync Trigger */}
                      {off.status === "accepted" && !off.hrmSynced && (
                        <Can permission="offers.sync_hrm">
                          <Button
                            size="xs"
                            variant="accent"
                            disabled={syncingId === off.id}
                            onClick={() => handleTriggerHrmSync(off)}
                            className="h-7 px-2.5 text-[11px] gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            {syncingId === off.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <Zap className="size-3" />
                            )}
                            <span>Sync to HRM</span>
                          </Button>
                        </Can>
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
          total={offersList.length}
          onPageChange={setPage}
          onLimitChange={setPageSize}
          limitOptions={[10, 25, 50, 100]}
        />
      </TableShell>

      {/* Offer Letter Preview Modal */}
      <Dialog open={!!previewOffer} onOpenChange={(open) => !open && setPreviewOffer(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center justify-between">
              <span>Formal Employment Offer Letter</span>
              <StatusBadge status={previewOffer?.status || "draft"} />
            </DialogTitle>
            <div className="text-xs text-muted-foreground">
              Candidate: {previewOffer?.candidateName} • Position: {previewOffer?.designation}
            </div>
          </DialogHeader>

          {previewOffer && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-4 bg-muted/30 rounded-xs border border-border space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div>
                    <span className="font-bold text-sm text-foreground uppercase">
                      My Organisation
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Formal Employment Offer Package • {previewOffer.templateType?.toUpperCase() || "STANDARD"}
                    </span>
                  </div>
                  <Button
                    size="xs"
                    variant="outline"
                    onClick={() => window.print()}
                    className="gap-1 text-xs h-7"
                  >
                    <span>Print Package</span>
                  </Button>
                </div>

                <p className="text-foreground leading-relaxed">
                  Dear <strong>{previewOffer.candidateName}</strong>,
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  We are pleased to extend this formal offer of employment for the position of{" "}
                  <strong className="text-foreground">{previewOffer.designation}</strong>{" "}
                  {previewOffer.gradeLevel ? `(${previewOffer.gradeLevel})` : ""} in our{" "}
                  <strong className="text-foreground">{previewOffer.departmentName}</strong> team.
                </p>

                {/* Compensation Structure */}
                <div className="p-3 bg-card rounded-xs border border-border space-y-1.5">
                  {/*
                    Guarded like the list column is. The offers service omits
                    every money field for a reader without this permission, so
                    without the guard `baseSalary || 0` renders a confident
                    "USD 0" — which is a worse answer than saying nothing, since
                    a reader has no way to tell it apart from a real zero.
                  */}
                  <Can
                    permission="offers.view_compensation"
                    fallback={
                      <div className="text-[11px] italic text-muted-foreground">
                        Compensation is confidential and hidden from your role.
                      </div>
                    }
                  >
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Compensation:</span>
                    <span className="font-semibold text-foreground">
                      {previewOffer.currency} {(previewOffer.baseSalary ?? 0).toLocaleString()} / {previewOffer.payFrequency || "annual"}
                    </span>
                  </div>
                  {previewOffer.signOnBonus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sign-On Bonus:</span>
                      <span className="font-semibold text-emerald-600">
                        {previewOffer.currency} {Number(previewOffer.signOnBonus).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {previewOffer.annualBonus && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Performance Bonus:</span>
                      <span className="font-medium text-foreground">{previewOffer.annualBonus}</span>
                    </div>
                  )}
                  {previewOffer.equityShares && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Equity Grant:</span>
                      <span className="font-medium text-foreground">{previewOffer.equityShares}</span>
                    </div>
                  )}
                  </Can>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Start / Joining Date:</span>
                    <span className="font-medium text-foreground">{previewOffer.joiningDate}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Work Location &amp; Mode:</span>
                    <span className="text-foreground">{previewOffer.workLocation || "San Francisco HQ / Hybrid"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Reporting Manager:</span>
                    <span className="text-foreground">{previewOffer.reportingManager || "Department Head"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Probation / Notice:</span>
                    <span className="text-foreground">
                      {previewOffer.probationPeriod || "90 Days"} / {previewOffer.noticePeriod || "30 Days"}
                    </span>
                  </div>
                </div>

                {/* Benefits */}
                <div className="space-y-1">
                  <div className="font-semibold text-[11px] text-foreground">Benefits &amp; Leave:</div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {previewOffer.benefitsSummary || "Comprehensive Health, Dental, Vision, 401(k) Match, $3,000 Annual Learning Budget."}
                  </p>
                </div>

                {/* Custom Fields */}
                {previewOffer.customFields && Array.isArray(previewOffer.customFields) && previewOffer.customFields.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-border/60">
                    <div className="font-semibold text-[11px] text-foreground">Special Custom Provisions:</div>
                    <div className="space-y-1">
                      {previewOffer.customFields.map((f: any, idx: number) => (
                        <div key={idx} className="text-[11px] flex items-start gap-1.5">
                          <span className="font-semibold text-copper shrink-0">• {f.key}:</span>
                          <span className="text-foreground">{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="xs" variant="outline" onClick={() => setPreviewOffer(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function OffersPage() {
  return (
    <Suspense fallback={<div className="page p-8 text-xs text-muted-foreground">Loading offers...</div>}>
      <OffersContent />
    </Suspense>
  );
}
