/**
 * Response shapes.
 *
 * These functions decide *presentation*, never *audience*. A serializer that
 * dropped internal notes would put the platform's most sensitive text one
 * forgotten line away from a customer; the audience is settled in SQL, before
 * a row ever reaches here, and what arrives is simply rendered.
 */
import type {
  PlatformTicketMessage,
  Ticket,
  TicketAttachment,
  TicketMessage,
} from './domain';

export interface TicketSummaryView {
  id: string;
  subject: string;
  category: string;
  priority: string;
  state: string;
  assignedAgentId: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyTicketView extends TicketSummaryView {
  openedBy: { accountId: string; email: string };
  resolvedAt: string | null;
  closedAt: string | null;
  messages: MessageView[];
  attachments: AttachmentView[];
}

/** The desk additionally needs to know whose ticket it is looking at. */
export interface PlatformTicketSummaryView extends TicketSummaryView {
  company: { id: string; slug: string };
}

export interface PlatformTicketView extends PlatformTicketSummaryView {
  openedBy: { accountId: string; email: string };
  resolvedAt: string | null;
  closedAt: string | null;
  messages: PlatformMessageView[];
  attachments: AttachmentView[];
}

export interface MessageView {
  id: string;
  authorKind: string;
  authorAccountId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
}

export interface PlatformMessageView extends MessageView {
  internal: boolean;
}

export interface AttachmentView {
  id: string;
  messageId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function summary(ticket: Ticket): TicketSummaryView {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    priority: ticket.priority,
    state: ticket.state,
    assignedAgentId: ticket.assignedAgentId,
    lastActivityAt: ticket.lastActivityAt.toISOString(),
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

/**
 * The company summary omits the company id entirely.
 *
 * A tenant already knows which tenant it is, and echoing the id back invites a
 * client to start sending it — which is the first step towards a handler that
 * reads it.
 */
export const toCompanySummary = summary;

export function toCompanyTicket(
  ticket: Ticket,
  messages: TicketMessage[],
  attachments: TicketAttachment[],
): CompanyTicketView {
  return {
    ...summary(ticket),
    openedBy: { accountId: ticket.openedByAccountId, email: ticket.openedByEmail },
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messages: messages.map(toMessage),
    attachments: attachments.map(toAttachment),
  };
}

export function toPlatformSummary(ticket: Ticket): PlatformTicketSummaryView {
  return {
    ...summary(ticket),
    company: { id: ticket.companyId, slug: ticket.companySlug },
  };
}

export function toPlatformTicket(
  ticket: Ticket,
  messages: PlatformTicketMessage[],
  attachments: TicketAttachment[],
): PlatformTicketView {
  return {
    ...toPlatformSummary(ticket),
    openedBy: { accountId: ticket.openedByAccountId, email: ticket.openedByEmail },
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    messages: messages.map((message) => ({ ...toMessage(message), internal: message.internal })),
    attachments: attachments.map(toAttachment),
  };
}

function toMessage(message: TicketMessage): MessageView {
  return {
    id: message.id,
    authorKind: message.authorKind,
    authorAccountId: message.authorAccountId,
    authorEmail: message.authorEmail,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}

function toAttachment(attachment: TicketAttachment): AttachmentView {
  return {
    id: attachment.id,
    messageId: attachment.messageId,
    objectKey: attachment.objectKey,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    createdAt: attachment.createdAt.toISOString(),
  };
}
