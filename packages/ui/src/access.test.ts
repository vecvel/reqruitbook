import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AccessEvaluator, EMPTY_ACCESS, snapshotFromSession } from './access';

const company = (permissions: string[], extra: Record<string, unknown> = {}) =>
  new AccessEvaluator({
    accountId: 'acc_1',
    principalType: 'company',
    roles: ['recruiter'],
    permissions,
    companyId: 'co_1',
    ...extra,
  });

test('an anonymous actor can do nothing', () => {
  const access = new AccessEvaluator(EMPTY_ACCESS);

  assert.equal(access.isAuthenticated, false);
  assert.equal(access.can('jobs.read'), false);
  // Empty lists mean "no specific requirement", which for an anonymous actor
  // still has to be false — otherwise `<Can>` with no permission would render
  // for signed-out visitors.
  assert.equal(access.canAny([]), false);
  assert.equal(access.canAll([]), false);
});

test('a permission held is granted, one not held is not', () => {
  const access = company(['jobs.read', 'jobs.create']);

  assert.equal(access.can('jobs.read'), true);
  assert.equal(access.can('jobs.delete'), false);
});

test('canAny and canAll differ where it matters', () => {
  const access = company(['jobs.read']);

  assert.equal(access.canAny(['jobs.read', 'jobs.delete']), true);
  assert.equal(access.canAll(['jobs.read', 'jobs.delete']), false);
  assert.equal(access.check(['jobs.read', 'jobs.delete'], 'all'), false);
});

test('a super admin holds everything in scope', () => {
  const access = company([], { isSuperAdmin: true });

  assert.equal(access.can('jobs.delete'), true);
  assert.equal(access.canAccessFeature('offers'), true);
});

test('a disabled feature hides a permission the role does hold', () => {
  // The tenant switched the module off. The role still carries the key, and the
  // API would still honour it — this is about not offering a door that leads
  // somewhere the customer chose not to have.
  const access = company(['offers.read'], { enabledFeatures: ['jobs', 'applications'] });

  assert.equal(access.can('offers.read'), false);
  assert.equal(access.can('jobs.read'), false, 'jobs.read was never granted');
});

test('a super admin still reaches a disabled feature', () => {
  const access = company([], { enabledFeatures: ['jobs'], isSuperAdmin: true });

  assert.equal(access.can('offers.read'), true);
});

test('an empty enabledFeatures list means unrestricted, not nothing', () => {
  // The distinction that matters: the platform and candidate portals have no
  // per-tenant switches at all, so they send no list. Treating that as "nothing
  // enabled" would render an empty application for every candidate.
  const access = company(['candidate_profile.read'], { enabledFeatures: [] });

  assert.equal(access.can('candidate_profile.read'), true);
});

test('canAccessFeature is true for any permission under the feature', () => {
  const access = company(['applications.advance_stage']);

  assert.equal(access.canAccessFeature('applications'), true);
  assert.equal(access.canAccessFeature('offers'), false);
});

test('a malformed permission key is refused rather than assumed', () => {
  const access = company(['jobs.read']);

  assert.equal(access.can(''), false);
  assert.equal(access.can('.read'), false);
});

test('principal type is exposed for portal-level branching', () => {
  const access = company(['jobs.read']);

  assert.equal(access.is('company'), true);
  assert.equal(access.is('platform'), false);
});

test('snapshotFromSession carries the session through', () => {
  const snapshot = snapshotFromSession({
    accountId: 'acc_9',
    principalType: 'candidate',
    roles: ['candidate'],
    permissions: ['candidate_profile.read'],
  });

  assert.equal(snapshot.accountId, 'acc_9');
  assert.equal(snapshot.principalType, 'candidate');
  assert.equal(snapshot.isSuperAdmin, false);
});

test('snapshotFromSession recognises the roles that carry everything', () => {
  for (const role of ['super_admin', 'owner']) {
    const snapshot = snapshotFromSession({
      accountId: 'acc_1',
      principalType: 'company',
      roles: [role],
      permissions: [],
      companyId: 'co_1',
    });
    assert.equal(snapshot.isSuperAdmin, true, `${role} should carry the full scope`);
  }
});

test('a null session produces the empty snapshot', () => {
  assert.deepEqual(snapshotFromSession(null), EMPTY_ACCESS);
});
