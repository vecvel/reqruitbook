/**
 * The company's view of a ticket thread.
 *
 * Every statement in this file reads `support_company_messages` and
 * `support_company_attachments`. Those are views defined as
 * `WHERE internal = false` that do not project the `internal` column at all, so
 * an internal note is not merely filtered out here — it is not in the relation
 * this code can see, and the column it would be filtered on is not selectable.
 *
 * That is the whole reason this repository exists separately from the desk's.
 * A single repository with an `internal` parameter, or a serializer that strips
 * notes on the way out, protects exactly the code paths whose author remembered
 * it; the next endpoint someone adds would quietly return them. Here, adding a
 * company-side read means writing a query against a relation that has no
 * internal notes in it, and getting that wrong requires deliberately naming the
 * base table — which the accompanying test forbids.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../tokens';
import { mapAttachmentRow } from './tickets.repository';
import type { AuthorKind, TicketAttachment, TicketMessage } from './domain';

/**
 * A thread longer than this is pathological, and returning it whole would make
 * one ticket an unbounded response body. The newest messages are the ones a
 * reader needs; older ones remain in the record.
 */
const MAX_THREAD_MESSAGES = 200;

@Injectable()
export class CompanyThreadRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async messages(ticketId: string, companyId: string): Promise<TicketMessage[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `SELECT id, ticket_id, company_id, author_kind, author_account_id, author_email, body, created_at
         FROM support_company_messages
        WHERE ticket_id = $1 AND company_id = $2
        ORDER BY created_at DESC, id DESC
        LIMIT $3`,
      [ticketId, companyId, MAX_THREAD_MESSAGES],
    );

    // Selected newest-first so the LIMIT keeps the newest; reversed here so the
    // caller reads the conversation in the order it happened.
    return rows.reverse().map(mapMessage);
  }

  async attachments(ticketId: string, companyId: string): Promise<TicketAttachment[]> {
    const { rows } = await this.pool.query(
      `SELECT id, ticket_id, message_id, company_id, object_key, file_name,
              content_type, size_bytes, created_at
         FROM support_company_attachments
        WHERE ticket_id = $1 AND company_id = $2
        ORDER BY created_at ASC, id ASC
        LIMIT $3`,
      [ticketId, companyId, MAX_THREAD_MESSAGES],
    );

    return rows.map(mapAttachmentRow);
  }
}

interface MessageRow {
  id: string;
  ticket_id: string;
  company_id: string;
  author_kind: AuthorKind;
  author_account_id: string;
  author_email: string;
  body: string;
  created_at: Date;
}

function mapMessage(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    companyId: row.company_id,
    authorKind: row.author_kind,
    authorAccountId: row.author_account_id,
    authorEmail: row.author_email,
    body: row.body,
    createdAt: row.created_at,
  };
}
