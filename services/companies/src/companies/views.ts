/**
 * Response shapes.
 *
 * Each audience gets its own projection rather than a single serialiser with
 * flags. A column added to `Company` therefore appears in a response only when
 * someone writes it into the view for that audience, which is the property that
 * keeps `internalNotes` out of a company's own profile response and contact
 * details off the public careers page.
 */
import type { Company } from './domain';

/** What a company sees about itself. */
export interface CompanyProfileView {
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
  locations: Company['locations'];
  socialLinks: Company['socialLinks'];
  contactEmail: string;
  contactPhone: string;
  careersPortal: {
    brandColor: string;
    heroImageKey: string;
    tagline: string;
    aboutMarkdown: string;
    benefits: string[];
    customDomain: string;
    /** Always false today; domain verification is not implemented. */
    customDomainVerified: boolean;
    published: boolean;
  };
  suspensionReason: string;
  createdAt: Date;
  updatedAt: Date;
}

export function toProfileView(company: Company): CompanyProfileView {
  return {
    id: company.id,
    slug: company.slug,
    state: company.state,
    legalName: company.legalName,
    displayName: company.displayName,
    description: company.description,
    logoKey: company.logoKey,
    website: company.website,
    industry: company.industry,
    size: company.size,
    foundedYear: company.foundedYear,
    headquarters: company.headquarters,
    country: company.country,
    locations: company.locations,
    socialLinks: company.socialLinks,
    contactEmail: company.contactEmail,
    contactPhone: company.contactPhone,
    careersPortal: {
      brandColor: company.brandColor,
      heroImageKey: company.heroImageKey,
      tagline: company.tagline,
      aboutMarkdown: company.aboutMarkdown,
      benefits: company.benefits,
      customDomain: company.customDomain,
      customDomainVerified: company.customDomainVerified,
      published: company.portalPublished,
    },
    // The company is told why it was suspended; the platform's private notes
    // about the account are not part of this view.
    suspensionReason: company.suspensionReason,
    createdAt: company.createdAt,
    updatedAt: company.updatedAt,
  };
}

/** What platform staff see. The only view that carries operational fields. */
export interface PlatformCompanyView extends CompanyProfileView {
  ownerEmail: string;
  ownerName: string;
  ownerAccountId: string;
  internalNotes: string;
  approvedAt: Date | null;
  suspendedAt: Date | null;
  deletedAt: Date | null;
}

export function toPlatformView(company: Company): PlatformCompanyView {
  return {
    ...toProfileView(company),
    ownerEmail: company.ownerEmail,
    ownerName: company.ownerName,
    ownerAccountId: company.ownerAccountId,
    internalNotes: company.internalNotes,
    approvedAt: company.approvedAt,
    suspendedAt: company.suspendedAt,
    deletedAt: company.deletedAt,
  };
}
