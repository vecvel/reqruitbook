/**
 * Entitlements decide whether a tenant's portal opens, so the two failure
 * directions are not symmetric: refusing a paying customer is bad, and granting
 * an unpaying one access is worse. These tests pin the direction each edge case
 * falls in.
 */
import {
  NO_ENTITLEMENTS,
  limitFor,
  parseEntitlements,
  readStoredEntitlements,
  withinLimits,
} from './entitlements';

/** A complete, valid map. Every test varies one thing from this. */
const COMPLETE = {
  maxJobs: 25,
  maxRecruiters: 10,
  maxApplicationsPerMonth: 5000,
  canPublishToNetwork: true,
  canUseTalentSearch: true,
  canUseMessaging: false,
  supportTier: 'priority',
  storageGb: 50,
} as const;

const withField = (patch: Record<string, unknown>): Record<string, unknown> => ({
  ...COMPLETE,
  ...patch,
});

describe('parseEntitlements', () => {
  it('accepts a complete, well-formed map', () => {
    const parsed = parseEntitlements(COMPLETE);

    expect(parsed.maxJobs).toBe(25);
    expect(parsed.canUseTalentSearch).toBe(true);
    expect(parsed.canUseMessaging).toBe(false);
    expect(parsed.supportTier).toBe('priority');
    expect(parsed.storageGb).toBe(50);
  });

  it('requires every entitlement to be stated', () => {
    // The safety property: a plan cannot omit a field and have it default to
    // something permissive. Whoever authors a plan has to say what it grants.
    for (const key of Object.keys(COMPLETE)) {
      const partial = { ...COMPLETE } as Record<string, unknown>;
      delete partial[key];
      expect(() => parseEntitlements(partial)).toThrow();
    }
  });

  it('treats null as unlimited and zero as none', () => {
    // These have to stay distinguishable. Collapsing null onto 0 would silently
    // cap an unlimited plan; collapsing 0 onto null would hand a free tier
    // everything.
    expect(parseEntitlements(withField({ maxJobs: null })).maxJobs).toBeNull();
    expect(parseEntitlements(withField({ maxJobs: 0 })).maxJobs).toBe(0);
  });

  it.each([
    ['a negative limit', { maxJobs: -1 }],
    ['a fractional limit', { maxJobs: 1.5 }],
    ['a numeric string where a number belongs', { maxJobs: '25' }],
    ['a flag that is not a boolean', { canUseTalentSearch: 'yes' }],
    ['a flag left null', { canUseMessaging: null }],
    ['an unknown support tier', { supportTier: 'platinum' }],
    ['negative storage', { storageGb: -5 }],
    ['storage left null', { storageGb: null }],
    ['a key the platform does not define', { unlimitedEverything: true }],
  ])('refuses %s', (_name, patch) => {
    expect(() => parseEntitlements(withField(patch))).toThrow();
  });

  it.each([
    ['a list instead of a map', []],
    ['a string instead of a map', 'unlimited'],
    ['null', null],
    ['a number', 42],
  ])('refuses %s outright', (_name, input) => {
    expect(() => parseEntitlements(input)).toThrow();
  });

  it('refuses an unknown key rather than dropping it', () => {
    // Dropping it would let a plan be authored with a limit nobody enforces,
    // and the mistake would only surface as a customer exceeding a cap the
    // platform never stored.
    expect(() => parseEntitlements(withField({ maxInterviews: 10 }))).toThrow();
  });
});

