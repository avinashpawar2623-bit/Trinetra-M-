/**
 * Dashboard ↔ rover mode lock.
 *
 * ONLINE is sent when a drive or arm control is actually held, then refreshed
 * every 2s while that activity continues. After 5s with no hold, one REMOTE
 * is sent so the physical handset can take over again. Opening the page does
 * not lock the rover.
 */
import { PI_BASE_URL } from '../config/constants';

const IDLE_MS = 5000;
const REFRESH_MS = 2000;

let lastActivity = 0;
let released = false;
let idleHandoffSent = false;
let lastOnlineAt = 0;
let users = 0;
let timer = null;
let lockPromise = Promise.resolve();
const listeners = new Set();

function emit(online) {
  listeners.forEach((fn) => fn(online));
}

export function subscribeDashboardMode(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function postRoverMode(mode) {
  return fetch(`${PI_BASE_URL}/setmode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
}

function sendOnline(force) {
  const now = Date.now();
  if (!force && now - lastOnlineAt < 1800) return lockPromise;
  // Stamp success only after the Pi accepts ONLINE. A failed lock used to
  // block retries for 1.8s, so arm commands kept arriving while the rover
  // was still on the handset and the second shoulder never moved.
  lockPromise = postRoverMode('ONLINE')
    .then((res) => {
      const ok = Boolean(res?.ok);
      if (ok) lastOnlineAt = Date.now();
      emit(ok);
      return res;
    })
    .catch(() => {
      emit(false);
    });
  return lockPromise;
}

/** Explicit lock from the operate panel, before a stick is held. */
export function engageDashboard() {
  released = false;
  idleHandoffSent = false;
  lastActivity = Date.now();
  return sendOnline(true);
}

/** Call on every moment the operator is actively driving or moving the arm. */
export function noteControlActivity() {
  const idleFor = lastActivity ? Date.now() - lastActivity : Infinity;
  const needLock = released || lastActivity === 0 || idleFor > IDLE_MS;
  lastActivity = Date.now();
  released = false;
  idleHandoffSent = false;
  if (needLock) return sendOnline(true);
  return lockPromise;
}

/** Give the physical remote control immediately. */
export function releaseToRemote() {
  released = true;
  lastActivity = 0;
  idleHandoffSent = true;
  emit(false);
  return postRoverMode('REMOTE');
}

function tick() {
  if (released || !lastActivity) return;
  const idle = Date.now() - lastActivity;
  if (idle < IDLE_MS) {
    sendOnline(false);
    return;
  }
  if (!idleHandoffSent) {
    idleHandoffSent = true;
    postRoverMode('REMOTE')
      .then(() => emit(false))
      .catch(() => emit(false));
  }
}

export function startModeKeepalive() {
  users += 1;
  if (!timer) timer = setInterval(tick, REFRESH_MS);
  return () => {
    users -= 1;
    if (users <= 0) {
      users = 0;
      clearInterval(timer);
      timer = null;
    }
  };
}
