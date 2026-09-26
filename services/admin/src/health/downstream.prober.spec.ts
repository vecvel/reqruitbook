/**
 * This endpoint exists to be useful during an incident, which is the one time
 * several of its dependencies are down. Everything below is about that: no
 * single slow service may hold up the page, a hung probe must be abandoned, and
 * nothing that comes back from a failed probe may leak into the response.
 */
import { classify, probeAll, type Fetcher } from './downstream.prober';
import type { DownstreamService } from '../config';

const service = (name: string): DownstreamService => ({ name, baseUrl: `http://localhost/${name}` });

describe('classify', () => {
  const cases: Array<[string, number | null, string]> = [
    ['a healthy answer', 200, 'ok'],
    ['a redirect, which still means the process answered', 302, 'ok'],
    ['a service that answered but is unhealthy', 503, 'degraded'],
    ['a service that refused the request', 404, 'degraded'],
    ['a service that did not answer at all', null, 'unreachable'],
  ];

  it.each(cases)('calls %s "%s"', (_label, status, expected) => {
    expect(classify(status)).toBe(expected);
  });

  it('separates "answered badly" from "did not answer"', () => {
    // Different problems: the first is usually that service's dependency, the
    // second is that service. Collapsing them into "down" throws away the first
    // thing an operator asks.
    expect(classify(503)).not.toBe(classify(null));
  });
});

describe('probeAll', () => {
  it('probes every service in parallel rather than one after another', async () => {
    const started: number[] = [];
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    const fetcher: Fetcher = async (url) => {
      started.push(Date.now());
      // The first service hangs. If probes ran in sequence, the second would
      // not have started by the time we assert.
      if (url.includes('slow')) await held;
      return { ok: true, status: 200 };
    };

    const pending = probeAll([service('slow'), service('fast')], 5_000, fetcher);

    await Promise.resolve();
    expect(started).toHaveLength(2);

    release?.();
    const results = await pending;
    expect(results.map((result) => result.status)).toEqual(['ok', 'ok']);
  });

  it('gives up on a service that never answers', async () => {
    const fetcher: Fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => reject(new Error('aborted')));
      });

    const [result] = await probeAll([service('wedged')], 10, fetcher);

    expect(result?.status).toBe('unreachable');
    expect(result?.detail).toBe('no answer within 10ms');
  });

  it('reports one dead service without failing the whole report', async () => {
    const fetcher: Fetcher = async (url) => {
      if (url.includes('dead')) throw Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:8085'), {
        cause: { code: 'ECONNREFUSED' },
      });
      if (url.includes('sick')) return { ok: false, status: 503 };
      return { ok: true, status: 200 };
    };

    const results = await probeAll([service('well'), service('sick'), service('dead')], 1_000, fetcher);

    expect(results.map((result) => result.status)).toEqual(['ok', 'degraded', 'unreachable']);
  });

  it('keeps the order of the configured services', async () => {
    // An operator reads this page down the list; a report that reorders itself
    // by whichever service answered first is a report they have to re-scan
    // every refresh.
    const fetcher: Fetcher = async (url) => ({ ok: true, status: url.includes('a') ? 200 : 200 });
    const results = await probeAll([service('a'), service('b'), service('c')], 1_000, fetcher);

    expect(results.map((result) => result.service)).toEqual(['a', 'b', 'c']);
  });

  it('never puts the underlying error text into the response', async () => {
    const fetcher: Fetcher = async () => {
      throw Object.assign(new Error('connect ECONNREFUSED 10.1.2.3:5432 for postgres://user:s3cret@db'), {
        cause: { code: 'ECONNREFUSED' },
      });
    };

    const [result] = await probeAll([service('identity')], 1_000, fetcher);

    expect(result?.detail).toBe('connection refused');
    expect(result?.detail).not.toContain('s3cret');
    expect(result?.detail).not.toContain('10.1.2.3');
  });

  it('probes /healthz, the liveness endpoint, not readiness', async () => {
    // Liveness answers "is this process alive?". Readiness folds in every
    // dependency, so a readiness probe here would report identity as down
    // because *its* database blipped — one outage rendered ten times.
    const seen: string[] = [];
    const fetcher: Fetcher = async (url) => {
      seen.push(url);
      return { ok: true, status: 200 };
    };

    await probeAll([service('identity')], 1_000, fetcher);
    expect(seen).toEqual(['http://localhost/identity/healthz']);
  });

  it('returns an empty report rather than throwing when nothing is configured', async () => {
    const fetcher: Fetcher = async () => ({ ok: true, status: 200 });
    await expect(probeAll([], 1_000, fetcher)).resolves.toEqual([]);
  });
});
