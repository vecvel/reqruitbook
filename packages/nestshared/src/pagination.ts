/**
 * Cursor pagination, uniform across every service.
 *
 * Offset pagination drifts when rows are inserted mid-scan — a recruiter paging
 * through applicants would see the same person twice while new applications
 * arrive. An opaque cursor over a stable sort does not.
 */
import { badRequest } from './problem';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageRequest {
  limit: number;
  cursor: Cursor | null;
}

export interface Cursor {
  createdAt: string;
  id: string;
}

export function parsePageRequest(query: { limit?: string; cursor?: string }): PageRequest {
  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined && query.limit !== '') {
    const parsed = Number(query.limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw badRequest('limit must be a positive integer.');
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  return { limit, cursor: query.cursor ? decodeCursor(query.cursor) : null };
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(`${cursor.createdAt}|${cursor.id}`, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string): Cursor {
  const decoded = Buffer.from(raw, 'base64url').toString('utf8');
  const separator = decoded.lastIndexOf('|');
  if (separator === -1) {
    throw badRequest('The supplied cursor is not valid.');
  }
  const createdAt = decoded.slice(0, separator);
  const id = decoded.slice(separator + 1);
  if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) {
    throw badRequest('The supplied cursor is not valid.');
  }
  return { createdAt, id };
}

/**
 * Builds a page from limit+1 rows.
 *
 * Fetching one extra row is how we know whether a next page exists without a
 * second count query.
 */
export function buildPage<T extends { id: string; createdAt: Date | string }>(rows: T[], limit: number): Page<T> {
  if (rows.length <= limit) {
    return { items: rows, nextCursor: null };
  }
  const items = rows.slice(0, limit);
  const last = items[items.length - 1]!;
  return {
    items,
    nextCursor: encodeCursor({
      createdAt: last.createdAt instanceof Date ? last.createdAt.toISOString() : String(last.createdAt),
      id: last.id,
    }),
  };
}
