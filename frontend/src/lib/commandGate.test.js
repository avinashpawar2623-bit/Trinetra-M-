import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandGate } from './commandGate.js';

test('keeps only the newest command while one request is in flight', async () => {
  const sent = [];
  let release;
  const gate = createCommandGate({
    timeoutMs: 500,
    send: (body) => new Promise((resolve) => {
      sent.push(body);
      release = () => resolve({ ok: true, status: 200, upstreamRttMs: 5 });
    }),
  });

  gate.submit({ speed: 1 });
  gate.submit({ speed: 2 });
  gate.submit({ speed: 0 });
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(sent, [{ speed: 1 }]);
  release();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(sent, [{ speed: 1 }, { speed: 0 }]);
  assert.equal(gate.stats.coalesced > 0, true);
  assert.equal(gate.stats.lastRttMs !== null, true);
});
