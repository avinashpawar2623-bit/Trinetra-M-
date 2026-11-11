/**
 * One Pi WebSocket for the whole dashboard.
 *
 * Several components call this hook. The socket itself is ref-counted so
 * those callers share a single connection. A short teardown delay absorbs
 * React StrictMode's mount/unmount/remount cycle.
 *
 * A dropped socket keeps the last good sample and marks the link disconnected.
 * It does not delete the last reading.
 */
import { useEffect, useState } from 'react';
import { PI_WS_MAX_RECONNECT_MS, PI_WS_RECONNECT_MS, PI_WS_URL } from '../config/constants';
import { normalizePiDetections, normalizePiSensors, normalizePiStatus } from '../lib/normalize';
import { classifyLink } from '../lib/telemetry';

export { sendArmCommand, sendDriveCommand, sendModeCommand } from '../lib/controlClient';

const configured = Boolean(PI_WS_URL);

function blankState() {
  const error = configured ? null : 'Pi host is not configured';
  return {
    sensors: { data: null, loading: configured, error },
    status: { data: null, loading: configured, error },
    detections: { data: null, loading: configured, error },
    link: configured ? 'connecting' : 'disconnected',
    diagnostics: {
      lastMessageAt: null,
      intervalMs: null,
      reconnects: 0,
      invalidCount: 0,
      wsOpen: false,
    },
  };
}

let shared = blankState();
const listeners = new Set();
let subscribers = 0;
let ws = null;
let reconnectTimer = null;
let teardownTimer = null;
let clockTimer = null;
let attempt = 0;
let lastGoodAt = null;
let wsOpen = false;
let lastInvalid = false;

function currentLink(now = Date.now()) {
  return classifyLink({ wsOpen, lastGoodAt, now, lastMessageInvalid: lastInvalid });
}

function publish(force) {
  const link = currentLink();
  if (!force && link === shared.link) return;
  shared = { ...shared, link };
  listeners.forEach((fn) => fn(shared));
}

function failClosed(message) {
  wsOpen = false;
  shared = {
    ...shared,
    sensors: { ...shared.sensors, loading: false, error: shared.sensors.data ? null : message },
    status: {
      data: shared.status.data ? { ...shared.status.data, connected: false } : null,
      loading: false,
      error: shared.status.data ? null : message,
    },
    detections: { ...shared.detections, loading: false, error: shared.detections.data ? null : message },
    diagnostics: { ...shared.diagnostics, wsOpen: false },
  };
  publish(true);
}

function connect() {
  if (subscribers <= 0 || ws) return;
  if (!PI_WS_URL) {
    wsOpen = false;
    shared = { ...shared, diagnostics: { ...shared.diagnostics, wsOpen: false } };
    publish(true);
    return;
  }
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
  try {
    ws = new WebSocket(PI_WS_URL);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    wsOpen = true;
    attempt = 0;
    shared = { ...shared, diagnostics: { ...shared.diagnostics, wsOpen: true } };
    publish(true);
  };

  ws.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      lastInvalid = true;
      shared = {
        ...shared,
        diagnostics: { ...shared.diagnostics, invalidCount: shared.diagnostics.invalidCount + 1, wsOpen: true },
      };
      publish(true);
      return;
    }

    const sensors = normalizePiSensors(data);
    if (!sensors) {
      lastInvalid = true;
      shared = {
        ...shared,
        diagnostics: { ...shared.diagnostics, invalidCount: shared.diagnostics.invalidCount + 1, wsOpen: true },
      };
      publish(true);
      return;
    }

    const now = Date.now();
    const intervalMs = lastGoodAt ? now - lastGoodAt : shared.diagnostics.intervalMs;
    lastGoodAt = now;
    lastInvalid = false;
    sensors.updatedAt = now;
    shared = {
      sensors: { data: sensors, loading: false, error: null },
      status: { data: normalizePiStatus(data), loading: false, error: null },
      detections: {
        data: normalizePiDetections(data.detections ?? null),
        loading: false,
        error: null,
      },
      link: 'live',
      diagnostics: {
        lastMessageAt: now,
        intervalMs,
        reconnects: shared.diagnostics.reconnects,
        invalidCount: shared.diagnostics.invalidCount,
        wsOpen: true,
      },
    };
    publish(true);
  };

  ws.onerror = () => {
    // onclose owns reconnect. Keep the last sample.
  };

  ws.onclose = () => {
    ws = null;
    shared = {
      ...shared,
      diagnostics: { ...shared.diagnostics, reconnects: shared.diagnostics.reconnects + 1, wsOpen: false },
    };
    failClosed(`Cannot reach Pi at ${PI_WS_URL}`);
    scheduleReconnect();
  };
}

function scheduleReconnect() {
  if (subscribers <= 0 || !PI_WS_URL) return;
  const delay = Math.min(PI_WS_MAX_RECONNECT_MS, PI_WS_RECONNECT_MS * (2 ** Math.min(attempt, 6)));
  attempt += 1;
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    if (subscribers > 0) connect();
  }, delay);
}

function teardown() {
  clearTimeout(reconnectTimer);
  clearInterval(clockTimer);
  clockTimer = null;
  if (ws) {
    ws.onopen = null;
    ws.onmessage = null;
    ws.onerror = null;
    ws.onclose = null;
    if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
    ws = null;
  }
  wsOpen = false;
  lastGoodAt = null;
  lastInvalid = false;
  attempt = 0;
  shared = blankState();
  publish(true);
}

function acquire(setState) {
  listeners.add(setState);
  setState(shared);
  clearTimeout(teardownTimer);
  subscribers += 1;
  if (configured && !ws && !reconnectTimer) connect();
  if (configured && !clockTimer) clockTimer = setInterval(() => publish(false), 1000);
  return () => {
    listeners.delete(setState);
    subscribers -= 1;
    if (subscribers <= 0) {
      subscribers = 0;
      teardownTimer = setTimeout(teardown, 400);
    }
  };
}

export function usePiApi() {
  const [state, setState] = useState(shared);
  useEffect(() => acquire(setState), []);
  return state;
}
