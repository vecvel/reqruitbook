"use server";

import { revalidatePath } from "next/cache";

import { gatewayFetch, gatewayRead } from "@/lib/gateway/client";
import { unwrap } from "@/lib/gateway/list";
import { unavailable } from "@/lib/gateway/unavailable";
import { requirePermission } from "@/lib/rbac/guard";

export type OfferStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "accepted"
  | "declined"
  | "expired";

export interface OfferInput {
  applicationId: string;
  candidateId: string;
  designation: string;
  departmentName: string;
  gradeLevel?: string;
  baseSalary: number;
  currency?: string;
  payFrequency?: string;
  signOnBonus?: number;
  annualBonus?: string;
  equityShares?: string;
  joiningDate: string;
  reportingManager?: string;
  workLocation?: string;
  probationPeriod?: string;
  noticePeriod?: string;
  benefitsSummary?: string;
  templateType?: string;
  customFields?: Array<{ key: string; value: string }>;
  offerLetterContent?: string;
  expiresAt?: Date | null;
}

/**
 * An offer as a screen receives it.
 *
 * The compensation fields are optional rather than required, and that is the
 * type doing real work: the service omits them entirely for a caller without
 * `offers.view_compensation`, so a component that reads `offer.baseSalary` has
 * to decide what to show when it is not there. Typing them as required would
 * have let `undefined` render as "undefined" or, worse, be coerced to 0.
 */
export interface OfferRow extends Omit<OfferInput, "baseSalary"> {
  id: string;
  status: OfferStatus;
  candidateName: string | null;
  jobTitle: string | null;
  createdAt: Date;
  updatedAt: Date;
  baseSalary?: number;
}

/**
 * Offers, served by the offers service.
 *
 * `offers.view_compensation` gates the money, not the offer. The service omits
 * every compensation field from the JSON for a caller without it — absent, not
 * zeroed and not null — so this module does no redaction of its own and must
 * not: a second implementation of that rule is a second chance to get it wrong.
 *
 * "Compensation" includes the offer letter and the custom fields. The portal
 * composes that letter out of the figures, so shipping it while withholding
 * `baseSalary` would withhold nothing.
 * `OfferRow` therefore types the money as optional, and a screen renders "—"
 * where it is missing rather than a misleading 0.
 *
 * Approving, sending and responding are separate capabilities on purpose, so
 * approval authority can be delegated without also handing over the ability to
 * dispatch a letter.
 */

/** What the offers service returns. Money is absent without view_compensation. */
interface PlatformOffer {
  id: string;
  applicationId: string;
  candidateId: string;
  candidateName: string | null;
  jobTitle: string | null;
  status: OfferStatus;
  designation: string;
  departmentName: string;
  gradeLevel?: string;
  joiningDate: string;
  reportingManager?: string;
  workLocation?: string;
  probationPeriod?: string;
  noticePeriod?: string;
  benefitsSummary?: string;
  templateType?: string;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  // Gated together with the money, because both carry it: the letter states the
  // package in prose and a custom field is where an allowance ends up.
  customFields?: Array<{ key: string; value: string }>;
  offerLetterContent?: string;
  baseSalary?: number;
  signOnBonus?: number;
  currency?: string;
  payFrequency?: string;
  annualBonus?: string;
  equityShares?: string;
}

function toOfferRow(offer: PlatformOffer): OfferRow {
  return {
    id: offer.id,
    applicationId: offer.applicationId,
    candidateId: offer.candidateId,
    candidateName: offer.candidateName,
    jobTitle: offer.jobTitle,
    status: offer.status,
    designation: offer.designation,
    departmentName: offer.departmentName,
    gradeLevel: offer.gradeLevel,
    joiningDate: offer.joiningDate,
    reportingManager: offer.reportingManager,
    workLocation: offer.workLocation,
    probationPeriod: offer.probationPeriod,
    noticePeriod: offer.noticePeriod,
    benefitsSummary: offer.benefitsSummary,
    templateType: offer.templateType,
    customFields: offer.customFields,
    offerLetterContent: offer.offerLetterContent,
    expiresAt: offer.expiresAt ? new Date(offer.expiresAt) : null,
    createdAt: new Date(offer.createdAt),
    updatedAt: new Date(offer.updatedAt),
    // Left undefined rather than defaulted: the whole point of the service
    // omitting them is that the reader may not know the number.
    baseSalary: offer.baseSalary,
    signOnBonus: offer.signOnBonus,
    currency: offer.currency,
    payFrequency: offer.payFrequency,
    annualBonus: offer.annualBonus,
    equityShares: offer.equityShares,
  };
}

function revalidateOffers() {
  revalidatePath("/offers");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}
