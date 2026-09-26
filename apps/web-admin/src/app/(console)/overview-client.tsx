"use client";

import Link from "next/link";
import { Info, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CardSkeleton, EmptyState, ProblemView } from "@/components/console/states";
import { PageHeader, StatTile, StateBadge } from "@/components/console/primitives";
import { formatDateTime, formatMoney, formatNumber, formatRelative, humanise } from "@/lib/format";
import { useResource } from "@/lib/use-resource";

interface Overview {
  generatedAt: string;
  staleAfter: string;
  projectionUpToDate: string | null;
  companies: { total: number; byState: { state: string; count: number }[] };
  subscriptions: { billableTotal: number; byPlan: { planId: string; planName: string; count: number }[] };
  mrr: {
    byCurrency: { currency: string; monthlyMinor: number; subscriptions: number }[];
    nonRecurring: { subscriptions: number; byCurrency: { currency: string; totalMinor: number }[] };
    unnormalised: { subscriptions: number };
    normalisation: string[];
  };
  signups: { days: number; points: { date: string; count: number }[]; total: number };
  candidates: { total: number };
  jobs: { published: number };
  applications: { total: number };
  support: { openTickets: number };
}

export function OverviewClient() {
  const { data, loading, error, reload } = useResource<Overview>("/admin/overview");

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Tenants, revenue and workload across the whole platform."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw aria-hidden className={loading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        }
      />

      {loading && !data ? <CardSkeleton count={4} /> : null}

      {error ? <ProblemView problem={error} onRetry={reload} /> : null}

      {data ? (
        <div className="space-y-6">
          <section aria-labelledby="headline-figures" className="space-y-3">
            <h2 id="headline-figures" className="section-title">
              Headline
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatTile
                label="Companies"
                value={formatNumber(data.companies.total)}
                hint={`${formatNumber(data.signups.total)} signed up in the last ${data.signups.days} days`}
              />
              <StatTile
                label="Billable subscriptions"
                value={formatNumber(data.subscriptions.billableTotal)}
                hint={`${data.subscriptions.byPlan.length} plan${data.subscriptions.byPlan.length === 1 ? "" : "s"} in use`}
              />
              <StatTile
                label="Candidates"
                value={formatNumber(data.candidates.total)}
                hint={`${formatNumber(data.applications.total)} applications`}
              />
              <StatTile
                label="Open tickets"
                value={formatNumber(data.support.openTickets)}
                tone={data.support.openTickets > 0 ? "warning" : "default"}
                hint={<Link href="/support" className="underline underline-offset-2">Go to the support desk</Link>}
              />
            </div>
          </section>

          <MrrSection mrr={data.mrr} />

          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-labelledby="companies-by-state" className="surface p-4">
              <h2 id="companies-by-state" className="section-title mb-3">
                Companies by state
              </h2>
              {data.companies.byState.length === 0 ? (
                <p className="text-sm text-muted-foreground">No companies yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.companies.byState.map((row) => (
                    <li key={row.state} className="flex items-center justify-between gap-3">
                      <Link
                        href={`/companies?state=${encodeURIComponent(row.state)}`}
                        className="rounded-xs focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <StateBadge state={row.state} />
                      </Link>
                      <span className="tabular text-sm font-medium">{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="subs-by-plan" className="surface p-4">
              <h2 id="subs-by-plan" className="section-title mb-3">
                Active subscriptions by plan
              </h2>
              {data.subscriptions.byPlan.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing is subscribed yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.subscriptions.byPlan.map((row) => (
                    <li key={row.planId} className="flex items-center justify-between gap-3">
                      <Link
                        href={`/subscriptions?plan=${encodeURIComponent(row.planId)}`}
                        className="truncate text-sm underline-offset-2 hover:underline"
                      >
                        {/* The projection does not always carry the plan's name;
                            showing the id beats showing an empty cell. */}
                        {row.planName || row.planId}
                      </Link>
                      <span className="tabular text-sm font-medium">{formatNumber(row.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <SignupsSection signups={data.signups} />

          <section aria-labelledby="platform-activity" className="grid gap-3 sm:grid-cols-3">
            <h2 id="platform-activity" className="sr-only">
              Platform activity
            </h2>
            <StatTile label="Published jobs" value={formatNumber(data.jobs.published)} />
            <StatTile label="Applications" value={formatNumber(data.applications.total)} />
            <StatTile
              label="Projection up to"
              value={
                <span className="text-base font-medium">
                  {data.projectionUpToDate ? formatRelative(data.projectionUpToDate) : "—"}
                </span>
              }
              hint="The last event the read model has consumed"
            />
          </section>

          <p className="text-xs text-muted-foreground">
            Generated {formatDateTime(data.generatedAt)} · considered fresh until{" "}
            {formatDateTime(data.staleAfter)}.
          </p>
        </div>
      ) : null}

      {!loading && !error && !data ? (
        <EmptyState
          title="No overview available"
          description="The admin service returned nothing to show."
        />
      ) : null}
    </>
  );
}

/**
 * MRR, with the arithmetic behind it on the page.
 *
 * The service normalises multi-month plans, excludes lifetime ones and refuses
 * to combine currencies; it returns those rules in `normalisation` precisely so
 * a console does not present one number whose meaning nobody can reconstruct.
 * They are rendered, not summarised, because a paraphrase of a revenue
 * definition is how two teams end up quoting different figures.
 */
function MrrSection({ mrr }: { mrr: Overview["mrr"] }) {
  const hasRecurring = mrr.byCurrency.length > 0;

  return (
    <section aria-labelledby="mrr" className="surface space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="mrr" className="section-title">
          Monthly recurring revenue
        </h2>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="rounded-xs text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="How MRR is calculated"
              >
                <Info className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              Currencies are never combined and lifetime plans are excluded. The full rules are
              listed below the figures.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {hasRecurring ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {mrr.byCurrency.map((row) => (
            <StatTile
              key={row.currency}
              label={`MRR · ${row.currency}`}
              value={formatMoney(row.monthlyMinor, row.currency)}
              tone="accent"
              hint={`${formatNumber(row.subscriptions)} subscription${row.subscriptions === 1 ? "" : "s"}`}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No recurring subscriptions are contributing to MRR yet.
        </p>
      )}

      {(mrr.nonRecurring.subscriptions > 0 || mrr.unnormalised.subscriptions > 0) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {mrr.nonRecurring.subscriptions > 0 ? (
            <div className="surface-muted p-3">
              <p className="field-label">Excluded · lifetime and one-off</p>
              <p className="tabular text-sm">
                {formatNumber(mrr.nonRecurring.subscriptions)} subscription
                {mrr.nonRecurring.subscriptions === 1 ? "" : "s"}
                {mrr.nonRecurring.byCurrency.length > 0
                  ? ` · ${mrr.nonRecurring.byCurrency
                      .map((row) => formatMoney(row.totalMinor, row.currency))
                      .join(", ")} collected`
                  : ""}
              </p>
            </div>
          ) : null}
          {mrr.unnormalised.subscriptions > 0 ? (
            <div className="surface-muted p-3">
              <p className="field-label">Excluded · period is not whole months</p>
              <p className="tabular text-sm">
                {formatNumber(mrr.unnormalised.subscriptions)} subscription
                {mrr.unnormalised.subscriptions === 1 ? "" : "s"} counted separately rather than
                approximated
              </p>
            </div>
          ) : null}
        </div>
      )}

      <details className="group">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
          How this figure is calculated
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          {mrr.normalisation.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

/** Signups over time, as a bar chart drawn from the tokens rather than a library. */
function SignupsSection({ signups }: { signups: Overview["signups"] }) {
  const peak = Math.max(1, ...signups.points.map((point) => point.count));

  return (
    <section aria-labelledby="signups" className="surface space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="signups" className="section-title">
          Company signups · last {signups.days} days
        </h2>
        <span className="tabular text-sm font-medium">{formatNumber(signups.total)} total</span>
      </div>

      {signups.points.length === 0 ? (
        <p className="text-sm text-muted-foreground">No signup history yet.</p>
      ) : (
        <>
          <ol className="flex h-28 items-end gap-[2px]" aria-hidden>
            {signups.points.map((point) => (
              <li
                key={point.date}
                className="flex-1 rounded-t-xs bg-accent/70 transition-colors hover:bg-accent"
                style={{ height: `${Math.max(2, (point.count / peak) * 100)}%` }}
                title={`${point.date}: ${point.count}`}
              />
            ))}
          </ol>
          {/* The chart is decorative; the numbers themselves stay reachable. */}
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground underline-offset-2 hover:underline">
              View signup figures as a table
            </summary>
            <table className="mt-2 w-full text-xs">
              <caption className="sr-only">Company signups per day</caption>
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th scope="col" className="py-1 font-medium">
                    Date
                  </th>
                  <th scope="col" className="py-1 text-right font-medium">
                    Signups
                  </th>
                </tr>
              </thead>
              <tbody>
                {signups.points.map((point) => (
                  <tr key={point.date} className="border-t border-border">
                    <td className="py-1">{point.date}</td>
                    <td className="tabular py-1 text-right">{point.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <p className="text-xs text-muted-foreground">
            {humanise(`${signups.points.length} day buckets`)}, oldest first.
          </p>
        </>
      )}
    </section>
  );
}