describe('NO_ENTITLEMENTS', () => {
  it('grants nothing at all', () => {
    // The set a company gets when it has no subscription. Every value here must
    // be the restrictive one: "no plan" must never read as "no limits".
    expect(NO_ENTITLEMENTS.maxJobs).toBe(0);
    expect(NO_ENTITLEMENTS.maxRecruiters).toBe(0);
    expect(NO_ENTITLEMENTS.maxApplicationsPerMonth).toBe(0);
    expect(NO_ENTITLEMENTS.canPublishToNetwork).toBe(false);
    expect(NO_ENTITLEMENTS.canUseTalentSearch).toBe(false);
    expect(NO_ENTITLEMENTS.canUseMessaging).toBe(false);
    expect(NO_ENTITLEMENTS.storageGb).toBe(0);
  });

  it('uses zero rather than null for its limits', () => {
    // null means unlimited here, so a floor built from nulls would be the most
    // generous plan on the platform rather than the least.
    expect(NO_ENTITLEMENTS.maxJobs).not.toBeNull();
    expect(NO_ENTITLEMENTS.maxRecruiters).not.toBeNull();
    expect(NO_ENTITLEMENTS.maxApplicationsPerMonth).not.toBeNull();
  });
});

describe('readStoredEntitlements', () => {
  it('falls back to nothing when a stored row is unreadable', () => {
    // A row written by an older schema, or corrupted, must not read as
    // unlimited. Failing closed here is the difference between a customer
    // seeing a billing error and every customer getting a free upgrade.
    expect(readStoredEntitlements(null)).toEqual(NO_ENTITLEMENTS);
    expect(readStoredEntitlements('not json')).toEqual(NO_ENTITLEMENTS);
    expect(readStoredEntitlements({ maxJobs: 'lots' })).toEqual(NO_ENTITLEMENTS);
    expect(readStoredEntitlements({ maxJobs: 5 })).toEqual(NO_ENTITLEMENTS);
  });

  it('reads a complete stored map', () => {
    expect(readStoredEntitlements(COMPLETE).maxJobs).toBe(25);
  });
});

describe('limitFor and withinLimits', () => {
  const plan = parseEntitlements(withField({ maxJobs: 3, maxRecruiters: null }));

  it('reports a null limit as unlimited', () => {
    expect(limitFor(plan, 'recruiters')).toBeNull();
  });

  it('maps a usage metric onto its entitlement key', () => {
    // The two vocabularies differ on purpose — usage is counted per resource,
    // entitlements are named per plan field — so the mapping is worth pinning.
    expect(limitFor(plan, 'jobs')).toBe(3);
  });

  it('allows usage below the limit', () => {
    expect(withinLimits(plan, { jobs: 2 }).jobs).toBe(true);
  });

  it('allows usage exactly at the limit', () => {
    // At the cap the tenant is still inside it; the caller refuses the next
    // create by asking again with the incremented count.
    expect(withinLimits(plan, { jobs: 3 }).jobs).toBe(true);
  });

  it('refuses usage past the limit', () => {
    expect(withinLimits(plan, { jobs: 4 }).jobs).toBe(false);
  });

  it('never refuses an unlimited metric', () => {
    expect(withinLimits(plan, { recruiters: 10_000 }).recruiters).toBe(true);
  });

  it('reports every metric, so one full resource cannot block another', () => {
    // A recruiter publishing a job must not be refused because storage is full.
    const result = withinLimits(plan, { jobs: 99, recruiters: 1 });
    expect(result.jobs).toBe(false);
    expect(result.recruiters).toBe(true);
  });

  it('refuses everything on a zero limit', () => {
    const free = parseEntitlements(withField({ maxJobs: 0 }));
    expect(withinLimits(free, { jobs: 1 }).jobs).toBe(false);
  });

  it('treats an uncounted metric as zero usage', () => {
    expect(withinLimits(plan, {}).jobs).toBe(true);
  });

  it('grants nothing at all to a company with no subscription', () => {
    // The whole point of the floor: every metric is over its limit the moment
    // anything is used.
    const result = withinLimits(NO_ENTITLEMENTS, { jobs: 1, recruiters: 1, applications: 1 });
    expect(result.jobs).toBe(false);
    expect(result.recruiters).toBe(false);
    expect(result.applications).toBe(false);
  });
});
