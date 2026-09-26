/**
 * The support desk's view of a ticket thread.
 *
 * This is the only place internal notes are read. It reads the base tables and
 * returns the `internal` flag, because the desk's job is to see the whole
 * record — including the note the last agent left about why the refund was
 * declined.
 *
 * Nothing on the company side may import from this file. The separation is kept
 * physical rather than conditional so that "which audience is this?" is answered
 * by which repository a controller was given, and never by a boolean threaded
 * through a shared query.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { PG_POOL } from '../tokens';
import { mapAttachmentRow } from './tickets.repository';
import type { AuthorKind, PlatformTicketMessage, TicketAttachment } from './domain';

const MAX_THREAD_MESSAGES = 200;

@Injectable()
export class PlatformThreadRepository {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async messages(ticketId: string): Promise<PlatformTicketMessage[]> {
    const { rows } = await this.pool.query<MessageRow>(
      `SELECT id, ticket_id, company_id, author_kind, author_account_id, author_email,
              body, internal, created_at
         FROM support_ticket_messages
        WHERE ticket_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2`,
      [ticketId, MAX_THREAD_MESSAGES],
    );

    return rows.reverse().map(mapMessage);
  }

  async attachments(ticketId: string): Promise<TicketAttachment[]> {
    const { rows } = await this.pool.query(
      `SELECT id, ticket_id, message_id, company_id, object_key, file_name,
              content_type, size_bytes, created_at
         FROM support_ticket_attachments
        WHERE ticket_id = $1
        ORDER BY created_at ASC, id ASC
        LIMIT $2`,
      [ticketId, MAX_THREAD_MESSAGES],
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
  internal: boolean;
  created_at: Date;
}

function mapMessage(row: MessageRow): PlatformTicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    companyId: row.company_id,
    authorKind: row.author_kind,
    authorAccountId: row.author_account_id,
    authorEmail: row.author_email,
    body: row.body,
    internal: row.internal,
    createdAt: row.created_at,
  };
}
