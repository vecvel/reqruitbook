/**
 * Reading numbers back out of Postgres.
 *
 * node-pg returns bigint and numeric as strings, on purpose: a count above
 * 2^53 cannot survive a JavaScript number. Everything this console counts —
 * tenants, tickets, minor units of revenue — is far below that, so the
 * conversion is safe, but it has to be deliberate. Without it `count(*)` comes
 * back as "42" and a JSON dashboard quietly renders every total as a string.
 */

/** A count or amount from a query result. Absent, null or unparsable becomes 0. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** A timestamp column as an ISO string, or null. */
export function toIso(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  return null;
}
