"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CursorPager, PageHeader, StateBadge } from "@/components/console/primitives";
import { EmptyState, ProblemView, TableSkeleton } from "@/components/console/states";
import { formatDate, formatMoney, formatNumber } from "@/lib/format";
import type { AdminCompany, Plan } from "@/lib/types";
import { useCursorList } from "@/lib/use-cursor-list";
import { useResource } from "@/lib/use-resource";

const COMPANY_STATES = ["pending", "active", "suspended", "rejected", "deleted"];

export function CompaniesClient({
  initialState,
  initialPlan,
  initialSearch,
}: {
  initialState: string;
  initialPlan: string;
  initialSearch: string;
}) {
  const searchId = useId();
  const stateId = useId();
  const planId = useId();

  const [state, setState] = useState(initialState);
  const [plan, setPlan] = useState(initialPlan);
  // Two pieces of state: what is typed, and what has been submitted. Searching
  // on every keystroke would page the list out from under the operator.
  const [searchInput, setSearchInput] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);

  // The plan filter takes a plan id, which no human knows by heart; the
  // catalogue turns it into a list of names.
  const plans = useResource<{ items: Plan[] }>("/plans?limit=100");

  const query = useMemo(() => ({ state, plan, q: search }), [state, plan, search]);
  const list = useCursorList<AdminCompany>("/admin/companies", query);

  return (
    <>
      <PageHeader
        title="Companies"
        description="Every tenant on the platform, with its subscription, last payment and open tickets."
      />

      <form
        className="surface flex flex-wrap items-end gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(searchInput.trim());
        }}
        role="search"
      >
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label htmlFor={searchId}>Search</Label>
          <Input
            id={searchId}
            type="search"
            placeholder="Name, slug or contact email"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={stateId}>State</Label>
          <select
            id={stateId}
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="h-9 w-40 rounded-xs border border-input bg-background px-3 text-sm"
          >
            <option value="">All states</option>
            {COMPANY_STATES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={planId}>Plan</Label>
          <select
            id={planId}
            value={plan}
            onChange={(event) => setPlan(event.target.value)}
            className="h-9 w-48 rounded-xs border border-input bg-background px-3 text-sm"
          >
            <option value="">All plans</option>
            {(plans.data?.items ?? []).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <Button type="submit" size="sm">
          <Search aria-hidden />
          Apply
        </Button>
        {(state || plan || search) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setState("");
              setPlan("");
              setSearch("");
              setSearchInput("");
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {list.loading && list.items.length === 0 ? <TableSkeleton rows={8} columns={6} /> : null}

      {list.error ? <ProblemView problem={list.error} onRetry={list.reload} /> : null}

      {!list.loading && !list.error && list.items.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" aria-hidden />}
          title="No companies match"
          description={
            state || plan || search
              ? "Nothing matched these filters. Widen them and try again."
              : "No company has registered yet."
          }
        />
      ) : null}

      {list.items.length > 0 ? (
        <div className="surface overflow-x-auto">
          <Table>
            <caption className="sr-only">Companies on the platform</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Company</TableHead>
                <TableHead scope="col">State</TableHead>
                <TableHead scope="col">Subscription</TableHead>
                <TableHead scope="col">Last payment</TableHead>
                <TableHead scope="col" className="text-right">
                  Usage
                </TableHead>
                <TableHead scope="col" className="text-right">
                  Tickets
                </TableHead>
                <TableHead scope="col">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((company) => (
                <TableRow key={company.id}>
                  <TableCell>
                    <Link
                      href={`/companies/${company.id}`}
                      className="font-medium underline-offset-2 hover:underline"
                    >
                      {company.name || company.slug}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {company.slug}
                      {company.country ? ` · ${company.country}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StateBadge state={company.state} />
                  </TableCell>
                  <TableCell>
                    {company.subscription ? (
                      <div className="space-y-0.5">
                        <div className="text-sm">
                          {company.subscription.planName || company.subscription.planId}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <StateBadge state={company.subscription.state} />
                          {formatMoney(
                            company.subscription.price.amountMinor,
                            company.subscription.price.currency,
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">No subscription</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {company.lastPayment ? (
                      <div className="space-y-0.5">
                        <div className="tabular text-sm">
                          {formatMoney(company.lastPayment.amountMinor, company.lastPayment.currency)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDate(company.lastPayment.paidAt)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right text-sm">
                    {formatNumber(company.usage.publishedJobs)} jobs
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(company.usage.applications)} applications
                    </div>
                  </TableCell>
                  <TableCell className="tabular text-right text-sm">
                    {company.openTickets > 0 ? (
                      <span className="font-medium text-warning">{company.openTickets}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(company.registeredAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CursorPager
        history={list.history}
        nextCursor={list.nextCursor}
        onBack={list.back}
        onNext={list.next}
        loading={list.loading}
        count={list.items.length}
      />
    </>
  );
}
