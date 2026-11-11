/**
 * Privileged motion commands go to this dashboard's backend, which checks
 * the Firebase ID token. The browser does not talk to the Pi control port
 * and does not send a role in the body.
 */
import { API_BASE_URL, resolveApiUrl } from '../config/constants';
import { auth } from './firebase';
import { canControlRover } from './rbac';
import { createCommandGate } from './commandGate';

let role = 'viewer';
const listeners = new Set();

const gate = createCommandGate({
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
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
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
  return { ...gate.stats, role };
}

export function subscribeControlStats(fn) {
  listeners.add(fn);
  fn(getControlStats());
  return () => listeners.delete(fn);
}

export function setCommandTimeoutMs(ms) {
  gate.setTimeoutMs(ms);
  publish();
}

function submit(path, body, { priority = false } = {}) {
  if (!canControlRover(role)) {
    gate.stats.lastError = 'forbidden';
    gate.stats.lastStatus = 403;
    publish();
    return;
  }
  gate.submit({ path, body }, { priority });
  publish();
}

export function sendDriveCommand({ speed = 0, steer = 0, estop = false, priority = false } = {}) {
  const endpoint = resolveApiUrl('api/control', API_BASE_URL);
  submit(endpoint, { speed, steer, estop }, { priority: priority || estop === true });
}

export function sendArmCommand(command) {
  const stop = command?.base === 0 && command?.arm === 0 && command?.wrist === 0
    && command?.clawJ === 0 && command?.claw === 0 && command?.rot === 0;
  const endpoint = resolveApiUrl('api/arm_control', API_BASE_URL);
  submit(endpoint, command, { priority: stop || command?.reset === true });
}

export function sendModeCommand(mode) {
  const endpoint = resolveApiUrl('api/setmode', API_BASE_URL);
  submit(endpoint, { mode }, { priority: true });
}

export async function revokeServerSession() {
  const user = auth?.currentUser;
  if (!user) return;
  const token = await user.getIdToken();
  const endpoint = resolveApiUrl('api/session/logout', API_BASE_URL);
  await fetch(endpoint, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
}
