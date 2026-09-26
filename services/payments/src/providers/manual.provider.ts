/**
 * The manual provider: billing without a payment processor.
 *
 * It exists for two reasons that turn out to be the same reason.
 *
 * 1. A developer with no Stripe account must be able to walk the whole billing
 *    flow — checkout, webhook, invoice, subscription activation. A seam that
 *    only has one implementation is never actually tested as a seam.
 * 2. The platform grants subscriptions outside of billing: a comped account, an
 *    enterprise deal invoiced offline, a support remedy. Those still need a
 *    payment row, an invoice and an activation, and routing them through the
 *    same code path means there is one settlement story rather than two.
 *
 * It is not a stub. Its webhooks are signed and verified like any other
 * provider's, because the route they arrive on is public and "we trust this one
 * because it is ours" is how an unauthenticated caller ends up granting itself
 * a subscription.
 */
import { Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

import { newId } from '../common/ids';
import { toMinor } from '../common/money';
import { ProviderUnsupportedError, WebhookVerificationError } from './provider-error';
import type {
  CheckoutSession,
  CreateCheckoutInput,
  PaymentProvider,
  ProviderPayment,
  ProviderRefund,
  WebhookEvent,
  WebhookEventKind,
} from './payment-provider';

export interface ManualProviderOptions {
  /** HMAC-SHA256 secret shared with whatever settles a manual payment. */
  webhookSecret: string;
  /**
   * Development escape hatch. Configuration refuses to set this in production,
   * so the only way to reach it is to be running locally with no secret set.
   */
  allowUnsigned: boolean;
}

/** The event kinds a manual settlement may assert. */
const KINDS: Record<string, WebhookEventKind> = {
  'payment.succeeded': 'payment.succeeded',
  'payment.failed': 'payment.failed',
  'checkout.cancelled': 'checkout.cancelled',
  'refund.succeeded': 'refund.succeeded',
  'refund.failed': 'refund.failed',
};

export class ManualProvider implements PaymentProvider {
  readonly name = 'manual';

  private readonly logger = new Logger('manual-provider');

  constructor(private readonly options: ManualProviderOptions) {}

  /**
   * True whenever a signature can be verified.
   *
   * The unsigned development mode reports *not* configured, so
   * `GET /v1/payments/config` shows an operator that this deployment cannot
   * take real money rather than quietly claiming it can.
   */
  isConfigured(): boolean {
    return this.options.webhookSecret !== '';
  }

  /**
   * "Opens" a checkout by handing the caller straight back to the portal.
   *
   * There is no hosted page to send anyone to: the money moves out of band. The
   * payment row is already `pending`, and it becomes `succeeded` when a
   * settlement webhook arrives — the same transition, through the same code, as
   * a card payment.
   */
  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession> {
    const checkoutId = newId('mco');

    const url = new URL(input.successUrl);
    url.searchParams.set('checkout', checkoutId);
    url.searchParams.set('provider', this.name);
    // The portal shows "awaiting settlement" rather than "paid": nothing has
    // been paid yet, and claiming otherwise is how a comped account looks like
    // a collected one in a revenue report.
    url.searchParams.set('status', 'pending');

    this.logger.log(
      `manual checkout ${checkoutId} opened for payment ${input.paymentId} (${input.amountMinor} ${input.currency})`,
    );

    return { checkoutId, redirectUrl: url.toString() };
  }

  /**
   * Verifies an HMAC-SHA256 over the raw body.
   *
   * The signature covers the exact bytes received, for the same reason Stripe's
   * does: a parsed and re-serialised body differs in key order and whitespace
   * and would not verify.
   */
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent {
    if (this.options.webhookSecret === '') {
      if (!this.options.allowUnsigned) {
        throw new WebhookVerificationError('manual webhook secret is not configured');
      }
      this.logger.warn('accepting an UNSIGNED manual webhook — development only');
    } else {
      const expected = createHmac('sha256', this.options.webhookSecret).update(rawBody).digest();
      const supplied = decodeSignature(signature);

      // timingSafeEqual throws on a length mismatch, which leaks the digest
      // length; compare lengths separately and still run the constant-time
      // compare so the timing does not depend on the secret either.
      const sameLength = supplied.length === expected.length;
      const padded = sameLength ? supplied : Buffer.alloc(expected.length);
      if (!timingSafeEqual(padded, expected) || !sameLength) {
        throw new WebhookVerificationError('manual webhook signature mismatch');
      }
    }

    return this.parse(rawBody);
  }

  /**
   * Records a refund that some human will move by bank transfer.
   *
   * It returns `succeeded` because there is no asynchronous settlement to wait
   * for: the platform has decided to give the money back, and the ledger should
   * say so. The bank transfer itself is outside this system, which is exactly
   * what "manual" means.
   */
  async refund(providerPaymentId: string, amountMinor: bigint): Promise<ProviderRefund> {
    const refundId = newId('mref');
    this.logger.log(`manual refund ${refundId} recorded against ${providerPaymentId} for ${amountMinor}`);

    return {
      providerRefundId: refundId,
      providerPaymentId,
      amountMinor,
      // The caller supplies the currency from the payment row; a manual refund
      // cannot invent one, and echoing an empty string would be worse.
      currency: '',
      state: 'succeeded',
    };
  }

  /**
   * Unanswerable rather than broken.
   *
   * There is no remote system holding this payment, so the caller should fall
   * back to what our own database knows instead of treating this as an outage.
   */
  async getPayment(_providerPaymentId: string): Promise<ProviderPayment> {
    throw new ProviderUnsupportedError('reading a payment back from the provider');
  }

  // ------------------------------------------------------------------ parse --

  private parse(rawBody: Buffer): WebhookEvent {
    let body: ManualEventBody;
    try {
      body = JSON.parse(rawBody.toString('utf8')) as ManualEventBody;
    } catch {
      throw new WebhookVerificationError('manual webhook body is not valid json');
    }

    // The event id is the idempotency key for the whole flow. A settlement
    // without one could be replayed indefinitely, each replay crediting the
    // subscription again.
    if (typeof body?.id !== 'string' || body.id === '') {
      throw new WebhookVerificationError('manual webhook body has no event id');
    }

    const type = typeof body.type === 'string' ? body.type : '';
    const kind = KINDS[type] ?? 'unhandled';
    const base = { id: body.id, type, raw: body as unknown };

    if (kind === 'unhandled') {
      return { ...base, kind };
    }

    const data = body.data ?? {};

    if (kind === 'refund.succeeded' || kind === 'refund.failed') {
      return {
        ...base,
        kind,
        refund: {
          providerRefundId: text(data.providerRefundId),
          providerPaymentId: text(data.providerPaymentId),
          amountMinor: amount(data.amountMinor),
          currency: text(data.currency).toUpperCase(),
          failureReason: text(data.failureReason),
        },
      };
    }

    return {
      ...base,
      kind,
      payment: {
        // Our own payment id. Everything tenant-scoped is resolved from the row
        // it names — never from a company id in this payload, which is
        // attacker-controlled in exactly the way the platform's rules assume.
        reference: text(data.reference),
        providerPaymentId: text(data.providerPaymentId) || text(data.reference),
        providerCheckoutId: text(data.providerCheckoutId),
        amountMinor: amount(data.amountMinor),
        currency: text(data.currency).toUpperCase(),
        cardBrand: text(data.cardBrand),
        cardLast4: text(data.cardLast4),
        failureReason: text(data.failureReason),
      },
    };
  }
}

interface ManualEventBody {
  id?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/** Accepts a bare hex digest or a `sha256=<hex>` header, as most tools emit. */
function decodeSignature(signature: string): Buffer {
  const value = signature.trim().replace(/^sha256=/i, '');
  if (!/^[0-9a-f]*$/i.test(value) || value.length % 2 !== 0) {
    return Buffer.alloc(0);
  }
  return Buffer.from(value, 'hex');
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function amount(value: unknown): bigint {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    try {
      return toMinor(value);
    } catch {
      // A malformed amount is a zero, not a crash: the webhook handler compares
      // it against the payment row and rejects the mismatch with a reason.
      return 0n;
    }
  }
  return 0n;
}

/**
 * Signs a body the way this provider verifies it.
 *
 * Exported so an operator tool, a test, or the platform console can settle a
 * manual payment without reimplementing the scheme — and so the signing and
 * verifying sides can never drift apart.
 */
export function signManualWebhook(rawBody: Buffer, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}
