/**
 * Motion commands (drive, arm) go DIRECTLY to the Pi over Tailscale —
 * no Express proxy, no Firebase token, no cold-start latency.
 *
 * WHY DIRECT:
 *   The original path was: Browser → Vercel /api/control → Pi
 *   Vercel serverless has 200–500ms cold-start + 350ms gate timeout.
 *   At 200ms repeat interval, most commands timed out before reaching the Pi.
 *
 *   The Pi is behind Tailscale ACLs — only authorised nodes can reach it.
 *   Drive/arm endpoints on the Pi do NOT require a Firebase token.
 *   Sending directly cuts RTT from ~500ms to ~50–100ms.
 *
 * SETMODE still goes through the backend proxy (needs admin auth check).
 *
 * commandGate is kept for drive commands so the interval loop never builds
 * a queue — it coalesces while one is in-flight, same as before.
 */
import { PI_BASE_URL, API_BASE_URL, resolveApiUrl } from '../config/constants';
import { auth } from './firebase';
import { canControlRover } from './rbac';
import { createCommandGate } from './commandGate';

let role = 'viewer';
const listeners = new Set();

// ── Drive gate — direct to Pi, no auth header needed ─────────────────────────
const driveGate = createCommandGate({
  timeoutMs: 800,                       // Tailscale RTT often exceeds 300ms; aborting early drops the move
  onUpdate: () => publish(),
  send: async (job, { signal }) => {
    const res = await fetch(`${PI_BASE_URL}${job.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job.body),
      signal,
    });
    return { ok: res.ok, status: res.status };
  },
});

// ── Arm gate — direct to Pi ───────────────────────────────────────────────────
const armGate = createCommandGate({
  timeoutMs: 500,
  onUpdate: () => publish(),
  send: async (job, { signal }) => {
    const res = await fetch(`${PI_BASE_URL}${job.path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(job.body),
      signal,
    });
    return { ok: res.ok, status: res.status };
  },
});

// ── Privileged gate — through Express backend (needs Firebase admin role) ─────
const privilegedGate = createCommandGate({
  timeoutMs: 350,
  onUpdate: () => publish(),
  send: async (job, { signal }) => {
    const user = auth?.currentUser;
    if (!user) {
      const err = new Error('Not signed in');
      err.status = 401;
      throw err;
    }
    const token = await user.getIdToken();
    const response = await fetch(job.path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(job.body),
      signal,
    });
    let payload = null;
    try { payload = await response.json(); } catch { payload = null; }
    return {
      ok: response.ok,
      status: response.status,
      error: payload?.error || null,
      upstreamRttMs: payload?.upstreamRttMs,
    };
  },
});

function publish() {
  const snapshot = getControlStats();
  listeners.forEach((fn) => fn(snapshot));
}

export function setControlRole(next) {
  role = next === 'admin' ? 'admin' : (next === 'device' ? 'device' : 'viewer');
}

export function getControlStats() {
  // Merge drive gate stats for the UI
  return { ...driveGate.stats, role };
}

export function subscribeControlStats(fn) {
  listeners.add(fn);
  fn(getControlStats());
  return () => listeners.delete(fn);
}

export function setCommandTimeoutMs(ms) {
  driveGate.setTimeoutMs(ms);
  publish();
}

export function sendDriveCommand({ speed = 0, steer = 0, estop = false } = {}) {
  if (!canControlRover(role)) {
    driveGate.stats.lastError = 'forbidden';
    publish();
    return;
  }
  const halt = estop === true || (Number(speed) === 0 && Number(steer) === 0);
  // E-stop aborts a move still on the wire. A normal release waits for that
  // move to land, then sends the stop — otherwise a tap never reaches the Pi.
  driveGate.submit({ path: '/control', body: { speed, steer, estop } }, { priority: halt, abort: estop === true });
  publish();
}

export function sendArmCommand(command) {
  if (!canControlRover(role)) return;
  const stop = command?.base === 0 && command?.arm === 0 && command?.wrist === 0
    && command?.clawJ === 0 && command?.claw === 0 && command?.rot === 0;
  // Priority puts the stop next, but do not abort the move already in flight.
  // Aborting it is why a shoulder press never reached the ESP32.
  armGate.submit(
    { path: '/arm_control', body: command },
    { priority: stop || command?.reset === true, abort: false },
  );
  publish();
}

export function sendModeCommand(mode) {
  // SETMODE goes through the privileged backend (admin role required)
  const endpoint = resolveApiUrl('api/setmode', API_BASE_URL);
  privilegedGate.submit({ path: endpoint, body: { mode } }, { priority: true });
  publish();
}

export async function revokeServerSession() {
  const user = auth?.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  const endpoint = resolveApiUrl('api/session/logout', API_BASE_URL);
  await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
}
