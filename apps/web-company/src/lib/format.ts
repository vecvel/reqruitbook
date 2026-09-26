import { toNumber } from "./money";

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "د.إ",
  AUD: "A$",
  CAD: "C$",
  SGD: "S$",
};

export function currencySymbol(code = "USD"): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

export function formatMoney(
  value: string | number | null | undefined,
  options: { currency?: string; decimals?: number; showSymbol?: boolean } = {},
): string {
  const { currency = "USD", decimals = 0, showSymbol = true } = options;
  const n = toNumber(value);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return showSymbol ? `${currencySymbol(currency)}${formatted}` : formatted;
}

export function formatMoneyCompact(
  value: string | number | null | undefined,
  currency = "USD",
): string {
  const n = toNumber(value);
  const sym = currencySymbol(currency);
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`;
  return `${sign}${sym}${abs.toFixed(0)}`;
}

export function formatPercent(
  value: string | number | null | undefined,
  decimals = 1,
): string {
  return `${toNumber(value).toFixed(decimals)}%`;
}

export function formatNumber(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString("en-US");
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function asDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: Date | string | null | undefined): string {
  const d = asDate(value);
  if (!d) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  const d = asDate(value);
  if (!d) return "—";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatDate(d)}, ${hh}:${mm}`;
}

export function formatTime(value: Date | string | null | undefined): string {
  const d = asDate(value);
  if (!d) return "—";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatRelative(value: Date | string | null | undefined): string {
  const d = asDate(value);
  if (!d) return "—";

  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) return `${Math.round(days / 7)} wk ago`;

  return formatDate(d);
}

export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function truncate(value: string, length = 60): string {
  return value.length <= length ? value : `${value.slice(0, length - 1)}…`;
}
