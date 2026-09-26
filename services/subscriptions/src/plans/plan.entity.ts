/**
 * The plan aggregate and its wire representations.
 *
 * Two representations exist on purpose. The platform view carries everything an
 * operator edits; the public view carries only what a pricing page needs. A
 * single shape with fields conditionally stripped is how draft plans and
 * internal sort keys end up on a marketing site.
 */
import type { Entitlements } from '../entitlements/entitlements';
import type { PlanInterval } from '../entitlements/duration';

export type PlanState = 'draft' | 'published' | 'retired';

export interface Plan {
  id: string;
  key: string;
  name: string;
  description: string;
  priceAmount: number;
  priceCurrency: string;
  interval: PlanInterval;
  intervalCount: number;
  trialDays: number;
  entitlements: Entitlements;
  state: PlanState;
  sortOrder: number;
  publishedAt: Date | null;
  retiredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** What a platform operator sees. */
export function toPlanView(plan: Plan) {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    price: { amount: plan.priceAmount, currency: plan.priceCurrency },
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    trialDays: plan.trialDays,
    entitlements: plan.entitlements,
    state: plan.state,
    sortOrder: plan.sortOrder,
    publishedAt: plan.publishedAt,
    retiredAt: plan.retiredAt,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };
}

/**
 * What an anonymous visitor sees.
 *
 * The id is present because it is what POST /v1/billing/subscribe takes; the
 * sort key, lifecycle timestamps and state are not, because a pricing page has
 * no business knowing how the catalogue is managed. Anything added to Plan in
 * future is absent here until somebody decides it belongs on a marketing page.
 */
export function toPublicPlanView(plan: Plan) {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    price: { amount: plan.priceAmount, currency: plan.priceCurrency },
    interval: plan.interval,
    intervalCount: plan.intervalCount,
    trialDays: plan.trialDays,
    entitlements: plan.entitlements,
  };
}
