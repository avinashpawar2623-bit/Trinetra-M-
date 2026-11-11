/**
 * usePiApi — Single source of truth for the Raspberry Pi FastAPI backend.
 *
 * WebSocket /ws pushes { mq2, mq6, flame, dist1_cm, dist2_cm, temp_c,
 * humidity, esp_connected, fps, detections? } every 500 ms.
 *
 * The hook exposes:
 *   • sensors     { data, loading, error }
 *   • status      { data, loading, error }
 *   • detections  { data, loading, error }
 *   • wsStatus    'connecting' | 'connected' | 'disconnected'
 *   • sendDriveCommand(speed, steer, estop)  → POST /control (fire-and-forget)
 *
 * BUG FIXES applied in this version:
 *
 * 1. EXPONENTIAL BACKOFF — reconnect delay starts at PI_WS_RECONNECT_MS (1 s)
 *    and doubles each attempt up to PI_WS_MAX_RECONNECT_MS (10 s).  The old
 *    code always waited a fixed 5 s but a fast TCP-refuse (Tailscale tunnel not
 *    up yet) made the loop appear as a "storm" of connection attempts.
 *
 * 2. STALENESS DETECTION — sensor data is marked stale/lost if no WS message
 *    has been received for PI_WS_STALE_MS (6 s). This replaces any polling of
 *    /api/health (which does not exist on Vercel and caused 404 floods).
 *    The stale timer is reset on every incoming message and cleared on unmount.
 *
 * 3. ONE SOCKET AT A TIME — the cleanup function nulls all WS handlers before
 *    calling ws.close(), so a racing onclose cannot schedule a second reconnect.
 *    The initial 300 ms delay is short enough that StrictMode's fake-unmount
 *    cancels it before it fires, giving the real mount a clean slate.
 *
 * 4. WS STATUS LABEL — exposes 'connecting' | 'connected' | 'disconnected' so
 *    the UI can show a meaningful indicator without polling any HTTP endpoint.
 *
 * Shared state (sensors/status/detections/wsStatus) is still a module-level
 * singleton so all consumers in the same React tree read the same values.
 */
import { useEffect, useRef, useState } from 'react';
import {
  PI_BASE_URL,
  PI_WS_URL,
  PI_WS_RECONNECT_MS,
  PI_WS_MAX_RECONNECT_MS,
  PI_WS_STALE_MS,
} from '../config/constants';
import { normalizePiSensors, normalizePiDetections, normalizePiStatus } from '../lib/normalize';

// ── Guard: host configuration ─────────────────────────────────────────────────
const _piHostConfigured = Boolean(import.meta.env.VITE_PI_HOST || 'vsit.tail13799b.ts.net');

// ── Singleton shared state ────────────────────────────────────────────────────
// Multiple hook instances share one copy of the latest data.
// Only the connection itself lives inside useEffect.

/**
 * WebSocket lifecycle status — 'connecting' | 'connected' | 'disconnected'.
 * Exposed via the hook so components can render a meaningful indicator without
 * polling any HTTP endpoint.
 */
const WS_CONNECTING   = 'connecting';
const WS_CONNECTED    = 'connected';
const WS_DISCONNECTED = 'disconnected';

