/**
 * Reading a list out of a response whose envelope depends on the service.
 *
 * The platform's list endpoints do not agree on a key: the Go services answer
 * `{jobs}`, `{applications}`, `{notifications}` or `{data}`, and the NestJS
 * ones answer `{items}`. Rather than let every call site guess, a reader names
 * the key it expects and falls back to the others — so a service that is later
 * made consistent keeps working without a change here.
 *
 * Reported as a gap: the list envelope should be one shape across services.
 */
export function unwrap<T>(payload: unknown, key: string): T[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;

  for (const candidate of [key, "items", "data"]) {
    const value = record[candidate];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

/** The cursor for the next page, normalised across `""` and `null`. */
export function nextCursor(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as Record<string, unknown>).nextCursor;
  return typeof value === "string" && value !== "" ? value : null;
}
