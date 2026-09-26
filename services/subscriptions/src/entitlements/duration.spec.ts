/**
 * Billing periods are date arithmetic, which is where quiet money bugs live: a
 * period that drifts a few days a year bills a customer thirteen times in the
 * twelfth, and a "lifetime" plan with an expiry date eventually expires.
 */
import { LIFETIME_BUCKET, addDays, addMonths, isPlanInterval, monthBucket, periodEnd } from './duration';

const utc = (iso: string): Date => new Date(iso);

describe('periodEnd', () => {
  it('has no end at all for a lifetime plan', () => {
    // Null, not a far-future date. A sentinel date is a date, and it arrives —
    // so a lifetime customer would be locked out on whatever day it named.
    expect(periodEnd(utc('2026-01-15T00:00:00Z'), 'lifetime', 1)).toBeNull();
  });

  it('adds whole months', () => {
    expect(periodEnd(utc('2026-01-15T00:00:00Z'), 'month', 1)?.toISOString()).toBe(
      '2026-02-15T00:00:00.000Z',
    );
  });

  it('adds several months at once', () => {
    expect(periodEnd(utc('2026-01-15T00:00:00Z'), 'month', 3)?.toISOString()).toBe(
      '2026-04-15T00:00:00.000Z',
    );
  });

  it('treats a year as twelve months', () => {
    expect(periodEnd(utc('2026-03-01T00:00:00Z'), 'year', 1)?.toISOString()).toBe(
      '2027-03-01T00:00:00.000Z',
    );
  });

  it('adds exact days for a day-count plan', () => {
    expect(periodEnd(utc('2026-01-01T00:00:00Z'), 'days', 14)?.toISOString()).toBe(
      '2026-01-15T00:00:00.000Z',
    );
  });
});

describe('addMonths', () => {
  it('clamps to the end of a shorter month instead of rolling over', () => {
    // 31 January + 1 month is 28 February, not 3 March. Rolling over would walk
    // the anniversary forward every short month until the customer is billed an
    // extra time in a year.
    expect(addMonths(utc('2026-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2026-02-28T00:00:00.000Z',
    );
  });

  it('clamps to 29 February in a leap year', () => {
    expect(addMonths(utc('2028-01-31T00:00:00Z'), 1).toISOString()).toBe(
      '2028-02-29T00:00:00.000Z',
    );
  });

  it('does not drift when the clamped date is advanced again', () => {
    // The anniversary is computed from the original start each period, so a
    // February clamp must not permanently move a 31st subscription to the 28th.
    const start = utc('2026-01-31T00:00:00Z');
    expect(addMonths(start, 2).toISOString()).toBe('2026-03-31T00:00:00.000Z');
  });

  it('crosses a year boundary', () => {
    expect(addMonths(utc('2026-11-15T00:00:00Z'), 3).toISOString()).toBe(
      '2027-02-15T00:00:00.000Z',
    );
  });
});

describe('addDays', () => {
  it('adds exact days', () => {
    expect(addDays(utc('2026-01-01T00:00:00Z'), 30).toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('goes backwards for a negative count', () => {
    expect(addDays(utc('2026-01-31T00:00:00Z'), -30).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
  });
});

describe('monthBucket', () => {
  it('groups usage by calendar month in UTC', () => {
    // Usage caps are per month, so the bucket has to be timezone-independent —
    // otherwise a company near midnight UTC would see its quota reset twice.
    expect(monthBucket(utc('2026-03-31T23:59:59Z'))).toBe(monthBucket(utc('2026-03-01T00:00:00Z')));
    expect(monthBucket(utc('2026-04-01T00:00:00Z'))).not.toBe(
      monthBucket(utc('2026-03-31T23:59:59Z')),
    );
  });

  it('has a distinct bucket for usage that never resets', () => {
    expect(LIFETIME_BUCKET).not.toBe(monthBucket(utc('2026-03-01T00:00:00Z')));
  });
});

describe('isPlanInterval', () => {
  it('accepts the four the platform supports', () => {
    for (const interval of ['month', 'year', 'days', 'lifetime']) {
      expect(isPlanInterval(interval)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    for (const interval of ['week', 'quarter', 'MONTH', '', 'forever']) {
      expect(isPlanInterval(interval)).toBe(false);
    }
  });
});
