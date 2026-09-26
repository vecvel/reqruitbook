/**
 * Formatting shared by every page.
 *
 * Money is the one that matters: every amount on this platform crosses the wire
 * as an integer in minor units (4900 is $49.00), and a page that divides by 100
 * in one place and forgets in another shows an operator a price that is wrong
 * by two orders of magnitude on a screen where they approve refunds.
 */

/** Currencies whose smallest unit is the major unit — no decimal places. */
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "XAF", "XOF", "XPF"]);

export function minorUnitScale(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
}

/** Renders minor units as a localised amount: (4900, "USD") -> "$49.00". */
export function formatMoney(minor: number | null | undefined, currency: string): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return "—";

  const code = (currency || "USD").toUpperCase();
  const scale = minorUnitScale(code);

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: scale === 1 ? 0 : 2,
    }).format(minor / scale);
  } catch {
    // An unknown ISO code is not a reason to show nothing.
    return `${(minor / scale).toFixed(scale === 1 ? 0 : 2)} ${code}`;
  }
}

/** Turns a major-unit string typed into a form back into minor units. */
export function parseMoneyToMinor(input: string, currency: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * minorUnitScale(currency));
}

/** Minor units as a plain editable major-unit string: 4900 -> "49.00". */
export function minorToInput(minor: number, currency: string): string {
  const scale = minorUnitScale(currency);
  return (minor / scale).toFixed(scale === 1 ? 0 : 2);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat().format(value);
}

export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** "3 minutes ago" — for feeds, where the gap matters more than the clock time. */
export function formatRelative(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.348],
    ["month", 12],
    ["year", Number.POSITIVE_INFINITY],
  ];

  let amount = seconds;
  for (const [unit, step] of units) {
    if (Math.abs(amount) < step) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        Math.round(amount),
        unit,
      );
    }
    amount /= step;
  }
  return formatDate(date);
}

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "awaiting_customer" -> "Awaiting customer". */
export function humanise(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** How a plan's billing period reads on a card: "every 3 months", "one-off". */
export function formatInterval(interval: string, intervalCount: number): string {
  if (interval === "lifetime") return "one-off, never expires";
  const count = Math.max(1, intervalCount || 1);
  const unit = interval === "days" ? "day" : interval;
  return count === 1 ? `every ${unit}` : `every ${count} ${unit}s`;
}
