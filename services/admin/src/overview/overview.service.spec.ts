/**
 * The dashboard is six aggregates over every tenant on the platform, and it is
 * the page everyone opens at once when something is wrong — which is exactly
 * when the database can least afford six aggregates per viewer. The cache and
 * the single-flight below are load-shedding, so they are worth a test.
 */
import type { AdminConfig } from '../config';
import { OverviewRepository, type OverviewAggregates } from './overview.repository';
import { DEFAULT_SIGNUP_DAYS, MAX_SIGNUP_DAYS, OverviewService, clampDays } from './overview.service';

const aggregates: OverviewAggregates = {
  companiesByState: [{ state: 'active', count: 2 }],
  activeSubscriptionsByPlan: [{ planId: 'plan_pro', planName: 'Pro', count: 2 }],
  subscriptionPrices: [{ currency: 'USD', intervalMonths: 12, priceMinor: 120_000, subscriptions: 2 }],
  signups: [{ date: '2026-03-01', count: 2 }],
  candidates: 5,
  publishedJobs: 3,
  applications: 9,
  openTickets: 1,
  lastEventAt: '2026-03-01T11:00:00.000Z',
};

function serviceWith(ttlMs: number, aggregate = jest.fn().mockResolvedValue(aggregates)) {
  const repository = { aggregate } as unknown as OverviewRepository;
  const config = { overviewTtlMs: ttlMs } as AdminConfig;
  return { service: new OverviewService(repository, config), aggregate };
}

describe('clampDays', () => {
  const cases: Array<[string, number, number]> = [
    ['keeps a sensible window', 90, 90],
    ['defaults an absent one', Number.NaN, DEFAULT_SIGNUP_DAYS],
    ['floors a fractional one', 30.7, 30],
    ['refuses a zero window', 0, DEFAULT_SIGNUP_DAYS],
    ['refuses a negative one', -7, DEFAULT_SIGNUP_DAYS],
    ['caps an absurd one rather than scanning years', 10_000, MAX_SIGNUP_DAYS],
  ];

  it.each(cases)('%s', (_label, input, expected) => {
    expect(clampDays(input)).toBe(expected);
  });
});

describe('snapshot', () => {
  it('computes once and serves the same snapshot within the TTL', async () => {
    const { service, aggregate } = serviceWith(60_000);

    const first = await service.snapshot(30);
    const second = await service.snapshot(30);

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it('recomputes once the snapshot is stale', async () => {
    const { service, aggregate } = serviceWith(0);

    await service.snapshot(30);
    await service.snapshot(30);

    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('caches each window separately', async () => {
    // A 90-day chart must not be served the 30-day series because it asked
    // second.
    const { service, aggregate } = serviceWith(60_000);

    const month = await service.snapshot(30);
    const quarter = await service.snapshot(90);

    expect(aggregate).toHaveBeenCalledTimes(2);
    expect(month.signups.days).toBe(30);
    expect(quarter.signups.days).toBe(90);
  });

  it('runs one computation for callers that arrive together', async () => {
    // Ten operators opening the console during an incident must not become ten
    // concurrent scans of every tenant.
    let release: ((value: OverviewAggregates) => void) | undefined;
    const aggregate = jest.fn().mockReturnValue(
      new Promise<OverviewAggregates>((resolve) => {
        release = resolve;
      }),
    );
    const { service } = serviceWith(60_000, aggregate);

    const callers = [service.snapshot(30), service.snapshot(30), service.snapshot(30)];
    release?.(aggregates);
    const results = await Promise.all(callers);

    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(results[0]).toBe(results[2]);
  });

  it('does not cache a failed computation', async () => {
    // A snapshot that threw must not leave a promise behind that every later
    // caller awaits and re-throws from.
    const aggregate = jest
      .fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValue(aggregates);
    const { service } = serviceWith(60_000, aggregate);

    await expect(service.snapshot(30)).rejects.toThrow('database unavailable');
    await expect(service.snapshot(30)).resolves.toMatchObject({ companies: { total: 2 } });
  });

  it('reports how far behind the read model is, so a stale figure is not read as a wrong one', async () => {
    const { service } = serviceWith(60_000);
    const snapshot = await service.snapshot(30);

    expect(snapshot.projectionUpToDate).toBe('2026-03-01T11:00:00.000Z');
    expect(snapshot.staleAfter > snapshot.generatedAt).toBe(true);
  });

  it('normalises a yearly plan into the MRR figure it carries', async () => {
    const { service } = serviceWith(60_000);
    const snapshot = await service.snapshot(30);

    expect(snapshot.mrr.byCurrency).toEqual([{ currency: 'USD', monthlyMinor: 20_000, subscriptions: 2 }]);
    expect(snapshot.mrr.normalisation.length).toBeGreaterThan(0);
  });
});
