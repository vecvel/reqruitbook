"use server";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import { requirePermission } from "@/lib/rbac/guard";

/**
 * The company's audit trail, served by the audit service.
 *
 * The audit service consumes every platform event and keeps one tenant-scoped
 * row per event. Its company endpoints filter on the tenant in the token and
 * nothing else — a trail that can be made to show another tenant's activity is
 * worse than no trail, because it is believed.
 *
 * Payloads arrive already redacted. The service drops other services' free text
 * — message bodies, internal notes, scorecards — because `company_audit.read` is
 * held by administrators who may hold no `messaging.read` at all, and an audit
 * screen that quietly hands them every message body is a permission bypass
 * wearing a different name. This module therefore renders what it is given and
 * does no filtering of its own.
 */

export interface AuditLogRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
}

/** What the audit service returns. */
interface PlatformAuditEntry {
  id: string;
  subject: string;
  action: string;
  companyId: string | null;
  actorId: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  recordedAt: string;
  payload: Record<string, unknown> | null;
}

function toAuditRow(entry: PlatformAuditEntry, names: Map<string, string>): AuditLogRow {
  return {
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata: entry.payload,
    createdAt: new Date(entry.occurredAt),
    actorId: entry.actorId || null,
    // Resolved from the roster rather than stored on the entry: a name changes,
    // and an audit trail that renders the name somebody had at the time reads
    // as a different person once they are renamed.
    actorName: entry.actorId ? (names.get(entry.actorId) ?? null) : null,
    actorEmail: null,
  };
}

/**
 * Who the actor ids belong to.
 *
 * The audit service stores an account id because that is what an event carries;
 * it has no business holding a copy of the company's roster. Identity does, and
 * the screen needs a name, so the two are joined here — in the one place that
 * renders them, and only for the ids actually on the page.
 */
async function actorNames(actorIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(actorIds.filter(Boolean));
  if (wanted.size === 0) return new Map();

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/recruiters");
    const members = unwrap<{ accountId: string; fullName: string }>(payload, "recruiters");
    return new Map(
      members.filter((m) => wanted.has(m.accountId)).map((m) => [m.accountId, m.fullName]),
    );
  }, new Map());
}

export async function getAuditLogs(params?: {
  search?: string;
  action?: string;
  limit?: number;
}): Promise<AuditLogRow[]> {
  const { access } = await requirePermission("audit-logs.read");

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/company-audit", {
      query: {
        limit: Math.min(params?.limit ?? 100, 100),
        ...(params?.action && params.action !== "all" ? { action: params.action } : {}),
      },
    });

    const entries = unwrap<PlatformAuditEntry>(payload, "entries");

    // Only worth a second call when somebody can actually read the roster.
    const names = access.can("users.read")
      ? await actorNames(entries.map((entry) => entry.actorId))
      : new Map<string, string>();

    const rows = entries.map((entry) => toAuditRow(entry, names));
    if (!params?.search) return rows;

    // Filtered here rather than at the service: the trail is already limited to
    // this tenant, and a free-text search over a redacted payload is a reading
    // convenience, not a security boundary.
    const needle = params.search.toLowerCase();
    return rows.filter((row) =>
      [row.action, row.entityType, row.entityId, row.actorName ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, []);
}

/**
 * The action vocabulary, taken from what the trail actually contains.
 *
 * A hard-coded list would drift the moment a service publishes a new subject,
 * and the filter would silently stop offering it.
 */
export async function getAuditActionGroups(): Promise<string[]> {
  const rows = await getAuditLogs({ limit: 100 });
  return [...new Set(rows.map((row) => row.action))].sort();
}

/** Nothing blocks this screen any more; kept so the page's import still resolves. */
export async function getAuditAvailability(): Promise<null> {
  return null;
}
