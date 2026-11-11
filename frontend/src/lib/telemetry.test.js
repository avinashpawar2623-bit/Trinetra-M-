import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyLink, frameFreshness } from './telemetry.js';

test('classifies live, stale, and disconnected telemetry', () => {
  assert.equal(classifyLink({ wsOpen: true, lastGoodAt: 1000, now: 2000 }), 'live');
  assert.equal(classifyLink({ wsOpen: true, lastGoodAt: 1000, now: 5000 }), 'stale');
  assert.equal(classifyLink({ wsOpen: false, lastGoodAt: 1000, now: 1500 }), 'disconnected');
  assert.equal(classifyLink({ wsOpen: true, lastGoodAt: null, now: 1000, lastMessageInvalid: true }), 'invalid');
});

test('frame freshness uses receipt time', () => {
  assert.equal(frameFreshness(1000, 1500), 'live');
  assert.equal(frameFreshness(1000, 5000), 'frozen');
  assert.equal(frameFreshness(null, 1000), 'unknown');
});
