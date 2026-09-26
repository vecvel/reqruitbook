/**
 * The public-route budget.
 *
 * The clock is injected so the window boundary is tested without waiting a real
 * minute, and the address extraction is tested because getting it wrong is the
 * difference between limiting an attacker and limiting the gateway.
 */
import { FixedWindowLimiter, clientKey } from './rate-limit';

describe('FixedWindowLimiter', () => {
  it('allows exactly the configured number of requests', () => {
    const limiter = new FixedWindowLimiter(3, () => 0);

    expect([limiter.allow('a'), limiter.allow('a'), limiter.allow('a'), limiter.allow('a')]).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it('counts each client separately', () => {
    const limiter = new FixedWindowLimiter(1, () => 0);

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);
    // One client exhausting its budget must not lock everyone else out.
    expect(limiter.allow('b')).toBe(true);
  });

  it('starts a fresh budget in the next window', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(1, () => now);

    expect(limiter.allow('a')).toBe(true);
    expect(limiter.allow('a')).toBe(false);

    now = 60_000;
    expect(limiter.allow('a')).toBe(true);
  });

  it('holds the budget for the whole window', () => {
    let now = 0;
    const limiter = new FixedWindowLimiter(1, () => now);

    expect(limiter.allow('a')).toBe(true);
    now = 59_999;
    expect(limiter.allow('a')).toBe(false);
  });

  it('refuses everything when the limit is zero', () => {
    expect(new FixedWindowLimiter(0, () => 0).allow('a')).toBe(false);
  });
});

describe('clientKey', () => {
  it('uses the address the gateway observed', () => {
    expect(clientKey({ 'x-forwarded-for': '203.0.113.7' }, '10.0.0.1')).toBe('203.0.113.7');
  });

  it('takes the first entry of a chain', () => {
    expect(clientKey({ 'x-forwarded-for': '203.0.113.7, 10.0.0.2' }, '10.0.0.1')).toBe('203.0.113.7');
  });

  it('handles a repeated header', () => {
    expect(clientKey({ 'x-forwarded-for': ['203.0.113.7', '198.51.100.1'] }, '10.0.0.1')).toBe('203.0.113.7');
  });

  it('falls back to the socket address when the header is absent or blank', () => {
    expect(clientKey({}, '10.0.0.1')).toBe('10.0.0.1');
    expect(clientKey({ 'x-forwarded-for': '   ' }, '10.0.0.1')).toBe('10.0.0.1');
  });
});
