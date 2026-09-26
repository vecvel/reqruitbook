/**
 * How a subscription price becomes a monthly recurring revenue figure.
 *
 * MRR is the number the console is judged on, so the arithmetic is here, in one
 * place, in integer minor units, with a test — rather than inlined into a SQL
 * SUM where nobody can see what it assumes.
 *
 * ## The rules
 *
 * **Normalisation.** A plan's price is divided by its billing period expressed
 * in whole months: a £1,200/year plan contributes £100/month, a £300/quarter
 * plan contributes £100/month, a £100/month plan contributes £100/month. That
 * is the standard definition and it is the only one under which the three are
 * comparable.
 *
 * **Multi-month plans.** Any period expressible in whole months is normalised
 * the same way. A period that is not — a weekly or daily plan — is *not*
 * approximated, because 52/12 is not a month and a figure that silently rounds
 * a week into 0.23 months is worse than an honest exclusion. Such a plan is
 * reported under `unnormalised` so it is visible rather than lost.
 *
 * **Lifetime and one-off plans.** Excluded from MRR entirely. There is no
 * period to divide by, and the two common fudges — amortising over an invented
 * horizon, or booking the whole amount in the month it was paid — either invent
 * a number or turn a recurring-revenue metric into a cash-receipts one. They
 * are reported separately, as a count and a total, so the revenue they
 * represent is not hidden either.
 *
 * **Rounding.** Each subscription is rounded to the nearest minor unit on its
 * own and the rounded values are summed. Rounding the sum instead would be a
 * penny more accurate and a great deal harder to explain, because no tenant's
 * line in the companies list would then add up to the dashboard total.
 *
 * **Currency.** MRR is never summed across currencies. There is no exchange
 * rate in this service and inventing one would make a headline number that
 * changes with a rate nobody recorded. The dashboard reports one figure per
 * currency and lets the reader decide how to combine them.
 */

/** A billing period that does not recur, and so contributes no MRR. */
export const NON_RECURRING = 0;

/** A period this service cannot express in whole months. */
export const UNNORMALISABLE = -1;

/**
 * Maps a billing period onto whole months.
 *
 * Accepts either an explicit month count from the subscriptions service or one
 * of the period names it publishes. An unrecognised value is
 * {@link UNNORMALISABLE} rather than a guess: a plan silently treated as
 * monthly would overstate MRR twelvefold.
 */
export function intervalToMonths(raw: unknown): number {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0 && raw <= 120) {
    return raw;
  }

  if (typeof raw !== 'string') {
    return UNNORMALISABLE;
  }

  const normalised = raw.trim().toLowerCase().replace(/[\s-]+/g, '_');

  const months: Record<string, number> = {
    monthly: 1,
    month: 1,
    '1_month': 1,
    bimonthly: 2,
    quarterly: 3,
    quarter: 3,
    '3_months': 3,
    semiannual: 6,
    semi_annual: 6,
    biannual: 6,
    half_yearly: 6,
    '6_months': 6,
    yearly: 12,
    year: 12,
    annual: 12,
    annually: 12,
    '12_months': 12,
    biennial: 24,
    lifetime: NON_RECURRING,
    perpetual: NON_RECURRING,
    one_time: NON_RECURRING,
    onetime: NON_RECURRING,
    once: NON_RECURRING,
  };

  const known = months[normalised];
  if (known !== undefined) {
    return known;
  }

  // "18_months" and the like, which a plan editor can produce without anyone
  // adding a name for it.
  const explicit = /^(\d{1,3})_months?$/.exec(normalised);
  if (explicit?.[1]) {
    const count = Number(explicit[1]);
    if (count >= 1 && count <= 120) {
      return count;
    }
  }

  return UNNORMALISABLE;
}

/**
 * The monthly-equivalent contribution of one subscription, in minor units.
 *
 * Returns null when the price does not normalise — a non-recurring plan, a
 * period this service cannot express in months, or a nonsensical price — so a
 * caller has to decide what to do with it instead of silently adding a zero.
 */
export function monthlyEquivalentMinor(priceMinor: number, intervalMonths: number): number | null {
  if (!Number.isFinite(priceMinor) || priceMinor < 0) return null;
  if (!Number.isInteger(intervalMonths) || intervalMonths < 1) return null;
  // Half-up on a non-negative value, which is what a finance reader expects and
  // what Math.round already does there.
  return Math.round(priceMinor / intervalMonths);
}

