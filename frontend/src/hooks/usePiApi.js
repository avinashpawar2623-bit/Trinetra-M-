/**
 * usePiApi — Single source of truth for the Raspberry Pi FastAPI backend.
 *
 * WebSocket /ws pushes { mq2, mq6, flame, dist1_cm, dist2_cm, temp_c,
 * humidity, esp_connected, fps, detections? } every 500 ms.
 *
 * The hook exposes:
 *   • sensors  { data, loading, error }
 *   • status   { data, loading, error }
 *   • detections { data, loading, error }
 *   • sendDriveCommand(speed, steer, estop)  → POST /control (fire-and-forget)
 *
 * ROOT CAUSE FIX:
 * The previous code used module-level _isMounted / _initialTimer / _cleanupTimer
 * variables. With React StrictMode (mount → unmount → remount), the 1 s cleanup
 * timer fired and set _isMounted = false AFTER the remount had already called
 * startConnection(). The WebSocket was then closed mid-CONNECTING and the
 * onclose handler could not schedule a reconnect because _isMounted was false.
 * Error: "WebSocket is closed before the connection is established."
 *
 * FIX: Move the connection lifecycle entirely inside useEffect with local
 * variables (ws, reconnectTimer, isMounted). The cleanup function nulls all
 * WS handlers before closing so no ghost reconnect fires after unmount.
 * StrictMode's fake unmount cancels the 300 ms initial timer before it fires,
 * so the real mount gets a clean slate and connects successfully.
 *
 * Shared state (sensors/status/detections) is still a module-level singleton
 * so all consumers in the same React tree read the same values.
 */
import { useEffect, useRef, useState } from 'react';
import { PI_BASE_URL, PI_WS_URL, PI_WS_RECONNECT_MS } from '../config/constants';
import { normalizePiSensors, normalizePiDetections, normalizePiStatus } from '../lib/normalize';

// ── Guard: host configuration ─────────────────────────────────────────────────
const _piHostConfigured = Boolean(import.meta.env.VITE_PI_HOST || 'basketball-dom-acer-shop.trycloudflare.com');

// ── Singleton shared state ────────────────────────────────────────────────────
// Multiple hook instances share one copy of the latest data.
// Only the connection itself lives inside useEffect.

function getInitialState() {
  if (!_piHostConfigured) {
    return {
      sensors:    { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
      status:     { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
      detections: { data: null, loading: false, error: 'VITE_PI_HOST not set in .env' },
    };
  }
  return {
    sensors:    { data: null, loading: true, error: null },
    status:     { data: null, loading: true, error: null },
    detections: { data: null, loading: true, error: null },
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
 * Returns { sensors, status, detections, sendDriveCommand }.
 *
 * Connection lifecycle is managed inside useEffect with local variables so
 * React StrictMode double-invoke is handled correctly:
 *   Mount  → useEffect runs → 300 ms timer → connect() → WS opened
 *   Unmount (StrictMode) → cleanup runs → isMounted=false, timer cleared, ws.close()
 *   Remount → useEffect runs again → fresh 300 ms timer → connect() → WS reopened
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
    let ws = null;
    let reconnectTimer = null;
    let isMounted = true;
    let attempt = 0;

    function connect() {
      if (!isMounted) return;

      try {
        ws = new WebSocket(PI_WS_URL);
      } catch (err) {
        console.error('[Pi] WebSocket constructor error', err);
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempt = 0;
        console.log('[Pi] WebSocket connected');
      };

      ws.onmessage = (e) => {
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
          });
        } catch (err) {
          console.error('[Pi] Parse error', err);
        }
      };

      ws.onerror = () => {
        // onerror always fires before onclose; let onclose own the reconnect.
        const msg = `Cannot reach Pi at ${PI_WS_URL}`;
        patchState({
          sensors:    { data: null, loading: false, error: msg },
          status:     { data: null, loading: false, error: msg },
          detections: { data: null, loading: false, error: msg },
        });
      };

      ws.onclose = () => {
        attempt += 1;
        console.log(
          `[Pi] WebSocket closed — reconnecting in ${PI_WS_RECONNECT_MS / 1000}s (attempt ${attempt})`
        );
        scheduleReconnect();
      };
    }

    function scheduleReconnect() {
      if (!isMounted) return;
      reconnectTimer = setTimeout(connect, PI_WS_RECONNECT_MS);
    }

    // 300 ms initial delay before first connect attempt.
    // Short enough that StrictMode's unmount cancels it before it fires,
    // so the real mount starts with a clean slate.
    reconnectTimer = setTimeout(connect, 300);

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      isMounted = false;
      clearTimeout(reconnectTimer);
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
    sendDriveCommand,
    sendArmCommand,
  };
}
