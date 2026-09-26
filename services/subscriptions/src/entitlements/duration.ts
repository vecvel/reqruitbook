/**
 * Billing-period arithmetic.
 *
 * All of it runs in UTC. Doing it in local time means a subscription bought in
 * Sydney and renewed by a sweep running in Frankfurt disagree about which day a
 * period ended, and the company that loses the argument loses portal access.
 */
export type PlanInterval = 'month' | 'year' | 'days' | 'lifetime';

export const PLAN_INTERVALS: readonly PlanInterval[] = ['month', 'year', 'days', 'lifetime'];

export function isPlanInterval(value: string): value is PlanInterval {
  return (PLAN_INTERVALS as readonly string[]).includes(value);
}

/**
 * The end of a period that starts at `from`.
 *
 * Returns null for a lifetime plan — the caller stores that null as
 * `expires_at`, which is what keeps the expiry sweep from ever selecting the
 * row. "Lifetime" is therefore the absence of an expiry rather than a date far
 * in the future, so it cannot arrive.
 */
export function periodEnd(from: Date, interval: PlanInterval, count: number): Date | null {
  if (interval === 'lifetime') return null;

  switch (interval) {
    case 'month':
      return addMonths(from, count);
    case 'year':
      return addMonths(from, count * 12);
    case 'days':
      return addDays(from, count);
  }
}

export function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 86_400_000);
}

/**
 * Adds calendar months, clamping to the end of the target month.
 *
 * 31 January plus one month is 28 February, not 3 March. Letting the date roll
 * over would walk a monthly subscription's anniversary forward a few days a
 * year, and the customer would be billed thirteen times in the twelfth.
 */
export function addMonths(from: Date, months: number): Date {
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  const day = from.getUTCDate();

  const targetMonth = month + months;
  const lastDay = daysInMonth(year, targetMonth);

  const result = new Date(
    Date.UTC(
      year,
      targetMonth,
      Math.min(day, lastDay),
      from.getUTCHours(),
      from.getUTCMinutes(),
      from.getUTCSeconds(),
      from.getUTCMilliseconds(),
    ),
  );
  return result;
}

/** `month` may be outside 0-11; Date.UTC normalises it into the right year. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/** The first day of the month a date falls in, as a `YYYY-MM-DD` string. */
export function monthBucket(at: Date): string {
  const year = at.getUTCFullYear();
  const month = `${at.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}-01`;
}

/**
 * The bucket for a metric that never resets.
 *
 * A sentinel rather than a nullable column, so the primary key stays simple and
 * an upsert does not need a separate branch for the two kinds of metric.
 */
export const LIFETIME_BUCKET = '1970-01-01';
