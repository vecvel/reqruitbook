"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { CursorPager, MonoId, PageHeader, StateBadge } from "@/components/console/primitives";
import { EmptyState, ProblemView, TableSkeleton } from "@/components/console/states";
import { formatDateTime, formatMoney, humanise } from "@/lib/format";
import type { Payment, PaymentsConfig } from "@/lib/types";
import { useCursorList } from "@/lib/use-cursor-list";
import { useResource } from "@/lib/use-resource";

export function PaymentsClient({ initialCompanyId }: { initialCompanyId: string }) {
  const companyFieldId = useId();
  const [companyInput, setCompanyInput] = useState(initialCompanyId);
  const [companyId, setCompanyId] = useState(initialCompanyId);

  const query = useMemo(() => ({ companyId }), [companyId]);
  const list = useCursorList<Payment>("/payments", query);
  const config = useResource<PaymentsConfig>("/payments/config");

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every charge the platform has taken, and the refunds against them."
      />

      {config.data ? <ProviderBanner config={config.data} /> : null}

      <form
        className="surface flex flex-wrap items-end gap-3 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          setCompanyId(companyInput.trim());
        }}
      >
        <div className="min-w-[18rem] flex-1 space-y-1.5">
          <Label htmlFor={companyFieldId}>Company id</Label>
          <Input
            id={companyFieldId}
            value={companyInput}
            placeholder="Filter to one tenant"
            onChange={(event) => setCompanyInput(event.target.value)}
          />
        </div>
        <Button type="submit" size="sm">
          Apply
        </Button>
        {companyId ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setCompanyId("");
              setCompanyInput("");
            }}
          >
            Clear
          </Button>
        ) : null}
      </form>

      {list.loading && list.items.length === 0 ? <TableSkeleton rows={8} columns={6} /> : null}
      {list.error ? <ProblemView problem={list.error} onRetry={list.reload} /> : null}

      {!list.loading && !list.error && list.items.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-5" aria-hidden />}
          title="No payments"
          description={
            companyId
              ? "This tenant has never been charged."
              : "Nothing has been charged on the platform yet."
          }
        />
      ) : null}

      {list.items.length > 0 ? (
        <div className="surface overflow-x-auto">
          <Table>
            <caption className="sr-only">Payments taken by the platform</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Payment</TableHead>
                <TableHead scope="col">Company</TableHead>
                <TableHead scope="col">Amount</TableHead>
                <TableHead scope="col">Refunded</TableHead>
                <TableHead scope="col">State</TableHead>
                <TableHead scope="col">Taken</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.items.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <Link
                      href={`/payments/${payment.id}`}
                      className="text-sm underline-offset-2 hover:underline"
                    >
                      <MonoId value={payment.id} />
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {humanise(payment.provider)}
                      {payment.card ? ` · ${payment.card.brand} ••${payment.card.last4}` : ""}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/companies/${payment.companyId}`}
                      className="underline-offset-2 hover:underline"
                    >
                      <MonoId value={payment.companyId} />
                    </Link>
                  </TableCell>
                  <TableCell className="tabular text-sm font-medium">
                    {formatMoney(payment.amount.minor, payment.amount.currency)}
                  </TableCell>
                  <TableCell className="tabular text-sm">
                    {payment.refunded.minor > 0 ? (
                      <span className="text-destructive">
                        {formatMoney(payment.refunded.minor, payment.refunded.currency)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StateBadge state={payment.state} />
                    {payment.failureReason ? (
                      <div className="text-xs text-destructive">{payment.failureReason}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateTime(payment.createdAt)}
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

/**
 * Which provider is actually live.
 *
 * The endpoint returns booleans and never secrets. It is surfaced because the
 * difference between "Stripe is configured" and "the manual provider is
 * standing in for Stripe" decides whether a refund button does anything real,
 * and an operator should not have to find that out by clicking it.
 */
function ProviderBanner({ config }: { config: PaymentsConfig }) {
  const substituted = config.provider !== config.requestedProvider;

  return (
    <div className="surface flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
      <span className="field-label">Provider</span>
      <Badge variant={config.configured ? "soft-success" : "soft-destructive"}>
        {humanise(config.provider)}
      </Badge>
      {substituted ? (
        <span className="text-warning">
          {humanise(config.requestedProvider)} was requested but is not configured — charges are
          being handled by the {config.provider} provider.
        </span>
      ) : null}
      <span className="text-muted-foreground">
        {config.webhookConfigured ? "Webhook configured" : "No webhook configured"} ·{" "}
        {humanise(config.environment)} · default {config.defaultCurrency}
      </span>
    </div>
  );
}
