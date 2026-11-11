import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveSuppression, observedRuntimeMs, reducePumpTimeline } from './pump.js';

test('clear fire with no pump telemetry stays standby and unknown', () => {
  const view = deriveSuppression({ sensors: { flame: false }, link: 'live' });
  assert.equal(view.fire, 'CLEAR');
  assert.equal(view.pumpState, 'UNKNOWN');
  assert.equal(view.system, 'STANDBY');
});

test('fire without a confirmed pump is not reported as active', () => {
  const view = deriveSuppression({ sensors: { flame: true }, link: 'live' });
  assert.equal(view.fire, 'DETECTED');
  assert.equal(view.pumpState, 'UNKNOWN');
  assert.equal(view.system, 'FAULT');
});

test('confirmed pump on during fire is active', () => {
  const view = deriveSuppression({ sensors: { flame: true, pump: true }, link: 'live' });
  assert.equal(view.pumpState, 'ON');
  assert.equal(view.system, 'ACTIVE');
});

test('a lost link does not keep claiming the pump is on', () => {
  const view = deriveSuppression({ sensors: { flame: true, pump: true }, link: 'disconnected' });
  assert.equal(view.pumpState, 'UNKNOWN');
  assert.equal(view.system, 'FAULT');
});

test('timeline records one activation edge and session runtime', () => {
  let state = reducePumpTimeline(null, { pump: false, link: 'live', now: 1000 });
  state = reducePumpTimeline(state, { pump: true, link: 'live', now: 2000 });
  state = reducePumpTimeline(state, { pump: true, link: 'live', now: 2500 });
  assert.equal(state.lastOnAt, 2000);
  assert.equal(observedRuntimeMs(state, 3500), 1500);
  state = reducePumpTimeline(state, { pump: false, link: 'live', now: 4000 });
  assert.equal(state.lastOffAt, 4000);
  assert.equal(observedRuntimeMs(state, 4500), null);
});
