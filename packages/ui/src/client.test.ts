import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { ApiClient, type Session } from './client';
import { ProblemError } from './problem';

const session = (token: string): Session => ({
  accessToken: token,
  expiresAt: Date.now() + 900_000,
  principalType: 'company',
  accountId: 'acc_1',
  email: 'a@b.test',
  fullName: 'A B',
  companyId: 'co_1',
  roles: ['recruiter'],
  permissions: ['jobs.read'],
});

interface Call {
  url: string;
  method: string;
  authorization: string | null;
}

/** Replaces global fetch with a scripted sequence, recording every call. */
function scriptFetch(responses: Array<() => Response>): Call[] {
  const calls: Call[] = [];
  let index = 0;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(input),
      method: init?.method ?? 'GET',
      authorization: headers.get('Authorization'),
    });
    const next = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return next!();
  }) as typeof fetch;

  return calls;
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const problem = (status: number, code: string): Response =>
  json(status, { type: 'about:blank', title: 'x', status, detail: 'x', code });

beforeEach(() => {
  delete (globalThis as { fetch?: unknown }).fetch;
});

test('attaches the access token once a session is set', async () => {
  const calls = scriptFetch([() => json(200, { ok: true })]);
  const client = new ApiClient();
  client.setSession(session('tok_1'));

  await client.get('/api/v1/jobs');

  assert.equal(calls[0]?.authorization, 'Bearer tok_1');
});

test('sends no Authorization header when signed out', async () => {
  const calls = scriptFetch([() => json(200, {})]);
  await new ApiClient().get('/api/v1/public/jobs');

  assert.equal(calls[0]?.authorization, null);
});

test('refreshes once on 401 and replays a GET', async () => {
  const calls = scriptFetch([
    () => problem(401, 'token_expired'),
    () => json(200, { ok: true }),
  ]);

  let refreshes = 0;
  const client = new ApiClient({
    refresh: async () => {
      refreshes += 1;
      return session('tok_2');
    },
  });
  client.setSession(session('tok_1'));

  const result = await client.get<{ ok: boolean }>('/api/v1/jobs');

  assert.equal(result.ok, true);
  assert.equal(refreshes, 1);
  assert.equal(calls.length, 2);
  assert.equal(calls[1]?.authorization, 'Bearer tok_2', 'the replay must use the new token');
});

test('does NOT replay a POST after refreshing', async () => {
  // A POST that reached the service and failed to respond would be applied
  // twice. Signing the user in again is annoying; a duplicate charge is worse.
  const calls = scriptFetch([() => problem(401, 'token_expired')]);

  const client = new ApiClient({ refresh: async () => session('tok_2') });
  client.setSession(session('tok_1'));

  await assert.rejects(() => client.post('/api/v1/jobs', { title: 'x' }), ProblemError);
  assert.equal(calls.length, 1, 'the POST must not be sent a second time');
});

test('three concurrent 401s trigger exactly one refresh', async () => {
  // Refresh tokens rotate on use. A second concurrent refresh presents a spent
  // token, which identity treats as theft and answers by revoking every session
  // the account has — so a single page load would sign the user out everywhere.
  scriptFetch([
    () => problem(401, 'token_expired'),
    () => problem(401, 'token_expired'),
    () => problem(401, 'token_expired'),
    () => json(200, { ok: true }),
  ]);

  let refreshes = 0;
  const client = new ApiClient({
    refresh: async () => {
      refreshes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return session('tok_2');
    },
  });
  client.setSession(session('tok_1'));

  await Promise.all([
    client.get('/api/v1/a'),
    client.get('/api/v1/b'),
    client.get('/api/v1/c'),
  ]);

  assert.equal(refreshes, 1);
});

test('signs out when the refresh fails', async () => {
  scriptFetch([() => problem(401, 'token_expired')]);

  let signedOut = false;
  const client = new ApiClient({
    refresh: async () => null,
    onSignedOut: () => {
      signedOut = true;
    },
  });
  client.setSession(session('tok_1'));

  await assert.rejects(() => client.get('/api/v1/jobs'), ProblemError);
  assert.equal(signedOut, true);
  assert.equal(client.getSession(), null);
});

test('does not refresh when no refresh strategy was given', async () => {
  const calls = scriptFetch([() => problem(401, 'unauthorized')]);
  const client = new ApiClient();

  await assert.rejects(() => client.get('/api/v1/jobs'), ProblemError);
  assert.equal(calls.length, 1);
});

test('surfaces a 422 with its field errors intact', async () => {
  scriptFetch([
    () =>
      json(422, {
        type: 'about:blank',
        title: 'Validation Failed',
        status: 422,
        detail: 'One or more fields are invalid.',
        code: 'validation_failed',
        errors: { slug: ['That link is already taken.'] },
      }),
  ]);

  await assert.rejects(
    () => new ApiClient().post('/api/v1/jobs', {}),
    (error: ProblemError) => {
      assert.equal(error.isValidation, true);
      assert.equal(error.fieldError('slug'), 'That link is already taken.');
      return true;
    },
  );
});

test('a 402 is recognisable so a portal can offer the billing page', async () => {
  scriptFetch([() => problem(402, 'subscription_required')]);

  await assert.rejects(
    () => new ApiClient().get('/api/v1/jobs'),
    (error: ProblemError) => error.isPaymentRequired,
  );
});

test('a non-JSON error still becomes a Problem', async () => {
  // A proxy 502 is an HTML page, and the portal must show something truthful
  // rather than crash on a JSON parse.
  scriptFetch([() => new Response('<html>Bad Gateway</html>', { status: 502 })]);

  await assert.rejects(
    () => new ApiClient().get('/api/v1/jobs'),
    (error: ProblemError) => {
      assert.equal(error.status, 502);
      assert.match(error.detail, /something went wrong/i);
      return true;
    },
  );
});

test('a network failure becomes a Problem rather than a raw TypeError', async () => {
  globalThis.fetch = (async () => {
    throw new TypeError('Failed to fetch');
  }) as typeof fetch;

  await assert.rejects(
    () => new ApiClient().get('/api/v1/jobs'),
    (error: ProblemError) => {
      assert.equal(error.status, 0);
      assert.equal(error.code, 'network_error');
      return true;
    },
  );
});

test('a 204 resolves without trying to parse a body', async () => {
  scriptFetch([() => new Response(null, { status: 204 })]);

  assert.equal(await new ApiClient().delete('/api/v1/jobs/job_1'), undefined);
});
