/**
 * The aggregates behind the dashboard.
 *
 * Every query reads this service's own projection and nothing else. That is the
 * boundary the console is built on: no fan-out to ten services on a page load,
 * no join across a database another service owns. The cost is that a figure is
 * as current as the last event delivered, which the response says plainly.
 *
 * The queries run concurrently against one pool. They are independent reads, so
 * there is no transaction: wrapping them in one would buy a consistent instant
 * across six aggregates that are already, by construction, eventually
 * consistent — and would hold a connection for the whole page.
 */
import { Inject, Injectable } from '@nestjs/common';
import type { Pool } from 'pg';

import { toNumber } from '../common/numbers';
import { PG_POOL } from '../common/tokens';
import type { SubscriptionPriceGroup } from './mrr';

export interface StateCount {
  state: string;
  count: number;
}

export interface PlanCount {
  planId: string;
  planName: string;
  count: number;
}

export interface SignupPoint {
  date: string;
  count: number;
}

export interface OverviewAggregates {
  companiesByState: StateCount[];
  activeSubscriptionsByPlan: PlanCount[];
  subscriptionPrices: SubscriptionPriceGroup[];
  signups: SignupPoint[];
  candidates: number;
  publishedJobs: number;
  applications: number;
  openTickets: number;
  /** The newest event this projection has applied; how fresh the page is. */
  lastEventAt: string | null;
}

/** A subscription in one of these states is being paid for right now. */
const BILLABLE_STATES = ['active', 'trialing', 'past_due'];

@Injectable()
export class OverviewRepository {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async aggregate(signupDays: number): Promise<OverviewAggregates> {
    const [byState, byPlan, prices, signups, counters, tickets, freshness] = await Promise.all([
      this.db.query<{ state: string; count: string }>(
        `SELECT state, count(*) AS count FROM companies GROUP BY state ORDER BY count DESC, state`,
      ),

      this.db.query<{ plan_id: string; plan_name: string; count: string }>(
        `SELECT plan_id, plan_name, count(*) AS count
           FROM subscriptions
          WHERE state = ANY($1::text[])
          GROUP BY plan_id, plan_name
          ORDER BY count DESC, plan_name`,
        [BILLABLE_STATES],
      ),

      // Grouped before it leaves the database: a platform with thousands of
      // tenants has a handful of distinct price points, and MRR is then a sum
      // over those rather than over every subscription.
      this.db.query<{ currency: string; interval_months: number; price_minor: string; count: string }>(
        `SELECT currency, interval_months, price_minor, count(*) AS count
           FROM subscriptions
          WHERE state = ANY($1::text[])
          GROUP BY currency, interval_months, price_minor`,
        [BILLABLE_STATES],
      ),

      // generate_series rather than a bare GROUP BY, so a day with no signups
      // is a zero in the series instead of a gap the chart closes up — which
      // would draw a quiet week as a straight line between two busy ones.
      this.db.query<{ date: string; count: string }>(
        `SELECT to_char(day, 'YYYY-MM-DD') AS date, count(c.company_id) AS count
           FROM generate_series(
                  date_trunc('day', now()) - (($1::int - 1) || ' days')::interval,
                  date_trunc('day', now()),
                  '1 day'::interval) AS day
           LEFT JOIN companies c
             ON c.registered_at >= day AND c.registered_at < day + '1 day'::interval
          GROUP BY day
          ORDER BY day`,
        [signupDays],
      ),

      this.db.query<{ candidates: string; jobs: string; applications: string }>(
        `SELECT
           (SELECT coalesce(value, 0) FROM platform_counters WHERE metric = 'candidates_total') AS candidates,
           (SELECT count(*) FROM published_jobs) AS jobs,
           (SELECT coalesce(sum(application_count), 0) FROM company_counters) AS applications`,
      ),

      this.db.query<{ count: string }>(
        `SELECT count(*) AS count FROM support_tickets WHERE status <> 'closed'`,
      ),

      this.db.query<{ last_event_at: Date | null }>(`SELECT max(occurred_at) AS last_event_at FROM activity`),
    ]);

    return {
      companiesByState: byState.rows.map((row) => ({ state: row.state, count: toNumber(row.count) })),
      activeSubscriptionsByPlan: byPlan.rows.map((row) => ({
        planId: row.plan_id,
        planName: row.plan_name,
        count: toNumber(row.count),
      })),
      subscriptionPrices: prices.rows.map((row) => ({
        currency: row.currency,
        intervalMonths: toNumber(row.interval_months),
        priceMinor: toNumber(row.price_minor),
        subscriptions: toNumber(row.count),
      })),
      signups: signups.rows.map((row) => ({ date: row.date, count: toNumber(row.count) })),
      candidates: toNumber(counters.rows[0]?.candidates),
      publishedJobs: toNumber(counters.rows[0]?.jobs),
      applications: toNumber(counters.rows[0]?.applications),
      openTickets: toNumber(tickets.rows[0]?.count),
      lastEventAt: freshness.rows[0]?.last_event_at?.toISOString() ?? null,
    };
  }
}
