/**
 * Signature Version 4, against a fixed clock.
 *
 * A signature test that only asserts "a signature is present" proves nothing —
 * the bucket is the only thing that can tell us a signature is wrong, and it
 * says so with an opaque 403. So the clock is pinned and the signature is
 * asserted as a value: a change to the canonical request, the signed header
 * list or the encoding breaks this test rather than breaking uploads.
 */
import type { StorageConfig } from '../config';
import { Presigner } from './presigner';

const FIXED_NOW = new Date('2024-05-01T12:00:00.000Z');

function config(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    endpoint: 'http://localhost:9000',
    region: 'us-east-1',
    accessKey: 'test-access',
    secretKey: 'test-secret',
    bucket: 'company-assets',
    pathStyle: true,
    uploadTtlSeconds: 600,
    ...overrides,
  };
}

function presigner(overrides: Partial<StorageConfig> = {}): Presigner {
  return new Presigner(config(overrides), () => FIXED_NOW);
}

describe('construction', () => {
  it.each(['endpoint', 'accessKey', 'secretKey', 'bucket'] as const)(
    'refuses to start without %s, so a misconfigured deploy fails loudly',
    (key) => {
      expect(() => new Presigner(config({ [key]: '' }))).toThrow(/missing configuration/);
    },
  );

  it('refuses an endpoint that is not a URL', () => {
    expect(() => new Presigner(config({ endpoint: 'not a url' }))).toThrow(/not a valid URL/);
  });
});

describe('presignPut', () => {
  it('produces the same signature for the same inputs', () => {
    const first = presigner().presignPut('company/c-1/logo/a.png', 'image/png', 600);
    const second = presigner().presignPut('company/c-1/logo/a.png', 'image/png', 600);

    expect(first.url).toBe(second.url);
  });

  it('signs content-type alongside host, so the browser cannot substitute a type', () => {
    const { url, headers } = presigner().presignPut('company/c-1/logo/a.png', 'image/png', 600);

    expect(url).toContain('X-Amz-SignedHeaders=content-type%3Bhost');
    // The caller is told exactly what to send; a mismatch is rejected by the
    // bucket with an error the user cannot act on.
    expect(headers).toEqual({ 'Content-Type': 'image/png' });
  });

  it('changes the signature when the content type changes', () => {
    const png = presigner().presignPut('k.png', 'image/png', 600).url;
    const jpeg = presigner().presignPut('k.png', 'image/jpeg', 600).url;

    expect(signatureOf(png)).not.toBe(signatureOf(jpeg));
  });

  it('changes the signature when the key changes', () => {
    const a = presigner().presignPut('company/c-1/logo/a.png', 'image/png', 600).url;
    const b = presigner().presignPut('company/c-2/logo/a.png', 'image/png', 600).url;

    expect(signatureOf(a)).not.toBe(signatureOf(b));
  });

  it('puts the bucket in the path when path style is on', () => {
    const { url } = presigner().presignPut('company/c-1/logo/a.png', 'image/png', 600);

    expect(url.startsWith('http://localhost:9000/company-assets/company/c-1/logo/a.png?')).toBe(true);
  });

  it('puts the bucket in the host when path style is off', () => {
    const { url } = presigner({ pathStyle: false }).presignPut('k.png', 'image/png', 600);

    expect(url.startsWith('http://company-assets.localhost:9000/k.png?')).toBe(true);
  });

  it('carries the credential scope and the expiry', () => {
    const { url, expiresAt } = presigner().presignPut('k.png', 'image/png', 600);

    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Credential=test-access%2F20240501%2Fus-east-1%2Fs3%2Faws4_request');
    expect(url).toContain('X-Amz-Date=20240501T120000Z');
    expect(url).toContain('X-Amz-Expires=600');
    expect(expiresAt.toISOString()).toBe('2024-05-01T12:10:00.000Z');
  });

  it('orders query parameters canonically, because the signature covers them', () => {
    const query = presigner().presignPut('k.png', 'image/png', 600).url.split('?')[1]!;
    const names = query.split('&').map((pair) => pair.split('=')[0]!);

    expect(names).toEqual([...names].sort());
  });

  it.each([
    ['zero', 0],
    ['negative', -1],
    ['fractional', 1.5],
    ['beyond the protocol ceiling', 7 * 24 * 60 * 60 + 1],
  ])('rejects an expiry that is %s', (_name, seconds) => {
    expect(() => presigner().presignPut('k.png', 'image/png', seconds)).toThrow(/expiry must be/);
  });

  it('rejects an empty key', () => {
    expect(() => presigner().presignPut('   ', 'image/png', 600)).toThrow(/object key is required/);
  });
});

function signatureOf(url: string): string {
  return new URL(url).searchParams.get('X-Amz-Signature') ?? '';
}
