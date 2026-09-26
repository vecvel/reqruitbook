/**
 * Which provider a process ends up with.
 *
 * The manual provider being the default is not a convenience — it is what makes
 * the platform run with no Stripe account at all, which is how every local run
 * and every platform-granted subscription works. If this selection ever quietly
 * required Stripe keys, billing would break for everyone who has none.
 */
import { ManualProvider } from './manual.provider';
import { createProvider } from './providers.module';
import { StripeProvider } from './stripe.provider';
import { loadConfig, type PaymentsConfig } from '../config';

/** Only the variables this service reads; everything else stays as it is. */
const OWNED = [
  'PAYMENT_PROVIDER',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'MANUAL_WEBHOOK_SECRET',
  'PLATFORM_ENV',
  // loadBase refuses to start in production without these, so a test that wants
  // to reach the provider checks has to satisfy it first.
  'POSTGRES_PASSWORD',
  'REDIS_PASSWORD',
  'INTERNAL_SERVICE_TOKEN',
] as const;

/** The minimum loadBase accepts in production. Values are inert placeholders. */
const PRODUCTION_BASE = {
  PLATFORM_ENV: 'production',
  POSTGRES_PASSWORD: 'test-only',
  REDIS_PASSWORD: 'test-only',
  INTERNAL_SERVICE_TOKEN: 'test-only',
} as const;

describe('provider selection', () => {
  const saved = new Map<string, string | undefined>();

  beforeEach(() => {
    for (const key of OWNED) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    saved.clear();
  });

  function config(env: Partial<Record<(typeof OWNED)[number], string>>): PaymentsConfig {
    for (const [key, value] of Object.entries(env)) {
      process.env[key] = value;
    }
    return loadConfig();
  }

  it('defaults to the manual provider when nothing is configured', () => {
    const resolved = config({});
    expect(resolved.provider).toBe('manual');
    expect(createProvider(resolved)).toBeInstanceOf(ManualProvider);
  });

  it('falls back to manual outside production when Stripe is asked for but has no keys', () => {
    // This is the committed .env.example shape: PAYMENT_PROVIDER=stripe with the
    // keys left blank. A developer who has not signed up for Stripe must still
    // be able to walk the whole billing flow.
    const resolved = config({ PAYMENT_PROVIDER: 'stripe', PLATFORM_ENV: 'development' });

    expect(resolved.requestedProvider).toBe('stripe');
    expect(resolved.provider).toBe('manual');
    expect(createProvider(resolved)).toBeInstanceOf(ManualProvider);
  });

  it.each([
    { name: 'no secret key', env: { STRIPE_WEBHOOK_SECRET: 'whsec_x' } },
    { name: 'no webhook secret', env: { STRIPE_SECRET_KEY: 'sk_test_x' } },
    { name: 'neither', env: {} },
  ])('refuses to start in production with $name', ({ env }) => {
    expect(() =>
      config({ PAYMENT_PROVIDER: 'stripe', ...PRODUCTION_BASE, ...env }),
    ).toThrow(/STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET/);
  });

  it('selects Stripe when both keys are present', () => {
    const resolved = config({
      PAYMENT_PROVIDER: 'stripe',
      STRIPE_SECRET_KEY: 'sk_test_not_a_real_key',
      STRIPE_WEBHOOK_SECRET: 'whsec_not_a_real_secret',
    });

    expect(resolved.provider).toBe('stripe');
    const provider = createProvider(resolved);
    expect(provider).toBeInstanceOf(StripeProvider);
    expect(provider.name).toBe('stripe');
    expect(provider.isConfigured()).toBe(true);
  });

  it('refuses an unknown provider name rather than guessing', () => {
    expect(() => config({ PAYMENT_PROVIDER: 'paypal' })).toThrow(/must be "stripe" or "manual"/);
  });

  it('refuses a manual provider with no secret in production', () => {
    // Otherwise any body that reached the public webhook route would settle a
    // payment, which is the whole endpoint's security gone.
    expect(() => config({ PAYMENT_PROVIDER: 'manual', ...PRODUCTION_BASE })).toThrow(
      /MANUAL_WEBHOOK_SECRET/,
    );
  });

  it('reports an unsigned development manual provider as NOT configured', () => {
    const resolved = config({ PAYMENT_PROVIDER: 'manual', PLATFORM_ENV: 'development' });
    expect(resolved.manual.allowUnsigned).toBe(true);
    // GET /v1/payments/config must not claim a deployment can take real money.
    expect(createProvider(resolved).isConfigured()).toBe(false);
  });
});
