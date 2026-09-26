"use client";

import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanise } from "@/lib/format";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "warning" | "destructive";
}) {
  const toneClass = {
    default: "text-foreground",
    accent: "text-copper-deep",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];

  return (
    <div className="surface flex flex-col gap-1 p-4">
      <span className="field-label">{label}</span>
      <span className={cn("tabular text-2xl font-semibold leading-tight", toneClass)}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/**
 * Maps a domain state onto a badge tone in one place.
 *
 * Doing it per-page is how "suspended" ends up red on one screen and grey on
 * another, which teaches an operator to read the word instead of the colour.
 */
const STATE_TONES: Record<string, "success" | "warning" | "destructive" | "muted" | "accent"> = {
  active: "success",
  approved: "success",
  published: "success",
  ok: "success",
  succeeded: "success",
  paid: "success",
  resolved: "success",
  trialing: "accent",
  trial: "accent",
  pending: "warning",
  draft: "warning",
  awaiting_customer: "warning",
  awaiting_support: "warning",
  past_due: "warning",
  open: "warning",
  degraded: "warning",
  suspended: "destructive",
  cancelled: "destructive",
  canceled: "destructive",
  expired: "destructive",
  failed: "destructive",
  refunded: "destructive",
  error: "destructive",
  down: "destructive",
  closed: "muted",
  retired: "muted",
  deleted: "muted",
};

export function StateBadge({ state, className }: { state: string | null | undefined; className?: string }) {
  if (!state) return <span className="text-muted-foreground">—</span>;
  const tone = STATE_TONES[state.toLowerCase()] ?? "soft-neutral";
  return (
    <Badge variant={tone === "soft-neutral" ? "soft-neutral" : (`soft-${tone}` as never)} className={className}>
      {humanise(state)}
    </Badge>
  );
}

/**
 * Cursor pagination.
 *
 * Every list endpoint on this platform is `?limit=&cursor=` and returns a
 * `nextCursor`, so the console keeps the cursors it has walked through and can
 * step back without the API needing to offer a previous cursor.
 */
export function CursorPager({
  history,
  nextCursor,
  onBack,
  onNext,
  loading,
  count,
}: {
  history: (string | null)[];
  nextCursor: string | null;
  onBack: () => void;
  onNext: () => void;
  loading: boolean;
  count: number;
}) {
  const canGoBack = history.length > 1;

  return (
    <nav className="flex items-center justify-between gap-4 pt-3" aria-label="Pagination">
      <span className="text-xs text-muted-foreground">
        {count === 0 ? "No rows" : `${count} row${count === 1 ? "" : "s"} on this page`}
        {history.length > 1 ? ` · page ${history.length}` : ""}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBack}
          disabled={!canGoBack || loading}
        >
          <ChevronLeft aria-hidden />
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!nextCursor || loading}
        >
          Next
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="field-label">{label}</dt>
      <dd className="field-value break-words">{children}</dd>
    </div>
  );
}

export function MonoId({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className="font-mono text-[11px] text-muted-foreground">{value}</span>;
}
