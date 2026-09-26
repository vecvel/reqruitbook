/**
 * MRR is the number this console is judged on, and the ways it goes wrong are
 * quiet: a yearly plan counted at its full price overstates revenue twelvefold,
 * a lifetime plan amortised over an invented horizon invents revenue outright,
 * and two currencies added together produce a figure that is not money at all.
 * Every case below is one of those.
 */
import {
  MRR_NORMALISATION,
  NON_RECURRING,
  UNNORMALISABLE,
  intervalToMonths,
  monthlyEquivalentMinor,
  summariseMrr,
  type SubscriptionPriceGroup,
} from './mrr';

describe('intervalToMonths', () => {
  const cases: Array<[string, unknown, number]> = [
    ['a monthly plan', 'monthly', 1],
    ['the bare noun', 'month', 1],
    ['a quarter', 'quarterly', 3],
    ['a half year by any of its names', 'semi-annual', 6],
    ['another spelling of the same thing', 'HALF_YEARLY', 6],
    ['a year', 'annual', 12],
    ['a year, spelled differently', 'Yearly', 12],
    ['two years', 'biennial', 24],
    ['an explicit month count a plan editor can produce', '18_months', 18],
    ['an explicit count a publisher sends as a number', 4, 4],
    ['whitespace and casing a publisher did not normalise', '  Quarterly  ', 3],
    ['a lifetime plan, which recurs never', 'lifetime', NON_RECURRING],
    ['a one-off charge', 'one_time', NON_RECURRING],
    ['a weekly plan, which is not a whole number of months', 'weekly', UNNORMALISABLE],
    ['a daily plan', 'daily', UNNORMALISABLE],
    ['a period nobody has taught this service', 'fortnightly', UNNORMALISABLE],
    ['a period that is not a string at all', { months: 12 }, UNNORMALISABLE],
    ['an implausible month count', 1_000, UNNORMALISABLE],
    ['a negative count', -5, UNNORMALISABLE],
  ];

  it.each(cases)('reads %s', (_label, input, expected) => {
    expect(intervalToMonths(input)).toBe(expected);
  });

  it('never guesses monthly for an unknown period', () => {
    // The failure that matters: a yearly plan silently read as monthly would
    // report twelve times its real contribution.
    expect(intervalToMonths('every other tuesday')).not.toBe(1);
  });
});

describe('monthlyEquivalentMinor', () => {
  const cases: Array<[string, number, number, number | null]> = [
    ['a monthly plan contributes its price', 10_000, 1, 10_000],
    ['a yearly plan contributes a twelfth', 120_000, 12, 10_000],
    ['a quarterly plan contributes a third', 30_000, 3, 10_000],
    ['a free plan contributes nothing without being excluded', 0, 12, 0],
    ['rounding is to the nearest minor unit', 100, 3, 33],
    ['and rounds half up', 150, 4, 38],
    ['a non-recurring period has no monthly equivalent', 50_000, NON_RECURRING, null],
    ['neither has an unnormalisable one', 50_000, UNNORMALISABLE, null],
    ['nor does a negative price', -1, 1, null],
  ];

  it.each(cases)('%s', (_label, price, months, expected) => {
    expect(monthlyEquivalentMinor(price, months)).toBe(expected);
  });
});

describe('summariseMrr', () => {
  const group = (over: Partial<SubscriptionPriceGroup> = {}): SubscriptionPriceGroup => ({
    currency: 'USD',
    intervalMonths: 1,
    priceMinor: 10_000,
    subscriptions: 1,
    ...over,
  });

  it('normalises a yearly plan against a monthly one of the same annual value', () => {
    const summary = summariseMrr([
      group({ priceMinor: 120_000, intervalMonths: 12 }),
      group({ priceMinor: 10_000, intervalMonths: 1 }),
    ]);

    expect(summary.byCurrency).toEqual([{ currency: 'USD', monthlyMinor: 20_000, subscriptions: 2 }]);
  });

  it('multiplies by the number of subscriptions on the same price', () => {
    const summary = summariseMrr([group({ priceMinor: 2_500, subscriptions: 40 })]);
    expect(summary.byCurrency[0]?.monthlyMinor).toBe(100_000);
  });

  it('rounds each subscription on its own, so a tenant line adds up to the total', () => {
    // 100/3 is 33.33. Rounding the sum would give 100 for three subscriptions;
    // rounding each gives 99, which is what three rows of "33" add up to on the
    // page next to it.
    const summary = summariseMrr([group({ priceMinor: 100, intervalMonths: 3, subscriptions: 3 })]);
    expect(summary.byCurrency[0]?.monthlyMinor).toBe(99);
  });

  it('never adds two currencies together', () => {
    const summary = summariseMrr([
      group({ currency: 'USD', priceMinor: 10_000 }),
      group({ currency: 'GBP', priceMinor: 8_000 }),
    ]);

    expect(summary.byCurrency).toEqual([
      { currency: 'USD', monthlyMinor: 10_000, subscriptions: 1 },
      { currency: 'GBP', monthlyMinor: 8_000, subscriptions: 1 },
    ]);
  });

  it('treats a currency as the same regardless of how it was cased', () => {
    const summary = summariseMrr([group({ currency: 'usd' }), group({ currency: 'USD' })]);
    expect(summary.byCurrency).toHaveLength(1);
    expect(summary.byCurrency[0]).toEqual({ currency: 'USD', monthlyMinor: 20_000, subscriptions: 2 });
  });

  it('excludes a lifetime plan from MRR but still reports it', () => {
    const summary = summariseMrr([
      group({ priceMinor: 10_000 }),
      group({ priceMinor: 500_000, intervalMonths: NON_RECURRING }),
    ]);

    expect(summary.byCurrency[0]?.monthlyMinor).toBe(10_000);
    expect(summary.nonRecurring).toEqual({
      subscriptions: 1,
      byCurrency: [{ currency: 'USD', totalMinor: 500_000 }],
    });
  });

  it('counts a weekly plan as unnormalisable rather than approximating it', () => {
    const summary = summariseMrr([group({ intervalMonths: UNNORMALISABLE, subscriptions: 7 })]);

    expect(summary.byCurrency).toEqual([]);
    expect(summary.unnormalised.subscriptions).toBe(7);
  });

  it('counts a subscription the arithmetic rejects as unnormalisable, not as zero', () => {
    // A negative price cannot be a monthly figure. Folding it in as zero would
    // understate MRR with nothing on the page to say so.
    const summary = summariseMrr([group({ priceMinor: -100 })]);

    expect(summary.byCurrency).toEqual([]);
    expect(summary.unnormalised.subscriptions).toBe(1);
  });

  it('ignores a group with no subscriptions in it', () => {
    expect(summariseMrr([group({ subscriptions: 0 })]).byCurrency).toEqual([]);
  });

  it('orders currencies by size, so the biggest figure reads first', () => {
    const summary = summariseMrr([
      group({ currency: 'EUR', priceMinor: 1_000 }),
      group({ currency: 'USD', priceMinor: 90_000 }),
    ]);

    expect(summary.byCurrency.map((row) => row.currency)).toEqual(['USD', 'EUR']);
  });

  it('carries its own definition, so the figure cannot be quoted without it', () => {
    expect(summariseMrr([]).normalisation).toEqual([...MRR_NORMALISATION]);
  });
});
