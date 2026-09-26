"use client";

import React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { buildQueryString } from "@/lib/api/query";
import { cn } from "@/lib/utils";

/**
 * Data Table & Pagination primitives matching StoqBook's exact UI design,
 * typography tokens, border radiuses, and responsive behavior.
 */

export function TableShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xs border border-border bg-card shadow-none",
        className,
      )}
    >
      <div className="overflow-x-auto scrollbar-thin">{children}</div>
    </div>
  );
}

export function Table({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full caption-bottom text-xs", className)}>
      {children}
    </table>
  );
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-border bg-muted/50">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  align = "left",
  className,
  width,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  width?: string;
}) {
  return (
    <th
      scope="col"
      style={width ? { width } : undefined}
      className={cn(
        "whitespace-nowrap px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
        align === "right" && "text-right",
        align === "center" && "text-center",
        align === "left" && "text-left",
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Sortable header cell */
export function SortableTH({
  children,
  field,
  currentSort,
  baseParams = {},
  align = "left",
  className,
  onSort,
}: {
  children: React.ReactNode;
  field: string;
  currentSort?: string;
  baseParams?: Record<string, string | number | null | undefined>;
  align?: "left" | "right" | "center";
  className?: string;
  onSort?: (field: string, direction: "asc" | "desc") => void;
}) {
  const descending = currentSort === `-${field}` || currentSort === `${field}:desc`;
  const ascending = currentSort === field || currentSort === `${field}:asc`;
  const nextSort = ascending ? `-${field}` : field;

  if (onSort) {
    return (
      <TH align={align} className={className}>
        <button
          type="button"
          onClick={() => onSort(field, ascending ? "desc" : "asc")}
          className={cn(
            "inline-flex items-center gap-1 transition-colors hover:text-foreground font-semibold cursor-pointer",
            (ascending || descending) && "text-foreground",
            align === "right" && "flex-row-reverse",
          )}
        >
          <span>{children}</span>
          {ascending ? (
            <ArrowUp className="size-3 text-copper" />
          ) : descending ? (
            <ArrowDown className="size-3 text-copper" />
          ) : (
            <ChevronsUpDown className="size-3 opacity-40" />
          )}
        </button>
      </TH>
    );
  }

  const href = `${buildQueryString({ ...baseParams, page: 1, sort: nextSort })}`;

  return (
    <TH align={align} className={className}>
      <Link
        href={href || "?"}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground font-semibold",
          (ascending || descending) && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        <span>{children}</span>
        {ascending ? (
          <ArrowUp className="size-3 text-copper" />
        ) : descending ? (
          <ArrowDown className="size-3 text-copper" />
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </Link>
    </TH>
  );
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TR({
  children,
  className,
  muted,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "transition-colors hover:bg-muted/40",
        muted && "opacity-60",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  align = "left",
  className,
  colSpan,
  mono,
}: {
  children?: React.ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  colSpan?: number;
  mono?: boolean;
}) {
  return (
    <td
      colSpan={colSpan}
      className={cn(
        "px-3 py-2 align-middle text-xs text-foreground",
        align === "right" && "text-right tabular",
        align === "center" && "text-center",
        mono && "text-[11px]",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TFoot({ children }: { children: React.ReactNode }) {
  return (
    <tfoot className="border-t-2 border-border bg-muted/50 font-semibold text-xs">
      <tr>{children}</tr>
    </tfoot>
  );
}

export function EmptyRow({
  colSpan,
  children = "No records match these criteria.",
}: {
  colSpan: number;
  children?: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-3 py-10 text-center text-xs text-muted-foreground italic"
      >
        {children}
      </td>
    </tr>
  );
}

/* -------------------------------------------------------------------------- */
/* URL-Driven Pagination                                                      */
/* -------------------------------------------------------------------------- */

export function Pagination({
  page,
  limit,
  total,
  baseParams = {},
}: {
  page: number;
  limit: number;
  total: number;
  baseParams?: Record<string, string | number | null | undefined>;
}) {
  const pages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const window = new Set<number>([1, pages, page - 1, page, page + 1]);
  const visible = [...window]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 bg-card/50">
      <span className="text-xs text-muted-foreground">
        Showing <span className="font-semibold text-foreground">{from}</span>–
        <span className="font-semibold text-foreground">{to}</span> of{" "}
        <span className="font-semibold text-foreground">{total}</span>
      </span>

      {pages > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink
            params={baseParams}
            page={page - 1}
            disabled={page <= 1}
            label="Previous"
          />
          {visible.map((p, i) => (
            <span key={p} className="flex items-center gap-1">
              {i > 0 && p - visible[i - 1] > 1 ? (
                <span className="px-1 text-xs text-muted-foreground">…</span>
              ) : null}
              <PageLink
                params={baseParams}
                page={p}
                label={String(p)}
                active={p === page}
              />
            </span>
          ))}
          <PageLink
            params={baseParams}
            page={page + 1}
            disabled={page >= pages}
            label="Next"
          />
        </div>
      ) : null}
    </div>
  );
}

function PageLink({
  params,
  page,
  label,
  disabled,
  active,
}: {
  params: Record<string, string | number | null | undefined>;
  page: number;
  label: string;
  disabled?: boolean;
  active?: boolean;
}) {
  const classes = cn(
    "inline-flex h-7 min-w-7 items-center justify-center rounded-xs border px-2 text-xs transition-colors cursor-pointer",
    active
      ? "border-copper bg-copper text-copper-foreground font-semibold"
      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
    disabled && "pointer-events-none opacity-40 cursor-not-allowed",
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled>
        {label}
      </span>
    );
  }

  return (
    <Link
      href={buildQueryString({ ...params, page }) || "?"}
      scroll={false}
      className={classes}
    >
      {label}
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Client-State Pagination (for interactive client-side tables)               */
/* -------------------------------------------------------------------------- */

export function ClientPagination({
  page,
  limit,
  total,
  onPageChange,
  onLimitChange,
  limitOptions = [10, 25, 50, 100],
}: {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  limitOptions?: number[];
}) {
  const pages = limit > 0 ? Math.max(1, Math.ceil(total / limit)) : 1;
  if (total === 0) return null;

  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const window = new Set<number>([1, pages, page - 1, page, page + 1]);
  const visible = [...window]
    .filter((p) => p >= 1 && p <= pages)
    .sort((a, b) => a - b);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2.5 bg-card/40">
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{from}</span>–
          <span className="font-semibold text-foreground">{to}</span> of{" "}
          <span className="font-semibold text-foreground">{total}</span>
        </span>

        {onLimitChange && (
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground pl-3 border-l border-border">
            <span>Per page:</span>
            <select
              value={limit}
              onChange={(e) => {
                onLimitChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="h-6 rounded-xs border border-border bg-card px-1.5 text-[11px] text-foreground focus:border-ring"
            >
              {limitOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className={cn(
            "inline-flex h-7 min-w-7 items-center justify-center rounded-xs border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer gap-1",
            page <= 1 && "pointer-events-none opacity-40 cursor-not-allowed",
          )}
        >
          <ChevronLeft className="size-3" />
          <span className="hidden sm:inline">Previous</span>
        </button>

        {visible.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - visible[i - 1] > 1 ? (
              <span className="px-1 text-xs text-muted-foreground">…</span>
            ) : null}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "inline-flex h-7 min-w-7 items-center justify-center rounded-xs border px-2 text-xs transition-colors cursor-pointer",
                p === page
                  ? "border-copper bg-copper text-white font-semibold shadow-xs"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {p}
            </button>
          </span>
        ))}

        <button
          type="button"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
          className={cn(
            "inline-flex h-7 min-w-7 items-center justify-center rounded-xs border border-border px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer gap-1",
            page >= pages && "pointer-events-none opacity-40 cursor-not-allowed",
          )}
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-3" />
        </button>
      </div>
    </div>
  );
}