export async function getOffers(params?: {
  status?: string;
  applicationId?: string;
  candidateId?: string;
}): Promise<OfferRow[]> {
  await requirePermission("offers.read");

  return gatewayRead(async () => {
    const payload = await gatewayFetch<unknown>("/api/v1/offers", {
      query: {
        limit: 100,
        ...(params?.status && params.status !== "all" ? { status: params.status } : {}),
        ...(params?.applicationId ? { applicationId: params.applicationId } : {}),
        ...(params?.candidateId ? { candidateId: params.candidateId } : {}),
      },
    });
    return unwrap<PlatformOffer>(payload, "offers").map(toOfferRow);
  }, []);
}

export async function getOfferById(id: string): Promise<OfferRow | null> {
  await requirePermission("offers.read");

  try {
    const offer = await gatewayFetch<PlatformOffer>(`/api/v1/offers/${encodeURIComponent(id)}`);
    return toOfferRow(offer);
  } catch (error) {
    // A 404 here is also what another tenant's id looks like, by design.
    if (typeof error === "object" && error !== null && (error as { status?: number }).status === 404) {
      return null;
    }
    throw error;
  }
}

export async function createOffer(data: OfferInput) {
  // Drafting a package means setting numbers, so it also requires the ability
  // to see them.
  await requirePermission("offers.create", "offers.view_compensation");

  const offer = await gatewayFetch<PlatformOffer>("/api/v1/offers", {
    method: "POST",
    body: {
      applicationId: data.applicationId,
      candidateId: data.candidateId,
      designation: data.designation,
      departmentName: data.departmentName,
      baseSalary: data.baseSalary,
      joiningDate: data.joiningDate,
      ...(data.gradeLevel ? { gradeLevel: data.gradeLevel } : {}),
      ...(data.currency ? { currency: data.currency } : {}),
      ...(data.payFrequency ? { payFrequency: data.payFrequency } : {}),
      ...(data.signOnBonus !== undefined ? { signOnBonus: data.signOnBonus } : {}),
      ...(data.annualBonus ? { annualBonus: data.annualBonus } : {}),
      ...(data.equityShares ? { equityShares: data.equityShares } : {}),
      ...(data.reportingManager ? { reportingManager: data.reportingManager } : {}),
      ...(data.workLocation ? { workLocation: data.workLocation } : {}),
      ...(data.probationPeriod ? { probationPeriod: data.probationPeriod } : {}),
      ...(data.noticePeriod ? { noticePeriod: data.noticePeriod } : {}),
      ...(data.benefitsSummary ? { benefitsSummary: data.benefitsSummary } : {}),
      ...(data.templateType ? { templateType: data.templateType } : {}),
      ...(data.customFields ? { customFields: data.customFields } : {}),
      ...(data.offerLetterContent ? { offerLetterContent: data.offerLetterContent } : {}),
      ...(data.expiresAt ? { expiresAt: new Date(data.expiresAt).toISOString() } : {}),
    },
  });

  revalidateOffers();
  return { success: true as const, offer: toOfferRow(offer) };
}

/**
 * Moving an offer along its lifecycle.
 *
 * Each step is its own endpoint rather than a status field, because each needs a
 * different permission — submitting is not approving, and approving is not
 * sending. Mapping them here keeps the existing screen's single "set status"
 * call working while the service enforces who may do which.
 */
export async function updateOfferStatus(id: string, status: OfferStatus) {
  const path = `/api/v1/offers/${encodeURIComponent(id)}`;

  switch (status) {
    case "pending_approval":
      await requirePermission("offers.create");
      await gatewayFetch(`${path}/submit`, { method: "POST" });
      break;
    case "approved":
      await requirePermission("offers.approve");
      await gatewayFetch(`${path}/approve`, { method: "POST" });
      break;
    case "sent":
      await requirePermission("offers.send");
      // The send is the one step with a side effect outside the platform, so it
      // carries a key derived from the offer: a double-clicked button must not
      // dispatch two letters.
      await gatewayFetch(`${path}/send`, { method: "POST", idempotencyKey: `offer-send:${id}` });
      break;
    case "accepted":
    case "declined":
      await requirePermission("offers.update");
      await gatewayFetch(`${path}/respond`, { method: "POST", body: { outcome: status } });
      break;
    default:
      await requirePermission("offers.update");
      await gatewayFetch(path, { method: "PATCH", body: { status } });
  }

  revalidateOffers();
  return { success: true as const };
}

export async function syncOfferToHRM(_id: string) {
  await requirePermission("offers.update");
  return { success: false as const, unavailable: unavailable("integrations"), error: unavailable("integrations").blockedOn };
}

export async function deleteOffer(id: string) {
  await requirePermission("offers.delete");

  await gatewayFetch(`/api/v1/offers/${encodeURIComponent(id)}`, { method: "DELETE" });

  revalidateOffers();
  return { success: true as const };
}
