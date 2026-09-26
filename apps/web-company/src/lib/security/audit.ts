import "server-only";

export interface AuditEventParams {
  action: string;
  entityType: string;
  entityId: string;
  actorId?: string;
  orgId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records a security or administrative event.
 *
 * This used to insert into an `audit_logs` table this app owned. That table is
 * gone with the rest of the local database, and the platform exposes no
 * endpoint to write an audit entry — `company_audit.read` and `.export` exist
 * as permissions, but there is no route behind them. Rather than drop the call
 * sites (which are the useful part, and would be tedious to reconstruct later)
 * the event is written to the server log, where a collector can pick it up.
 *
 * Reported as a gap: the company portal cannot persist its own audit trail
 * until an audit endpoint exists.
 */
export async function recordAuditLog(params: AuditEventParams): Promise<void> {
  try {
    console.info(
      JSON.stringify({
        level: "info",
        msg: "audit",
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        actorId: params.actorId ?? null,
        orgId: params.orgId ?? null,
        metadata: params.metadata ?? {},
        at: new Date().toISOString(),
      }),
    );
  } catch {
    // An audit write must never fail the operation it is describing.
  }
}
