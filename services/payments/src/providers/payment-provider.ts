/**
 * The payment provider boundary.
 *
 * Everything Stripe-shaped stops here. The rest of the service speaks only in
 * these types, which is what makes the abstraction real rather than decorative:
 * if a second provider were added tomorrow, nothing in `payments/`, `billing/`
 * or `webhooks/` would change, and `providers/abstraction-boundary.spec.ts`
 * fails the build if any file outside this directory imports the Stripe SDK.
 *
 * The types describe *facts about money*, not a provider's object model. A
 * provider's vocabulary — "payment_intent", "charge", "checkout.session" — is
 * translated on the way in, so a query in this service never has to know which
 * provider took the money.
 */

/** DI token. The concrete provider is chosen at boot from configuration. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');

export interface CreateCheckoutInput {
  /**
   * Our own payment id. It travels to the provider as the reference and comes
   * back on the webhook, which is how a provider event is matched to a tenant
   * without ever trusting a company id from the payload.
   */
  paymentId: string;
  companyId: string;
  planId: string;
  planName: string;
  amountMinor: bigint;
  currency: string;
  /** For the provider's receipt. Never used for authorization. */
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  checkoutId: string;
  redirectUrl: string;
}

export type ProviderPaymentState = 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
export type ProviderRefundState = 'pending' | 'succeeded' | 'failed';

export interface ProviderPayment {
  providerPaymentId: string;
  amountMinor: bigint;
  currency: string;
  state: ProviderPaymentState;
  /** Our payment id, as echoed back by the provider. */
  reference: string;
  /**
   * Display-only instrument details. A brand and four digits are enough for an
   * invoice to say "Visa ending 4242"; nothing more is ever read, stored or
   * logged, because a full number or a CVV in this database would drag the
   * whole platform into PCI-DSS scope for no product benefit.
   */
  cardBrand: string;
  cardLast4: string;
}

export interface ProviderRefund {
  providerRefundId: string;
  providerPaymentId: string;
  amountMinor: bigint;
  currency: string;
  state: ProviderRefundState;
}

/**
 * What a verified webhook means, in this service's vocabulary.
 *
 * `unhandled` is a first-class outcome rather than an error: providers emit
 * dozens of event types and a service that treated an unknown one as a failure
 * would return a non-2xx and be retried forever.
 */
export type WebhookEventKind =
  | 'payment.succeeded'
  | 'payment.failed'
  | 'checkout.cancelled'
  | 'refund.succeeded'
  | 'refund.failed'
  | 'unhandled';

export interface WebhookPaymentFacts {
  /** Our payment id, taken from the provider's reference/metadata. */
  reference: string;
  providerPaymentId: string;
  providerCheckoutId: string;
  amountMinor: bigint;
  currency: string;
  cardBrand: string;
  cardLast4: string;
  /** Already sanitised: a provider's decline message, never an exception. */
  failureReason: string;
}

export interface WebhookRefundFacts {
  providerRefundId: string;
  providerPaymentId: string;
  amountMinor: bigint;
  currency: string;
  failureReason: string;
}

export interface WebhookEvent {
  /** The provider's event id. This is the idempotency key for the whole flow. */
  id: string;
  /** The provider's own type string, recorded so an ignored event is explicable. */
  type: string;
  kind: WebhookEventKind;
  payment?: WebhookPaymentFacts;
  refund?: WebhookRefundFacts;
  /** The verified payload, stored for reconciliation. */
  raw: unknown;
}

export interface PaymentProvider {
  /** Stored on every payment row: a refund must go back to whoever took the money. */
  readonly name: string;

  /**
   * Whether this provider has the credentials it needs. Reported by
   * `GET /v1/payments/config` so an operator can see that billing is live
   * without being shown a secret.
   */
  isConfigured(): boolean;

  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSession>;

  /**
   * Verifies a webhook against the **raw** request body.
   *
   * Signatures are computed over the exact bytes the provider sent. A body that
   * has been parsed and re-serialised differs in key order and whitespace, so it
   * will not verify — which is why the webhook route keeps its body as a Buffer.
   *
   * Synchronous by design: verification is a local HMAC, and making it async
   * would invite a caller to do work before the signature has been checked.
   */
  verifyWebhook(rawBody: Buffer, signature: string): WebhookEvent;

  refund(providerPaymentId: string, amountMinor: bigint): Promise<ProviderRefund>;

  getPayment(providerPaymentId: string): Promise<ProviderPayment>;
}