/* -------------------------------------------------------------------------- */
/* Rolling the per-subscription figure up into a dashboard number             */
/* -------------------------------------------------------------------------- */

/**
 * Subscriptions that share a price, a period and a currency.
 *
 * The projection is grouped in SQL before it reaches here, because a platform
 * with ten thousand tenants has perhaps thirty distinct price points: summing
 * thirty rows in TypeScript costs nothing, and it keeps the arithmetic where it
 * can be read and tested rather than inside an aggregate expression.
 */
export interface SubscriptionPriceGroup {
  currency: string;
  intervalMonths: number;
  priceMinor: number;
  subscriptions: number;
}

export interface MrrByCurrency {
  currency: string;
  /** Monthly recurring revenue in minor units of `currency`. */
  monthlyMinor: number;
  subscriptions: number;
}

export interface MrrSummary {
  /** One figure per currency. Never summed across them — see the file header. */
  byCurrency: MrrByCurrency[];
  /** Lifetime and one-off plans: real revenue, but not *recurring* revenue. */
  nonRecurring: {
    subscriptions: number;
    byCurrency: Array<{ currency: string; totalMinor: number }>;
  };
  /** Plans whose period is not a whole number of months, reported not guessed. */
  unnormalised: { subscriptions: number };
  /**
   * The rules above, in words, carried in the response.
   *
   * A revenue number whose definition lives only in a source file gets
   * misquoted in the first board deck that uses it. Shipping the definition
   * alongside the figure is cheaper than correcting that later.
   */
  normalisation: string[];
}

export const MRR_NORMALISATION: readonly string[] = [
  'A recurring plan contributes price / billing period in whole months, so a yearly and a monthly plan of equal annual value count the same.',
  'Each subscription is rounded to the nearest minor unit on its own, then summed, so a tenant line always adds up to the total.',
  'Lifetime and one-off plans are excluded from MRR and reported separately under nonRecurring.',
  'A period that is not a whole number of months (weekly, daily) is not approximated; it is counted under unnormalised.',
  'Currencies are never combined: there is no exchange rate in this service, and inventing one would move the headline figure with a rate nobody recorded.',
];

/** Rolls grouped subscription prices up into the dashboard's revenue block. */
export function summariseMrr(groups: readonly SubscriptionPriceGroup[]): MrrSummary {
  const recurring = new Map<string, MrrByCurrency>();
  const nonRecurring = new Map<string, number>();
  let nonRecurringCount = 0;
  let unnormalisedCount = 0;

  for (const group of groups) {
    const count = Number.isSafeInteger(group.subscriptions) && group.subscriptions > 0 ? group.subscriptions : 0;
    if (count === 0) continue;

    const currency = group.currency.toUpperCase();

    if (group.intervalMonths === UNNORMALISABLE) {
      unnormalisedCount += count;
      continue;
    }

    if (group.intervalMonths === NON_RECURRING) {
      nonRecurringCount += count;
      nonRecurring.set(currency, (nonRecurring.get(currency) ?? 0) + group.priceMinor * count);
      continue;
    }

    const monthly = monthlyEquivalentMinor(group.priceMinor, group.intervalMonths);
    if (monthly === null) {
      // A period the projection accepted but the arithmetic cannot use — a
      // negative price, say. Counted as unnormalisable rather than as zero,
      // because a subscription silently worth nothing understates MRR with no
      // trace of having done so.
      unnormalisedCount += count;
      continue;
    }

    const existing = recurring.get(currency) ?? { currency, monthlyMinor: 0, subscriptions: 0 };
    existing.monthlyMinor += monthly * count;
    existing.subscriptions += count;
    recurring.set(currency, existing);
  }

  return {
    byCurrency: [...recurring.values()].sort((a, b) => b.monthlyMinor - a.monthlyMinor),
    nonRecurring: {
      subscriptions: nonRecurringCount,
      byCurrency: [...nonRecurring.entries()]
        .map(([currency, totalMinor]) => ({ currency, totalMinor }))
        .sort((a, b) => b.totalMinor - a.totalMinor),
    },
    unnormalised: { subscriptions: unnormalisedCount },
    normalisation: [...MRR_NORMALISATION],
  };
}
