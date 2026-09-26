/**
 * The dashboard snapshot, and the cache in front of it.
 *
 * The overview is six aggregates over the whole platform. It is also the first
 * page every operator opens, several of whom open it at once when something is
 * wrong — which is exactly when the database is least able to run six
 * aggregates per viewer. So a snapshot is computed at most once per TTL and
 * shared, and concurrent callers during a computation await the same promise
 * rather than starting their own.
 *
 * The response carries `generatedAt` and `staleAfter` so a reader can see they
 * are looking at a cached figure. A dashboard that hides its own staleness is
 * how two people end up disagreeing about a number in a meeting.
 */
import { Inject, Injectable } from '@nestjs/common';

import { ADMIN_CONFIG } from '../common/tokens';
import type { AdminConfig } from '../config';
import { summariseMrr, type MrrSummary } from './mrr';
import { OverviewRepository, type PlanCount, type SignupPoint, type StateCount } from './overview.repository';

export interface OverviewSnapshot {
  generatedAt: string;
  staleAfter: string;
  /** When the newest projected event happened; how far behind the read model is. */
  projectionUpToDate: string | null;
  companies: { total: number; byState: StateCount[] };
  subscriptions: { billableTotal: number; byPlan: PlanCount[] };
  mrr: MrrSummary;
  signups: { days: number; points: SignupPoint[]; total: number };
  candidates: { total: number };
  jobs: { published: number };
  applications: { total: number };
  support: { openTickets: number };
}

export const DEFAULT_SIGNUP_DAYS = 30;
export const MAX_SIGNUP_DAYS = 365;

interface CacheEntry {
  expiresAt: number;
  snapshot: OverviewSnapshot;
}

@Injectable()
export class OverviewService {
  private readonly cache = new Map<number, CacheEntry>();
  // Keyed by window, so a request for 90 days does not wait on one for 30.
  private readonly inFlight = new Map<number, Promise<OverviewSnapshot>>();

  constructor(
    private readonly repository: OverviewRepository,
    @Inject(ADMIN_CONFIG) private readonly config: AdminConfig,
  ) {}

  async snapshot(signupDays: number): Promise<OverviewSnapshot> {
    const days = clampDays(signupDays);

    const cached = this.cache.get(days);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.snapshot;
    }

    const existing = this.inFlight.get(days);
    if (existing) return existing;

    const pending = this.compute(days).finally(() => this.inFlight.delete(days));
    this.inFlight.set(days, pending);
    return pending;
  }

  private async compute(days: number): Promise<OverviewSnapshot> {
    const aggregates = await this.repository.aggregate(days);
    const now = Date.now();

    const snapshot: OverviewSnapshot = {
      generatedAt: new Date(now).toISOString(),
      staleAfter: new Date(now + this.config.overviewTtlMs).toISOString(),
      projectionUpToDate: aggregates.lastEventAt,
      companies: {
        total: aggregates.companiesByState.reduce((sum, row) => sum + row.count, 0),
        byState: aggregates.companiesByState,
      },
      subscriptions: {
        billableTotal: aggregates.activeSubscriptionsByPlan.reduce((sum, row) => sum + row.count, 0),
        byPlan: aggregates.activeSubscriptionsByPlan,
      },
      mrr: summariseMrr(aggregates.subscriptionPrices),
      signups: {
        days,
        points: aggregates.signups,
        total: aggregates.signups.reduce((sum, point) => sum + point.count, 0),
      },
      candidates: { total: aggregates.candidates },
      jobs: { published: aggregates.publishedJobs },
      applications: { total: aggregates.applications },
      support: { openTickets: aggregates.openTickets },
    };

    this.cache.set(days, { expiresAt: now + this.config.overviewTtlMs, snapshot });
    return snapshot;
  }
}

/**
 * Bounds the signup window.
 *
 * Clamped rather than rejected: a chart asked for 10,000 days is a UI bug, and
 * answering with the longest supported window is more useful than a 400 on a
 * dashboard's first paint.
 */
export function clampDays(raw: number): number {
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_SIGNUP_DAYS;
  return Math.min(Math.trunc(raw), MAX_SIGNUP_DAYS);
}
