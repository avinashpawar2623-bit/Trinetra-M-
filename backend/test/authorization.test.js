import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

function futureExp() {
  return Math.floor(Date.now() / 1000) + 600;
}

async function withServer(run) {
  const calls = [];
  const revoked = new Set();
  const users = {
    'admin-token': { uid: 'admin-1', role: 'admin', exp: futureExp() },
    'viewer-token': { uid: 'viewer-1', role: 'viewer', exp: futureExp() },
    'expired-token': { uid: 'admin-1', role: 'admin', exp: Math.floor(Date.now() / 1000) - 10 },
  };
  const app = createApp({
    verify: async (token) => {
      const user = users[token];
      if (!user || revoked.has(user.uid)) {
        const err = new Error('Session expired');
        err.status = 401;
        throw err;
      }
      return user;
    },
    forward: async (pathname, body) => {
      calls.push({ pathname, body });
      return { ok: true, status: 200, rttMs: 15 };
    },
    revoke: async (uid) => {
      revoked.add(uid);
    },
    timeoutMs: 300,
  });
  const server = app.listen(0);
  const { port } = server.address();
  try {
    await run({ port, calls, revoked });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function post(port, path, token, body) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

const drive = { speed: -40, steer: 0, estop: false };

test('admin drive command is forwarded without a client-supplied role', async () => {
  await withServer(async ({ port, calls }) => {
    const response = await post(port, '/api/control', 'admin-token', { ...drive, role: 'viewer' });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.upstreamRttMs, 15);
    assert.deepEqual(calls, [{ pathname: '/control', body: drive }]);
  });
});

test('viewer motor commands are rejected and not forwarded', async () => {
  await withServer(async ({ port, calls }) => {
    const driveResponse = await post(port, '/api/control', 'viewer-token', { ...drive, role: 'admin' });
    const armResponse = await post(port, '/api/arm_control', 'viewer-token', {
      base: 1, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: 5, reset: false, role: 'admin',
    });
    const socketResponse = await fetch(`http://127.0.0.1:${port}/api/control/stream`, {
      headers: { authorization: 'Bearer viewer-token' },
    });
    assert.equal(driveResponse.status, 403);
    assert.equal(armResponse.status, 403);
    assert.equal(socketResponse.status, 403);
    assert.equal(calls.length, 0);
  });
});

test('unauthenticated and expired sessions cannot control the rover', async () => {
  await withServer(async ({ port, calls }) => {
    const missing = await post(port, '/api/control', null, drive);
    const expired = await post(port, '/api/control', 'expired-token', drive);
    assert.equal(missing.status, 401);
    assert.equal(expired.status, 401);
    assert.equal(calls.length, 0);
  });
});

test('logout revokes later privileged commands', async () => {
  await withServer(async ({ port, calls }) => {
    const logout = await post(port, '/api/session/logout', 'admin-token', {});
    assert.equal(logout.status, 204);
    const after = await post(port, '/api/control', 'admin-token', drive);
    assert.equal(after.status, 401);
    assert.equal(calls.length, 0);
  });
});

test('invalid drive payloads are rejected before the rover is contacted', async () => {
  await withServer(async ({ port, calls }) => {
    const response = await post(port, '/api/control', 'admin-token', { speed: 500, steer: 0, estop: false });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  });
});

test('viewer cannot read the privileged diagnostics log', async () => {
  await withServer(async ({ port }) => {
    const response = await fetch(`http://127.0.0.1:${port}/api/diagnostics`, {
      headers: { authorization: 'Bearer viewer-token' },
    });
    assert.equal(response.status, 403);
  });
});

test('camera proxy rejects anonymous viewers when auth is required', async () => {
  const previous = process.env.CAMERA_PROXY_REQUIRE_AUTH;
  process.env.CAMERA_PROXY_REQUIRE_AUTH = 'true';
  try {
    await withServer(async ({ port }) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/camera/stream`);
      assert.equal(response.status, 401);
    });
  } finally {
    if (previous === undefined) delete process.env.CAMERA_PROXY_REQUIRE_AUTH;
    else process.env.CAMERA_PROXY_REQUIRE_AUTH = previous;
  }
});
