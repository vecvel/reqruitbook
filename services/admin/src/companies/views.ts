/**
 * Response shapes for the tenant views.
 *
 * Money-bearing fields are redacted per principal rather than per route. A
 * support operator needs the tenant list to find a company; they do not need
 * its price or its last card decline. Withholding those fields leaves them the
 * page, which is the difference between a permission model and a set of
 * page-level roles.
 *
 * `null` rather than an omitted key, so a client can tell "you may not see
 * this" from "this build of the API has no such field".
 */
import type { CompanyRow, PaymentRow, TicketRow } from './companies.repository';

export interface Visibility {
  /** `subscriptions.read` — plan, price, billing state. */
  billing: boolean;
  /** `payments.read` — amounts, statuses and decline reasons. */
  payments: boolean;
}

export function toCompanyView(row: CompanyRow, visibility: Visibility): Record<string, unknown> {
  return {
    id: row.companyId,
    slug: row.slug,
    name: row.name,
    state: row.state,
    contactEmail: row.contactEmail,
    country: row.country,
    industry: row.industry,
    registeredAt: row.registeredAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
    suspendedAt: row.suspendedAt?.toISOString() ?? null,
    subscription: visibility.billing ? toSubscriptionView(row) : null,
    lastPayment: visibility.payments ? toPaymentView(row) : null,
    openTickets: row.openTickets,
    usage: {
      applications: row.applications,
      publishedJobs: row.publishedJobs,
    },
  };
}

function toSubscriptionView(row: CompanyRow): Record<string, unknown> | null {
  const subscription = row.subscription;
  if (!subscription) return null;

  return {
    id: subscription.subscriptionId,
    planId: subscription.planId,
    planName: subscription.planName,
    state: subscription.state,
    // Minor units and a currency, never a decimal: a rate that cannot represent
    // 0.1 exactly has no business in a figure finance will reconcile against.
    price: {
      amountMinor: subscription.priceMinor,
      currency: subscription.currency,
      intervalMonths: subscription.intervalMonths,
    },
    startedAt: subscription.startedAt?.toISOString() ?? null,
    expiresAt: subscription.expiresAt?.toISOString() ?? null,
    cancelledAt: subscription.cancelledAt?.toISOString() ?? null,
  };
}

function toPaymentView(row: CompanyRow): Record<string, unknown> | null {
  const payment = row.lastPayment;
  if (!payment) return null;

  return {
    id: payment.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt.toISOString(),
  };
}

export function toPaymentRowView(payment: PaymentRow): Record<string, unknown> {
  return {
    id: payment.id,
    amountMinor: payment.amountMinor,
    currency: payment.currency,
    status: payment.status,
    failureReason: payment.failureReason,
    paidAt: payment.paidAt.toISOString(),
  };
}

export function toTicketView(ticket: TicketRow): Record<string, unknown> {
  return {
    id: ticket.id,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    openedAt: ticket.openedAt.toISOString(),
    lastReplyAt: ticket.lastReplyAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
  };
}
