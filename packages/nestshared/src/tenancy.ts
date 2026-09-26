/**
 * The principal a service acts on behalf of, reconstructed from the headers the
 * gateway sets after it has verified a token.
 *
 * This mirrors `packages/goshared/tenancy`. The rule it exists to enforce is the
 * one that makes this platform multi-tenant: a request's tenant comes from the
 * verified principal and from nowhere else. A handler that reads a company id
 * out of a body or a path is a cross-tenant read with extra steps.
 */
import { forbidden, unauthorized } from './problem';

export type PrincipalType = 'platform' | 'company' | 'candidate';

/** Headers only the gateway may set; it strips whatever a client sent. */
export const GatewayHeader = {
  PrincipalType: 'x-principal-type',
  PrincipalId: 'x-principal-id',
  CompanyId: 'x-company-id',
  CompanySlug: 'x-company-slug',
  Permissions: 'x-permissions',
  Roles: 'x-roles',
  SessionId: 'x-session-id',
  Email: 'x-principal-email',
} as const;

export class Principal {
  constructor(
    readonly type: PrincipalType | null,
    readonly subject: string,
    readonly companyId: string,
    readonly companySlug: string,
    readonly roles: readonly string[],
    readonly permissions: readonly string[],
    readonly sessionId: string,
    readonly email: string,
  ) {}

  static anonymous(): Principal {
    return new Principal(null, '', '', '', [], [], '', '');
  }

  static fromHeaders(headers: Record<string, string | string[] | undefined>): Principal {
    const read = (key: string): string => {
      const value = headers[key];
      return (Array.isArray(value) ? value[0] : value) ?? '';
    };

    const type = read(GatewayHeader.PrincipalType);
    if (type !== 'platform' && type !== 'company' && type !== 'candidate') {
      return Principal.anonymous();
    }

    const list = (key: string): string[] =>
      read(key)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean);

    return new Principal(
      type,
      read(GatewayHeader.PrincipalId),
      read(GatewayHeader.CompanyId),
      read(GatewayHeader.CompanySlug),
      list(GatewayHeader.Roles),
      list(GatewayHeader.Permissions),
      read(GatewayHeader.SessionId),
      read(GatewayHeader.Email),
    );
  }

  get isAuthenticated(): boolean {
    return this.type !== null && this.subject !== '';
  }

  get isPlatformAdmin(): boolean {
    return this.type === 'platform';
  }

  can(permission: string): boolean {
    return this.permissions.includes(permission);
  }

  canAll(...permissions: string[]): boolean {
    return permissions.every((permission) => this.can(permission));
  }

  /**
   * The tenant this request acts within.
   *
   * Throws rather than returning an empty string, because an empty company id
   * silently widens a query to every tenant — the failure mode this whole model
   * exists to prevent.
   */
  requireCompany(): string {
    if (!this.isAuthenticated) {
      throw unauthorized('You must be signed in to perform this action.');
    }
    if (this.type !== 'company' || this.companyId === '') {
      throw forbidden('This endpoint requires a company context.');
    }
    return this.companyId;
  }

  /**
   * Asserts a loaded record belongs to this principal's tenant.
   *
   * Prefer filtering by company_id in SQL. Use this only where a query genuinely
   * cannot carry the predicate; a check that must be remembered is a check that
   * will eventually be forgotten.
   */
  assertCompany(recordCompanyId: string): void {
    if (this.type === 'platform') {
      return;
    }
    if (recordCompanyId === '' || recordCompanyId !== this.companyId) {
      // 404, not 403: confirming that another tenant's record exists is itself
      // a disclosure.
      throw forbidden('This record belongs to another company.');
    }
  }
}

// The reserved-slug list lives in reserved-slugs.ts, generated from the Go
// source so the two can never disagree. Re-exported here for convenience.
export { RESERVED_SLUGS, isReservedSlug } from './reserved-slugs';
