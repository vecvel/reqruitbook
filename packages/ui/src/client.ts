/**
 * The one client every portal talks to the gateway through.
 *
 * Implemented once because the alternative is four subtly different session
 * bugs: refresh races, double-redirects on expiry, retries that replay a POST.
 * The rules here are the ones that are easy to get almost right.
 *
 * The access token lives in memory only. Putting it in `localStorage` would
 * make an XSS a credential theft rather than a page defacement; the refresh
 * token is in an httpOnly cookie the browser never exposes to script, and is
 * exchanged through a same-origin route handler.
 */
import { ProblemError, networkProblem } from './problem';

export interface Session {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  principalType: 'platform' | 'company' | 'candidate';
  accountId: string;
  email: string;
  fullName: string;
  companyId?: string;
  companySlug?: string;
  roles: string[];
  permissions: string[];
}

export interface ApiClientOptions {
  /** Where the gateway is. Same-origin by default, which is how a deployed portal runs. */
  baseUrl?: string;
  /**
   * Exchanges the refresh cookie for a new session.
   *
   * A same-origin route handler, never the gateway directly: the refresh token
   * is httpOnly and the browser cannot read it, which is the point.
   */
  refresh?: () => Promise<Session | null>;
  /** Called once when the session is gone for good. */
  onSignedOut?: () => void;
}

/** Requests that are safe to replay after a refresh. */
const REPLAYABLE = new Set(['GET', 'HEAD', 'OPTIONS']);

export class ApiClient {
  private session: Session | null = null;
  private refreshing: Promise<Session | null> | null = null;
  private readonly options: ApiClientOptions;

  // Written out rather than a parameter property: Node's type-stripping test
  // runner does not support that sugar, and this package is tested without a
  // compile step so the tests exercise the file the apps actually import.
  constructor(options: ApiClientOptions = {}) {
    this.options = options;
  }

  setSession(session: Session | null): void {
    this.session = session;
  }

  getSession(): Session | null {
    return this.session;
  }

  get isAuthenticated(): boolean {
    return this.session !== null;
  }

  async get<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>('GET', path, undefined, init);
  }

  async post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('POST', path, body, init);
  }

  async patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('PATCH', path, body, init);
  }

  async put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return this.request<T>('PUT', path, body, init);
  }

  async delete<T>(path: string, init?: RequestInit): Promise<T> {
    return this.request<T>('DELETE', path, undefined, init);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<T> {
    let response = await this.send(method, path, body, init);

    if (response.status === 401 && this.options.refresh) {
      const session = await this.refreshOnce();

      if (!session) {
        this.session = null;
        this.options.onSignedOut?.();
        throw await ProblemError.fromResponse(response);
      }

      // Replay only what is safe to replay. A POST that reached the service and
      // failed to *respond* would be applied twice; the caller is told to sign
      // in again instead, which is annoying but not a duplicate charge.
      if (!REPLAYABLE.has(method)) {
        throw await ProblemError.fromResponse(response);
      }

      response = await this.send(method, path, body, init);
    }

    if (!response.ok) {
      throw await ProblemError.fromResponse(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async send(
    method: string,
    path: string,
    body?: unknown,
    init?: RequestInit,
  ): Promise<Response> {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');

    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.session) {
      headers.set('Authorization', `Bearer ${this.session.accessToken}`);
    }

    try {
      return await fetch(`${this.options.baseUrl ?? ''}${path}`, {
        ...init,
        method,
        headers,
        // The refresh cookie must travel on the same-origin calls that use it.
        credentials: 'include',
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });
    } catch (cause) {
      throw networkProblem(cause);
    }
  }

  /**
   * Refreshes at most once, however many requests are waiting.
   *
   * Three parallel 401s must not send three refreshes: refresh tokens rotate on
   * use, so the second and third would present a spent token, and the identity
   * service treats a replayed refresh as theft and revokes every session the
   * account has. Sharing one in-flight promise is what prevents a page load
   * from signing the user out of everything.
   */
  private async refreshOnce(): Promise<Session | null> {
    if (this.refreshing) {
      return this.refreshing;
    }

    this.refreshing = (async () => {
      try {
        const session = await this.options.refresh!();
        this.session = session;
        return session;
      } catch {
        this.session = null;
        return null;
      } finally {
        this.refreshing = null;
      }
    })();

    return this.refreshing;
  }
}

/** Builds the portal's client. */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}