function getInitialState() {
  if (!_piHostConfigured) {
    return {
      sensors:    { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
      status:     { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
      detections: { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
      wsStatus:   WS_DISCONNECTED,
    };
  }
  return {
    sensors:    { data: null, loading: true, error: null },
    status:     { data: null, loading: true, error: null },
    detections: { data: null, loading: true, error: null },
    wsStatus:   WS_CONNECTING,
  };
}

let _sharedState = getInitialState();
const _stateListeners = new Set();

function notifyState() {
  _stateListeners.forEach((fn) => fn(_sharedState));
}

function patchState(patch) {
  _sharedState = { ..._sharedState, ...patch };
  notifyState();
}

// ── Drive command ─────────────────────────────────────────────────────────────

/**
 * POST /control with { speed, steer, estop }.
 * Fire-and-forget — errors are suppressed (non-blocking, not critical).
 * The ESP32 has a 600 ms watchdog; callers must send every ~80–100 ms while held.
 */
export async function sendDriveCommand({ speed = 0, steer = 0, estop = false } = {}) {
  if (!_piHostConfigured) return;
  try {
    await fetch(`${PI_BASE_URL}/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed, steer, estop }),
    });
  } catch {
    // Silently ignore — DriveControl's disabled state should prevent most failures.
  }
}

// ── Arm command ──────────────────────────────────────────────────────────────

/**
 * POST /arm_control with { base, arm, wrist, clawJ, claw, rot, speed, reset }.
 * Fire-and-forget — same pattern as sendDriveCommand.
 * The caller must send every ~80 ms while a button is held.
 */
export async function sendArmCommand({
  base = 0, arm = 0, wrist = 0, clawJ = 0,
  claw = 0, rot = 0, speed = 5, reset = false,
} = {}) {
  if (!_piHostConfigured) return;
  try {
    await fetch(`${PI_BASE_URL}/arm_control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base, arm, wrist, clawJ, claw, rot, speed, reset }),
    });
  } catch {
    // Silently ignore.
  }
}

// ── Mode command ──────────────────────────────────────────────────────────────

/**
 * POST /setmode with { mode: "ONLINE" | "REMOTE" }.
 * Tells the rover to switch operating mode via UART.
 * Fire-and-forget — errors suppressed.
 */
