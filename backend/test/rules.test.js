import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rules = JSON.parse(readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8'));
const rover = rules.rules.rover;

test('authenticated users can read sensor telemetry', () => {
  assert.equal(rover.sensors['.read'], 'auth != null');
  assert.equal(rover.status['.read'], 'auth != null');
  assert.equal(rover.camera['.read'], 'auth != null');
});

test('viewers cannot write telemetry or motor command paths', () => {
  assert.match(rover.sensors['.write'], /auth\.token\.role != 'viewer'/);
  assert.equal(rover.commands['.write'], "auth != null && auth.token.role == 'admin'");
  assert.equal(rover.commands['.read'], "auth != null && auth.token.role == 'admin'");
  assert.equal(rover['.write'], false);
});

test('firestore events accept pump records and reject other collections', () => {
  const source = readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  assert.match(source, /'gas', 'flame', 'detection', 'pump'/);
  assert.match(source, /allow read, write: if false/);
});
