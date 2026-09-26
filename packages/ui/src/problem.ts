/**
 * The error shape every service returns, as a thing the browser can reason about.
 *
 * Both backend runtimes emit RFC 9457 problem+json, so a portal needs exactly
 * one error type rather than one per service. Modelling it as a class means a
 * caller can `catch` and branch on `status` or `code` instead of parsing a
 * response body at every call site.
 */

export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
  /** Field-level messages on a 422, keyed by the field that failed. */
  errors?: Record<string, string[]>;
  requestId?: string;
}

export class ProblemError extends Error {
  readonly status: number;
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly fieldErrors: Record<string, string[]>;
  readonly requestId: string | undefined;
  /** The path that produced the problem, which is what makes a log line useful. */
  readonly instance: string | undefined;

  constructor(body: ProblemBody) {
    super(body.detail || body.title);
    this.name = 'ProblemError';
    this.status = body.status;
    this.code = body.code;
    this.title = body.title;
    this.detail = body.detail;
    this.fieldErrors = body.errors ?? {};
    this.requestId = body.requestId;
    this.instance = body.instance;
  }

  /** The caller is not signed in, or their session expired. */
  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  /** Signed in, but not allowed. Re-authenticating will not help. */
  get isForbidden(): boolean {
    return this.status === 403;
  }

  /** The tenant's subscription does not cover this. */
  get isPaymentRequired(): boolean {
    return this.status === 402;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  /** The first message for a field, for rendering beside an input. */
  fieldError(field: string): string | undefined {
    return this.fieldErrors[field]?.[0];
  }

  /**
   * Builds a Problem from a response, falling back when the body is not one.
   *
   * A gateway timeout, a proxy error page or an empty 502 will not be
   * problem+json, and a portal still has to show the user something truthful
   * rather than crashing on a JSON parse.
   */
  static async fromResponse(response: Response): Promise<ProblemError> {
    const raw = await response.text().catch(() => '');
    return ProblemError.fromBody(response.status, raw, response.statusText);
  }

  /**
   * The same, from a status and a raw body.
   *
   * The server-side transport does not produce a `Response` — it speaks
   * `node:http`, because `fetch` cannot send the Host header the gateway routes
   * on. Both paths land here so a portal's error handling does not depend on
   * which one a call happened to take.
   */
  static fromBody(status: number, raw: string, statusText?: string): ProblemError {
    let body: Partial<ProblemBody> | null = null;
    try {
      body = JSON.parse(raw) as Partial<ProblemBody>;
    } catch {
      body = null;
    }

    if (body && typeof body.status === 'number' && typeof body.code === 'string') {
      return new ProblemError(body as ProblemBody);
    }

    return new ProblemError({
      type: 'about:blank',
      title: statusText || 'Request failed',
      status,
      detail: fallbackDetail(status),
      code: fallbackCode(status),
    });
  }
}

/**
 * What to tell a person when the server did not tell us anything useful.
 *
 * Deliberately free of jargon: these reach a candidate mid-application, not an
 * operator reading logs.
 */
function fallbackDetail(status: number): string {
  if (status === 0) return 'We could not reach the server. Check your connection and try again.';
  if (status === 404) return 'That page or record could not be found.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  return 'That request could not be completed.';
}

function fallbackCode(status: number): string {
  if (status === 0) return 'network_error';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'internal_error';
  return 'bad_request';
}

/** A request that never reached a server at all. */
export function networkProblem(cause: unknown): ProblemError {
  return new ProblemError({
    type: 'about:blank',
    title: 'Network Error',
    status: 0,
    detail: fallbackDetail(0),
    code: 'network_error',
    ...(cause instanceof Error ? { instance: cause.message } : {}),
  });
}

export function isProblem(error: unknown): error is ProblemError {
  return error instanceof ProblemError;
}
