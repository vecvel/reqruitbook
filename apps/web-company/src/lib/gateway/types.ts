/**
 * The shapes the platform services actually return.
 *
 * Written from the live API rather than from the service source, so that what
 * this app parses is what the gateway sends. Note that the list envelope is not
 * uniform across services — jobs answers `{jobs, nextCursor}`, applications
 * `{applications, nextCursor}`, candidates and messaging `{data}`, and the
 * NestJS services `{items, nextCursor}`. Each reader below names the key it
 * expects rather than guessing, and `unwrap` in ./list.ts is the one place that
 * tolerates the difference.
 */

export interface PlatformSalary {
  min: number;
  max: number;
  currency: string;
  isPublic?: boolean;
}

export interface PlatformJob {
  id: string;
  companyId: string;
  slug: string;
  title: string;
  department: string;
  locations: string[];
  workMode: string;
  employmentType: string;
  seniority: string;
  description: string;
  requirements: string;
  salary: PlatformSalary;
  headcount: number;
  internalNotes?: string;
  hiringManagerId?: string;
  recruiterId?: string;
  status: "draft" | "open" | "on_hold" | "closed" | "archived";
  visibility: { portal: boolean; network: boolean };
  formVersion?: number;
  openedAt?: string | null;
  closedAt?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformPublicJob {
  id: string;
  slug: string;
  title: string;
  department: string;
  locations: string[];
  workMode: string;
  employmentType: string;
  seniority: string;
  salary?: { min: number; max: number; currency: string };
  publishedAt?: string;
  description?: string;
  requirements?: string;
}

export interface PlatformFormField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  helpText?: string;
  options?: { value: string; label: string }[];
  validation?: Record<string, unknown>;
}

export interface PlatformApplicationForm {
  fields: PlatformFormField[];
}

export interface PlatformApplication {
  id: string;
  jobId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName?: string;
  answers: Record<string, unknown>;
  source: string;
  stageId: string;
  stageName?: string;
  stageType?: string;
  stageColor?: string;
  status: string;
  rejectionReasonId?: string;
  rejectionNote?: string;
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformStage {
  id: string;
  key: string;
  name: string;
  order: number;
  type: string;
  isTerminal: boolean;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformRejectionReason {
  id: string;
  label: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformApplicationEvent {
  id: string;
  applicationId: string;
  type: string;
  fromStageId?: string;
  toStageId?: string;
  actorId?: string;
  note?: string;
  createdAt: string;
}

export interface PlatformPoolCandidate {
  id: string;
  companyId: string;
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  headline?: string;
  currentTitle?: string;
  currentEmployer?: string;
  yearsExperience?: number;
  skills?: string[];
  tags?: string[];
  source?: string;
  resumeKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTalentProfile {
  candidateId: string;
  fullName: string;
  headline?: string;
  location?: string;
  yearsExperience?: number;
  skills?: string[];
  currentTitle?: string;
  currentEmployer?: string;
  openToRemote?: boolean;
  openToTypes?: string[];
}

export interface PlatformConversation {
  id: string;
  candidateAccountId?: string;
  companyId?: string;
  applicationId?: string;
  jobId?: string;
  subject?: string;
  origin: string;
  openedByAccountId?: string;
  lastActivityAt: string;
  lastMessagePreview?: string;
  lastMessageSender?: string;
  unreadCount: number;
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformMessage {
  id: string;
  conversationId: string;
  senderType: string;
  senderAccountId?: string;
  body: string;
  attachments?: { name?: string; key?: string; contentType?: string; sizeBytes?: number }[];
  sentAt: string;
  readAt?: string | null;
}

export interface PlatformCompanyProfile {
  id: string;
  slug: string;
  state: string;
  legalName: string;
  displayName: string;
  description: string;
  logoKey: string;
  website: string;
  industry: string;
  size: string;
  foundedYear: number | null;
  headquarters: string;
  country: string;
  locations: { city: string; country: string; isHeadquarters?: boolean }[];
  socialLinks: Record<string, string>;
  contactEmail: string;
  contactPhone: string;
  careersPortal: {
    brandColor: string;
    heroImageKey: string;
    tagline: string;
    aboutMarkdown: string;
    benefits: string[];
    customDomain: string;
    customDomainVerified: boolean;
    published: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PlatformEntitlements {
  maxJobs: number | null;
  maxRecruiters: number | null;
  maxApplicationsPerMonth: number | null;
  canPublishToNetwork: boolean;
  canUseTalentSearch: boolean;
  canUseMessaging: boolean;
  supportTier: string;
  storageGb: number | null;
}

export interface PlatformSubscription {
  id: string;
  companyId: string;
  planId: string;
  state: string;
  startedAt: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  expiresAt: string | null;
  trialEndsAt: string | null;
  cancelAtPeriodEnd: boolean;
  cancelledAt: string | null;
  entitlements: PlatformEntitlements;
  price: { amount: number; currency: string; interval: string; intervalCount: number };
  createdAt: string;
  updatedAt: string;
}

export interface PlatformBilling {
  subscription: PlatformSubscription | null;
  entitlements: PlatformEntitlements;
  state: string;
  live: boolean;
}

export interface PlatformPlan {
  id: string;
  key: string;
  name: string;
  description: string;
  price: { amount: number; currency: string };
  interval: string;
  intervalCount: number;
  trialDays: number;
  entitlements: PlatformEntitlements;
}

export interface PlatformNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  readAt?: string | null;
  createdAt: string;
}

export interface PlatformSupportTicket {
  id: string;
  companyId: string;
  subject: string;
  body?: string;
  status: string;
  priority: string;
  category?: string;
  createdBy?: string;
  assignedTo?: string | null;
  lastReplyAt?: string | null;
  createdAt: string;
  updatedAt: string;
}
