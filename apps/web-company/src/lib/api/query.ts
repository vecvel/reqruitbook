/**
 * Query-string parsing shared by REST routes and list pages:
 * pagination, sorting, search, and filter extraction.
 */

export interface ListQuery {
  page: number;
  limit: number;
  offset: number;
  search: string | null;
  /** Ordered sort instructions; `-field` means descending. */
  sort: { field: string; direction: "asc" | "desc" }[];
  filters: Record<string, string>;
}

const RESERVED = new Set([
  "page",
  "limit",
  "search",
  "q",
  "sort",
  "tab",
]);

const MAX_LIMIT = 200;

export function parseListQuery(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
  options: { defaultLimit?: number; defaultSort?: string } = {},
): ListQuery {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(
          Object.entries(input).flatMap(([k, v]) =>
            v === undefined
              ? []
              : Array.isArray(v)
                ? v.map((x) => [k, x] as [string, string])
                : [[k, v] as [string, string]],
          ),
        );

  const page = Math.max(1, toInt(params.get("page"), 1));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, toInt(params.get("limit"), options.defaultLimit ?? 25)),
  );

  const sortRaw = params.get("sort") ?? options.defaultSort ?? "";
  const sort = sortRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s.startsWith("-")
        ? { field: s.slice(1), direction: "desc" as const }
        : { field: s, direction: "asc" as const },
    );

  const filters: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (RESERVED.has(key)) continue;
    if (value === "" || value === "all") continue;
    filters[key] = value;
  }

  const search = (params.get("search") ?? params.get("q") ?? "").trim() || null;

  return { page, limit, offset: (page - 1) * limit, search, sort, filters };
}

function toInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Builds a `?a=b` string, dropping empty values — used for pagination links. */
export function buildQueryString(
  params: Record<string, string | number | null | undefined>,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
