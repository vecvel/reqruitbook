/**
 * The webhook event ledger — the thing that makes a redelivery harmless.
 *
 * Providers retry on any non-2xx and occasionally redeliver after a 200, so
 * "have I already applied this event" cannot be answered by a SELECT followed
 * by an INSERT: two deliveries racing would both see nothing and both apply.
 * The answer comes from the UNIQUE constraint on provider_event_id, which is
 * the only mechanism that holds under concurrency.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';

import { PG_POOL } from '../common/infrastructure.module';
import { WebhookIdPrefix, newId } from '../common/ids';

type Executor = Pool | PoolClient;

export type WebhookStatus = 'received' | 'processed' | 'ignored' | 'failed';

export interface WebhookEventRecord {
  id: string;
  provider: string;
  providerEventId: string;
  type: string;
  status: WebhookStatus;
  ignoredReason: string;
  deliveryError: string;
  receivedAt: Date;
  processedAt: Date | null;
}

interface Row {
  id: string;
  provider: string;
  provider_event_id: string;
  type: string;
  status: WebhookStatus;
  ignored_reason: string;
  delivery_error: string;
  received_at: Date;
  processed_at: Date | null;
}

function toRecord(row: Row): WebhookEventRecord {
  return {
    id: row.id,
    provider: row.provider,
    providerEventId: row.provider_event_id,
    type: row.type,
    status: row.status,
    ignoredReason: row.ignored_reason,
    deliveryError: row.delivery_error,
    receivedAt: row.received_at,
    processedAt: row.processed_at,
  };
}

const COLUMNS = `
  id, provider, provider_event_id, type, status, ignored_reason,
  delivery_error, received_at, processed_at`;

export interface ClaimResult {
  /** False when this provider event id has been seen before. */
  claimed: boolean;
  record: WebhookEventRecord;
}

@Injectable()
export class WebhookEventsRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /**
   * Claims an event, or reports that it was already claimed.
   *
   * The insert commits on its own connection before any effect is applied, so a
   * process that dies mid-effect leaves a `received` row: visible to the
   * reconciliation job, and never re-applied by a blind retry. Losing an effect
   * that an operator can see and replay beats crediting a subscription twice.
   */
  async claim(
    provider: string,
    providerEventId: string,
    type: string,
    payload: unknown,
    client?: Executor,
  ): Promise<ClaimResult> {
    const executor = client ?? this.pool;
    const id = newId(WebhookIdPrefix);

    const { rows } = await executor.query<Row>(
      `INSERT INTO webhook_events (id, provider, provider_event_id, type, payload)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING ${COLUMNS}`,
      [id, provider, providerEventId, type, JSON.stringify(payload ?? {})],
    );

    if (rows[0]) {
      return { claimed: true, record: toRecord(rows[0]) };
    }

    const existing = await this.findByProviderEventId(providerEventId, executor);
    if (!existing) {
      // DO NOTHING fired but the row is gone: only possible if something deleted
      // it between the two statements, which this service never does.
      throw new Error(`webhook event ${providerEventId} conflicted but could not be read back`);
    }
    return { claimed: false, record: existing };
  }

  async findByProviderEventId(
    providerEventId: string,
    client?: Executor,
  ): Promise<WebhookEventRecord | null> {
    const executor = client ?? this.pool;
    const { rows } = await executor.query<Row>(
      `SELECT ${COLUMNS} FROM webhook_events WHERE provider_event_id = $1`,
      [providerEventId],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async markProcessed(id: string, client?: Executor): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `UPDATE webhook_events
          SET status = 'processed', processed_at = now(), delivery_error = ''
        WHERE id = $1`,
      [id],
    );
  }

  /**
   * Records an event we understood and deliberately did not act on.
   *
   * The reason is stored rather than logged only, because "why did this charge
   * never reach a subscription" is asked days later, by someone reading the
   * database and not the log.
   */
  async markIgnored(id: string, reason: string, client?: Executor): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `UPDATE webhook_events
          SET status = 'ignored', processed_at = now(), ignored_reason = $2
        WHERE id = $1`,
      [id, reason],
    );
  }

  /**
   * Records an event whose effect did not land.
   *
   * `processed_at` stays null on purpose: this row is what a reconciliation job
   * looks for, and a timestamp would hide it.
   */
  async markFailed(id: string, error: string, client?: Executor): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `UPDATE webhook_events SET status = 'failed', delivery_error = $2 WHERE id = $1`,
      [id, error],
    );
  }

  /** Notes a downstream effect that did not land, on an otherwise applied event. */
  async noteDeliveryError(id: string, error: string, client?: Executor): Promise<void> {
    const executor = client ?? this.pool;
    await executor.query(
      `UPDATE webhook_events
          SET status = 'processed', processed_at = now(), delivery_error = $2
        WHERE id = $1`,
      [id, error],
    );
  }
}
