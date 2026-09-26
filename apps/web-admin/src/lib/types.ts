/**
 * The response shapes this console reads.
 *
 * Declared from each service's serializer rather than inferred from a sample
 * response: a field that is sometimes absent is `| null` here, which forces
 * every page to decide what to render for it instead of printing "undefined".
 */

export interface Money {
  amount: number;
  currency: string;
}

/* ------------------------------------------------------------------ admin -- */

export interface AdminCompany {
  id: string;
  slug: string;
  name: string;
  state: string;
  contactEmail: string;
  country: string;
  industry: string;
  registeredAt: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  /** null when the operator lacks subscriptions.read — withheld, not absent. */
  subscription: {
    id: string;
    planId: string;
    planName: string;
    state: string;
    price: { amountMinor: number; currency: string; intervalMonths: number | null };
    startedAt: string | null;
    expiresAt: string | null;
    cancelledAt: string | null;
  } | null;
  /** null when the operator lacks payments.read. */
  lastPayment: {
    id: string;
    amountMinor: number;
    currency: string;
    status: string;
    failureReason: string;
    paidAt: string;
  } | null;
  openTickets: number;
  usage: { applications: number; publishedJobs: number };
}

export interface AdminPaymentRow {
  id: string;
  amountMinor: number;
  currency: string;
  status: string;
  failureReason: string;
  paidAt: string;
}

export interface AdminTicketRow {
  id: string;
  subject: string;
  status: string;
  priority: string;
  openedAt: string;
  lastReplyAt: string | null;
  closedAt: string | null;
}

export interface ActivityEvent {
  id: string;
  subject: string;
  domain: string;
  action: string;
  companyId: string | null;
  actorId: string;
  correlationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface CompanyDetail {
  company: AdminCompany;
  /** null means "withheld because you may not read payments", not "none". */
  payments: AdminPaymentRow[] | null;
  tickets: AdminTicketRow[];
  activity: ActivityEvent[];
}

export interface ServiceHealth {
  service: string;
  url: string;
  status: string;
  httpStatus: number;
  latencyMs: number;
  detail: string;
}

export interface PlatformHealth {
  status: string;
  checkedAt: string;
  timeoutMs: number;
  services: ServiceHealth[];
}

/* -------------------------------------------------------------- companies -- */

/** The companies service's own record, richer than the admin projection. */
export interface PlatformCompany {
  id: string;
  slug: string;
  state: string;
  legalName: string;
  displayName: string;
  description: string;
  website: string;
  industry: string;
  size: string;
  foundedYear: number | null;
  headquarters: string;
  country: string;
  contactEmail: string;
  contactPhone: string;
  suspensionReason: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  ownerEmail?: string;
  ownerName?: string;
  ownerAccountId?: string;
}

/* ----------------------------------------------------------------- plans -- */

export const PLAN_INTERVALS = ["month", "year", "days", "lifetime"] as const;
export type PlanInterval = (typeof PLAN_INTERVALS)[number];

export const SUPPORT_TIERS = ["community", "standard", "priority", "dedicated"] as const;
export type SupportTier = (typeof SUPPORT_TIERS)[number];

/** `null` on a numeric limit means unlimited; 0 means none allowed. */
export interface Entitlements {
  maxJobs: number | null;
  maxRecruiters: number | null;
  maxApplicationsPerMonth: number | null;
  canPublishToNetwork: boolean;
  canUseTalentSearch: boolean;
  canUseMessaging: boolean;
  supportTier: SupportTier;
  storageGb: number;
}

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string;
  price: Money;
  interval: PlanInterval;
  intervalCount: number;
  trialDays: number;
  entitlements: Entitlements;
  state: "draft" | "published" | "retired";
  sortOrder: number;
  publishedAt: string | null;
  retiredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/* --------------------------------------------------------- subscriptions -- */

export const SUBSCRIPTION_STATES = [
  "pending",
  "trialing",
  "active",
  "past_due",
  "cancelled",
  "expired",
] as const;

export interface Subscription {
  id: string;
  companyId: string;
  planId: string;
  state: string;
  startedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  expiresAt: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  entitlements: Entitlements;
  price: { amount: number; currency: string; interval: string; intervalCount: number };
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------- payments -- */

export interface PaymentAmount {
  minor: number;
  currency: string;
}

export interface Payment {
  id: string;
  companyId: string;
  provider: string;
  planId: string | null;
  subscriptionId: string | null;
  state: string;
  amount: PaymentAmount;
  refunded: PaymentAmount;
  failureReason: string;
  card: { brand: string; last4: string } | null;
  providerCheckoutId: string;
  providerPaymentId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  state: string;
  amount: PaymentAmount;
  reason: string;
  requestedBy: string;
  providerRefundId: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentDetail = Payment & { refunds: Refund[] };

export interface PaymentsConfig {
  provider: string;
  requestedProvider: string;
  configured: boolean;
  webhookConfigured: boolean;
  environment: string;
  defaultCurrency: string;
}

/* --------------------------------------------------------------- support -- */

export const TICKET_STATES = [
  "open",
  "awaiting_customer",
  "awaiting_support",
  "resolved",
  "closed",
] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_CATEGORIES = [
  "billing",
  "technical",
  "account",
  "feature_request",
  "other",
] as const;

export interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  priority: string;
  state: string;
  assignedAgentId: string | null;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  company: { id: string; slug: string };
}

export interface TicketMessage {
  id: string;
  authorKind: string;
  authorAccountId: string;
  authorEmail: string;
  body: string;
  createdAt: string;
  internal: boolean;
}

export interface TicketAttachment {
  id: string;
  messageId: string;
  objectKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface TicketDetail extends TicketSummary {
  openedBy: { accountId: string; email: string };
  resolvedAt: string | null;
  closedAt: string | null;
  messages: TicketMessage[];
  attachments: TicketAttachment[];
}
