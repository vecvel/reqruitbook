/**
 * Chooses the payment provider once, at boot.
 *
 * This factory is the only place in the service that knows more than one
 * implementation exists. Everything downstream injects `PAYMENT_PROVIDER` and
 * speaks the interface, which is what lets the platform run with no Stripe
 * account at all — the manual provider is the default, and every local run and
 * every platform-granted subscription goes through it.
 */
import { Global, Logger, Module } from '@nestjs/common';

import { PAYMENTS_CONFIG, type PaymentsConfig } from '../config';
import { ManualProvider } from './manual.provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './payment-provider';
import { StripeProvider } from './stripe.provider';

export function createProvider(config: PaymentsConfig): PaymentProvider {
  const logger = new Logger('provider');

  // `config.provider` is already the *resolved* choice: loadConfig downgrades a
  // requested Stripe to manual outside production when the keys are absent, and
  // refuses to start at all inside production. Re-deciding here would let the
  // two disagree.
  const provider: PaymentProvider =
    config.provider === 'stripe'
      ? new StripeProvider(config.stripe)
      : new ManualProvider(config.manual);

  if (config.provider !== config.requestedProvider) {
    logger.warn(
      `PAYMENT_PROVIDER=${config.requestedProvider} is not configured; ` +
        `falling back to the ${provider.name} provider`,
    );
  }
  logger.log(`payment provider: ${provider.name} (configured: ${provider.isConfigured()})`);

  return provider;
}

@Global()
@Module({
  providers: [
    {
      provide: PAYMENT_PROVIDER,
      inject: [PAYMENTS_CONFIG],
      useFactory: createProvider,
    },
  ],
  exports: [PAYMENT_PROVIDER],
})
export class ProvidersModule {}