export async function sendModeCommand(mode) {
  if (!_piHostConfigured) return;
  try {
    await fetch(`${PI_BASE_URL}/setmode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
  } catch {
    // Silently ignore.
  }
}

// ── React hook ────────────────────────────────────────────────────────────────

/**
 * Subscribes to the shared Pi WebSocket state.
 * Returns { sensors, status, detections, wsStatus, sendDriveCommand }.
 *
 * Connection lifecycle is managed inside useEffect with local variables so
 * React StrictMode double-invoke is handled correctly:
 *   Mount  → useEffect runs → 300 ms timer → connect() → WS opened
 *   Unmount (StrictMode) → cleanup runs → isMounted=false, timer cleared, ws.close()
 *   Remount → useEffect runs again → fresh 300 ms timer → connect() → WS reopened
 *
 * Exponential backoff: delay = min(PI_WS_RECONNECT_MS * 2^attempt, PI_WS_MAX_RECONNECT_MS)
 * So: 1s → 2s → 4s → 8s → 10s (capped).
 *
 * Staleness: a staleTimer fires PI_WS_STALE_MS (6 s) after the last message.
 * On expiry the sensor/status state is marked with an error so the UI shows
 * "lost" without polling /api/health (which does not exist on Vercel).
 */
export function usePiApi() {
  const [state, setState] = useState(() => _sharedState);
  const mountCountRef = useRef(0);

  useEffect(() => {
    _stateListeners.add(setState);
    mountCountRef.current += 1;

    if (!_piHostConfigured) {
      _stateListeners.delete(setState);
      return;
    }

    // ── Local connection variables — immune to StrictMode races ─────────────
    let ws           = null;
    let reconnectTimer = null;
    let staleTimer   = null;   // fires when no message for PI_WS_STALE_MS
    let isMounted    = true;
    let attempt      = 0;

    // ── Staleness helpers ────────────────────────────────────────────────────

    function armStaleTimer() {
      clearTimeout(staleTimer);
      staleTimer = setTimeout(() => {
        if (!isMounted) return;
        const msg = `No data from Pi for ${PI_WS_STALE_MS / 1000}s — connection may be lost`;
        console.warn('[Pi]', msg);
        patchState({
          sensors:    { data: _sharedState.sensors.data,    loading: false, error: msg },
          status:     { data: _sharedState.status.data,     loading: false, error: msg },
          detections: { data: _sharedState.detections.data, loading: false, error: msg },
          wsStatus:   WS_DISCONNECTED,
        });
      }, PI_WS_STALE_MS);
    }

    // ── Backoff helper ───────────────────────────────────────────────────────

    function backoffMs() {
      // 1s → 2s → 4s → 8s → 10s (capped at PI_WS_MAX_RECONNECT_MS)
      return Math.min(
        PI_WS_RECONNECT_MS * (2 ** attempt),
        PI_WS_MAX_RECONNECT_MS,
      );
    }

    // ── Core connect ─────────────────────────────────────────────────────────

    function connect() {
      if (!isMounted) return;

      patchState({ wsStatus: WS_CONNECTING });

      try {
        ws = new WebSocket(PI_WS_URL);
      } catch (err) {
        console.error('[Pi] WebSocket constructor error', err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        console.log('[Pi] WebSocket connected →', PI_WS_URL);
        patchState({ wsStatus: WS_CONNECTED });
        armStaleTimer(); // start the inactivity watchdog
      };

      ws.onmessage = (e) => {
        armStaleTimer(); // reset watchdog on every incoming frame
        try {
          const data = JSON.parse(e.data);
          patchState({
            sensors:    { data: normalizePiSensors(data), loading: false, error: null },
            status:     { data: normalizePiStatus(data),  loading: false, error: null },
            detections: {
              data: normalizePiDetections(data.detections ?? null),
              loading: false,
              error: null,
            },
            wsStatus: WS_CONNECTED,
          });
        } catch (err) {
          console.error('[Pi] JSON parse error', err);
        }
      };

      ws.onerror = () => {
        // onerror always fires before onclose — let onclose own the reconnect
        // so we do not schedule two reconnects for one failure.
        // Update the error state here so the UI reflects the problem immediately.
        const msg = `Cannot reach Pi at ${PI_WS_URL}`;
        patchState({
          sensors:    { data: null, loading: false, error: msg },
          status:     { data: null, loading: false, error: msg },
          detections: { data: null, loading: false, error: msg },
          wsStatus:   WS_DISCONNECTED,
        });
      };

      ws.onclose = () => {
        clearTimeout(staleTimer); // stop watchdog; we know it's gone
        const delay = backoffMs();
        attempt += 1;
        console.log(
          `[Pi] WebSocket closed — reconnecting in ${(delay / 1000).toFixed(1)}s` +
          ` (attempt ${attempt}, backoff capped at ${PI_WS_MAX_RECONNECT_MS / 1000}s)`,
        );
        patchState({ wsStatus: WS_DISCONNECTED });
        scheduleReconnect(delay);
      };
    }

    function scheduleReconnect(delay = PI_WS_RECONNECT_MS) {
      if (!isMounted) return;
      reconnectTimer = setTimeout(connect, delay);
    }

    // 300 ms initial delay before first connect attempt.
    // Short enough that StrictMode's unmount cancels it before it fires,
    // so the real mount starts with a clean slate.
    reconnectTimer = setTimeout(connect, 300);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
      clearTimeout(staleTimer);
      _stateListeners.delete(setState);

      if (ws) {
        // Null all handlers so onclose cannot schedule a reconnect after cleanup.
        ws.onclose   = null;
        ws.onerror   = null;
        ws.onmessage = null;
        ws.onopen    = null;
        if (
          ws.readyState === WebSocket.OPEN ||
          ws.readyState === WebSocket.CONNECTING
        ) {
          ws.close();
        }
        ws = null;
      }

      // Reset shared state when the last consumer unmounts, so the next mount
      // starts with a loading indicator rather than stale data.
      if (_stateListeners.size === 0) {
        _sharedState = getInitialState();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    sensors:          state.sensors,
    status:           state.status,
    detections:       state.detections,
    wsStatus:         state.wsStatus,
    sendDriveCommand,
    sendArmCommand,
  };
}
