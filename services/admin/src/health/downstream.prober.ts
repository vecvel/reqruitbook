/**
 * Liveness of every service the platform is made of.
 *
 * Three properties matter here and they are all about the incident this page
 * exists for:
 *
 *   1. **Parallel.** `Promise.allSettled` over every service at once. Probed in
 *      sequence, ten services with a 1.5s budget each is a fifteen-second page
 *      — and the one service that is actually down is the one that costs the
 *      full budget. An operator would give up before it rendered.
 *   2. **Bounded.** Each probe is aborted at `timeoutMs`. A hung TCP connection
 *      does not resolve on its own, so without the abort the page waits for the
 *      socket's own timeout, which can be minutes.
 *   3. **Never fails.** A probe that throws is a *result*, not an error. A
 *      health page that 500s because a service is down has failed at the one
 *      job it had.
 *
 * `fetch` is injected so the behaviour above is testable without a network.
 */
import { Inject, Injectable } from '@nestjs/common';

import { ADMIN_CONFIG } from '../common/tokens';
import type { AdminConfig, DownstreamService } from '../config';

export type ProbeStatus = 'ok' | 'degraded' | 'unreachable';

export interface ProbeResult {
  service: string;
  url: string;
  status: ProbeStatus;
  httpStatus: number | null;
  latencyMs: number;
  /** Short, safe reason a probe did not succeed. Never a stack or a secret. */
  detail: string;
}

export interface ProbeReport {
  status: 'ok' | 'degraded';
  checkedAt: string;
  timeoutMs: number;
  services: ProbeResult[];
}

/** The subset of `fetch` this prober uses, so a test can supply its own. */
export type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; status: number }>;

/**
 * Turns one probe outcome into a status.
 *
 * A service that answers 503 is *reachable but unhealthy*, which is a different
 * operational problem from one that does not answer at all: the first is
 * usually a dependency of that service, the second is the service itself.
 * Collapsing them into "down" throws away the first thing an operator asks.
 */
export function classify(httpStatus: number | null): ProbeStatus {
  if (httpStatus === null) return 'unreachable';
  return httpStatus >= 200 && httpStatus < 400 ? 'ok' : 'degraded';
}

export async function probeAll(
  services: readonly DownstreamService[],
  timeoutMs: number,
  fetcher: Fetcher,
  now: () => number = () => Date.now(),
): Promise<ProbeResult[]> {
  const settled = await Promise.allSettled(
    services.map((service) => probeOne(service, timeoutMs, fetcher, now)),
  );

  return settled.map((outcome, index) => {
    if (outcome.status === 'fulfilled') return outcome.value;

    // Belt and braces: probeOne already catches. If a future change lets
    // something escape, the page still renders with that service marked down
    // rather than failing entirely.
    const service = services[index]!;
    return {
      service: service.name,
      url: `${service.baseUrl}/healthz`,
      status: 'unreachable' as const,
      httpStatus: null,
      latencyMs: 0,
      detail: 'probe failed',
    };
  });
}

async function probeOne(
  service: DownstreamService,
  timeoutMs: number,
  fetcher: Fetcher,
  now: () => number,
): Promise<ProbeResult> {
  const url = `${service.baseUrl}/healthz`;
  const started = now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  // Nothing should be kept alive by a health probe's timer.
  timer.unref?.();

  try {
    const response = await fetcher(url, { signal: controller.signal });
    return {
      service: service.name,
      url,
      status: classify(response.status),
      httpStatus: response.status,
      latencyMs: now() - started,
      detail: '',
    };
  } catch (error) {
    const aborted = controller.signal.aborted;
    return {
      service: service.name,
      url,
      status: 'unreachable',
      httpStatus: null,
      latencyMs: now() - started,
      // A fetch error message can carry a resolved address or a TLS detail.
      // The operator needs the shape of the failure, not its internals.
      detail: aborted ? `no answer within ${timeoutMs}ms` : shortReason(error),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** A connection-level reason, with nothing from the error's own text. */
function shortReason(error: unknown): string {
  const code = (error as { cause?: { code?: string }; code?: string } | null)?.cause?.code ??
    (error as { code?: string } | null)?.code;

  switch (code) {
    case 'ECONNREFUSED':
      return 'connection refused';
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'host not resolvable';
    case 'ECONNRESET':
      return 'connection reset';
    case 'CERT_HAS_EXPIRED':
      return 'tls certificate expired';
    default:
      return 'connection failed';
  }
}

@Injectable()
export class DownstreamProber {
  constructor(@Inject(ADMIN_CONFIG) private readonly config: AdminConfig) {}

  async report(): Promise<ProbeReport> {
    const services = await probeAll(this.config.downstream, this.config.healthTimeoutMs, defaultFetcher);

    return {
      status: services.every((service) => service.status === 'ok') ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      timeoutMs: this.config.healthTimeoutMs,
      services,
    };
  }
}

const defaultFetcher: Fetcher = (url, init) =>
  fetch(url, { ...init, method: 'GET', headers: { accept: 'application/json' } });
