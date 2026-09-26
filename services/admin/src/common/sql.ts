/**
 * Small helpers for building the filtered queries this service is made of.
 *
 * Every value still goes to Postgres as a bind parameter. What is built here is
 * the *shape* of the WHERE clause; no caller-supplied text ever reaches the SQL
 * string itself, which is the only property that matters.
 */

/** Collects bind parameters and hands out their placeholders in order. */
export class Params {
  private readonly values: unknown[] = [];

  /** Records a value and returns its `$n` placeholder. */
  add(value: unknown): string {
    this.values.push(value);
    return `$${this.values.length}`;
  }

  all(): unknown[] {
    return [...this.values];
  }
}

/**
 * Escapes a user's search text for ILIKE.
 *
 * Without this a search for "50%" matches every tenant, and one for "_" matches
 * all of them — the wildcards are the user's literal characters, not their
 * intent. Backslash is Postgres's default LIKE escape character, so escaping it
 * first keeps a trailing backslash from swallowing the closing wildcard.
 */
export function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (character) => `\\${character}`);
}

/** `WHERE a AND b`, or the empty string when nothing is filtered. */
export function whereClause(conditions: readonly string[]): string {
  return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
}
