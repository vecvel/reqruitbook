/**
 * The test that makes the provider abstraction real rather than decorative.
 *
 * An interface whose implementation types leak out of its directory is
 * documentation, not a seam: the second provider is added, and half the service
 * still needs rewriting because a query somewhere imported Stripe's `Refund`
 * type "just for the shape". This fails the build the moment that starts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const PROVIDERS_DIR = resolve(__dirname);

/** Any form of `import … from 'stripe'` or `require('stripe')`. */
const STRIPE_IMPORT = /(?:from\s+['"]stripe['"])|(?:require\(\s*['"]stripe['"]\s*\))|(?:import\s*\(\s*['"]stripe['"]\s*\))/;

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      found.push(...sourceFiles(full));
    } else if (entry.endsWith('.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('provider abstraction boundary', () => {
  const files = sourceFiles(SRC);

  it('finds the service source, so a passing run means something', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it('keeps the Stripe SDK inside src/providers', () => {
    const offenders = files
      .filter((file) => !file.startsWith(PROVIDERS_DIR))
      .filter((file) => STRIPE_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(SRC, file));

    expect(offenders).toEqual([]);
  });

  it('keeps it in exactly one file even inside src/providers', () => {
    // One implementation file per SDK. A second one importing Stripe would mean
    // provider-specific handling had started spreading inside the boundary too.
    const importers = files
      .filter((file) => file.startsWith(PROVIDERS_DIR))
      .filter((file) => !file.endsWith('.spec.ts'))
      .filter((file) => STRIPE_IMPORT.test(readFileSync(file, 'utf8')))
      .map((file) => relative(PROVIDERS_DIR, file));

    expect(importers).toEqual(['stripe.provider.ts']);
  });
});
