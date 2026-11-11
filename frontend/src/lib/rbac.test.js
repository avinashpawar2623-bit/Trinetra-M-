import test from 'node:test';
import assert from 'node:assert/strict';
import { canControlRover, canViewMonitoring, roleFromClaims } from './rbac.js';

test('admin claim can control the rover', () => {
  assert.equal(roleFromClaims({ role: 'admin' }), 'admin');
  assert.equal(roleFromClaims({ admin: true }), 'admin');
  assert.equal(canControlRover('admin'), true);
});

test('viewer and missing claims cannot control the rover', () => {
  assert.equal(roleFromClaims({ role: 'viewer' }), 'viewer');
  assert.equal(roleFromClaims({}), 'viewer');
  assert.equal(roleFromClaims(null), 'viewer');
  assert.equal(canControlRover('viewer'), false);
  assert.equal(canControlRover('device'), false);
  assert.equal(canViewMonitoring('viewer'), true);
});

test('a role field outside the claims object is not accepted', () => {
  assert.equal(roleFromClaims({ role: 'viewer', requestRole: 'admin' }), 'viewer');
});
