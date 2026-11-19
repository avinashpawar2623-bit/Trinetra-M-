/**
 * DriveControl — Directional drive pad for the rover.
 *
 * Layout: 3-column grid
 *   [ ← ]  [ ⬆️ ]  [ → ]
 *   [   ]  [ ⬇️ ]  [   ]
 *         [🛑 E-STOP]
 *
 * Safety:
 *   • One shared interval reads all pressed buttons every 100 ms.
 *   • pressedRef tracks simultaneous keys — no stale closure.
 *   • First command sent IMMEDIATELY on press (zero perceived latency).
 *   • Zero-speed stop sent immediately when all keys released.
 *   • E-STOP clears all state and sends estop: true.
 *   • Keyboard: WASD / Arrow keys (multi-key aware).
 *   • Arrow keys call preventDefault — no page scroll while driving.
 *   • Keyboard listeners bail out when focused element is input/textarea/select.
 *
 * Props:
 *   disabled    – boolean, true when Pi offline
 *   driveSpeed  – number (10–100), from RoverControlPanel
 */
import { useEffect, useRef, useState } from 'react';
import { sendDriveCommand } from '../../hooks/usePiApi';
import { useControlStats } from '../../hooks/useControlStats';

/** Fire-and-forget drive POST. */
function sendDrive(speed, steer) {
  sendDriveCommand({ speed, steer, estop: false });
}

/** True when the event came from a text input — skip rover hotkeys. */
function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export default function DriveControl({ disabled = false, driveSpeed = 70, link = 'disconnected' }) {
  const [estop, setEstop] = useState(false);
  // For UI highlight: which keys are currently held
  const [heldKeys, setHeldKeys] = useState({
    forward: false, backward: false, left: false, right: false,
  });

  // Track pressed state in a ref so the interval never has stale closures
  const pressedRef    = useRef({ forward: false, backward: false, left: false, right: false });
  const estopRef      = useRef(false);
  const driveSpeedRef = useRef(driveSpeed);
  const disabledRef   = useRef(disabled);

  // Keep refs in sync with props/state on every render
  estopRef.current    = estop;
  driveSpeedRef.current = driveSpeed;
  disabledRef.current = disabled;

  // Helper: build speed/steer from pressed state
  function computeCmd() {
    const p = pressedRef.current;
    let speed = 0;
    let steer = 0;
    if (p.forward)  speed = -driveSpeedRef.current;
    if (p.backward) speed =  driveSpeedRef.current;
    if (p.left)     steer = -100;
    if (p.right)    steer =  100;
    return { speed, steer };
  }

  // ── One shared interval — reads pressedRef every 100 ms ─────────────────────
  // The ESP32 watchdog is 600 ms. 100 ms repeat = 6 cmds/sec → very safe.
  useEffect(() => {
    const interval = setInterval(() => {
      if (estopRef.current || disabledRef.current) return;
      const p = pressedRef.current;
      if (!p.forward && !p.backward && !p.left && !p.right) return;
      const { speed, steer } = computeCmd();
      sendDrive(speed, steer);
    }, 100);
    return () => clearInterval(interval);
  }, []); // mount once — reads refs, never stale

  // ── Press / release ─────────────────────────────────────────────────────────
  const press = (key) => {
    if (estopRef.current || disabledRef.current) return;
    pressedRef.current[key] = true;
    setHeldKeys(prev => ({ ...prev, [key]: true }));
    // Send first command IMMEDIATELY — don't wait for first interval tick
    const { speed, steer } = computeCmd();
    sendDrive(speed, steer);
  };

  const release = (key) => {
    pressedRef.current[key] = false;
    setHeldKeys(prev => {
      const next = { ...prev, [key]: false };
      // If nothing is held anymore, send an immediate stop
      if (!next.forward && !next.backward && !next.left && !next.right) {
        if (!estopRef.current) sendDrive(0, 0);
      }
      return next;
    });
  };

  // ── Keyboard: WASD / arrows (multi-key aware) ────────────────────────────────
  useEffect(() => {
    const MAP = {
      ArrowUp:    'forward',
      KeyW:       'forward',
      ArrowDown:  'backward',
      KeyS:       'backward',
      ArrowLeft:  'left',
      KeyA:       'left',
      ArrowRight: 'right',
      KeyD:       'right',
    };
    // Keys that should prevent page scroll/slider movement
    const PREVENT_KEYS = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
      'KeyW', 'KeyA', 'KeyS', 'KeyD',
    ]);

    const down = new Set();

    function onKeyDown(e) {
      // Don't steal keys from form fields
      if (isFormField(document.activeElement)) return;

      if (PREVENT_KEYS.has(e.code)) e.preventDefault();

      const key = MAP[e.code];
      if (!key || down.has(e.code)) return;
      down.add(e.code);
      press(key);

      // Suppress body scroll while a drive key is held
      document.body.style.overflow = 'hidden';
    }

    function onKeyUp(e) {
      if (isFormField(document.activeElement)) return;

      const key = MAP[e.code];
      if (!key) return;
      down.delete(e.code);
      release(key);

      // Restore scroll when no drive keys held
      if (down.size === 0) {
        document.body.style.overflow = '';
      }
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      document.body.style.overflow = ''; // always restore on unmount
    };
  }, []); // mount once — press/release read refs

  // ── E-STOP ───────────────────────────────────────────────────────────────────
  function handleEstop() {
    pressedRef.current = { forward: false, backward: false, left: false, right: false };
    setHeldKeys({ forward: false, backward: false, left: false, right: false });
    setEstop(true);
    sendDriveCommand({ speed: 0, steer: 0, estop: true });
    document.body.style.overflow = '';
  }

  function liftEstop() {
    setEstop(false);
    sendDriveCommand({ speed: 0, steer: 0, estop: false });
  }

  // ── Button props helper ───────────────────────────────────────────────────────
  function btnProps(key) {
    return {
      onPointerDown:  (e) => { e.currentTarget.setPointerCapture(e.pointerId); press(key); },
      onPointerUp:    ()  => release(key),
      onPointerLeave: ()  => release(key),          // safety: cursor/finger leaves button
      onPointerCancel:()  => release(key),
      onTouchStart: (e) => { e.preventDefault(); press(key); },
      onTouchEnd:   (e) => { e.preventDefault(); release(key); },
      onTouchCancel:(e) => { e.preventDefault(); release(key); },
    };
  }

  const stats = useControlStats();
  const isDisabled = disabled || estop;
  const anyHeld    = heldKeys.forward || heldKeys.backward || heldKeys.left || heldKeys.right;
  // Status label: list all active keys
  const heldLabel  = Object.entries(heldKeys)
    .filter(([, v]) => v)
    .map(([k]) => k.toUpperCase())
    .join(' + ');

  return (
    <div
      className="drive-control"
      aria-label="Rover drive controls"
      style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none', WebkitUserSelect: 'none' }}
    >

      {/* ── Panel title + status ── */}
      <div className="drive-panel-header">
        <span className="drive-panel-title">DRIVE CONTROL</span>
        <div className="drive-status-inline">
          <span className={`drive-status-dot ${estop ? 'drive-dot-estop' : disabled ? 'drive-dot-offline' : anyHeld ? 'drive-dot-driving' : 'drive-dot-ok'}`} />
          <span className="drive-status-text">
            {estop ? 'E-STOP ACTIVE' : disabled ? `Link ${link}` : anyHeld ? `DRIVING · ${heldLabel}` : 'READY'}
            {stats.lastRttMs !== null ? ` · ${stats.lastRttMs} ms` : ''}
            {stats.upstreamRttMs !== null ? ` · rover ${stats.upstreamRttMs} ms` : ''}
            {stats.lastError ? ` · ${stats.lastError}` : ''}
          </span>
          {estop && (
            <button type="button" className="drive-btn-lift" onClick={liftEstop}>
              Lift E-Stop
            </button>
          )}
        </div>
      </div>

      {/* ── D-pad grid (3 columns) ── */}
      <div className="dpad" role="group" aria-label="Directional controls">
        {/* Row 1: ← ↑ → */}
        <DPadBtn label="Left"    active={heldKeys.left}     disabled={isDisabled} {...btnProps('left')}>⬅️</DPadBtn>
        <DPadBtn label="Forward" active={heldKeys.forward}  disabled={isDisabled} {...btnProps('forward')}>⬆️</DPadBtn>
        <DPadBtn label="Right"   active={heldKeys.right}    disabled={isDisabled} {...btnProps('right')}>➡️</DPadBtn>

        {/* Row 2: gap ↓ gap */}
        <div className="dpad-empty" />
        <DPadBtn label="Reverse" active={heldKeys.backward} disabled={isDisabled} {...btnProps('backward')}>⬇️</DPadBtn>
        <div className="dpad-empty" />
      </div>

      {/* ── E-STOP ── */}
      <button
        type="button"
        className={`drive-estop ${estop ? 'drive-estop-active' : ''}`}
        onClick={handleEstop}
        disabled={estop}
        aria-label="Emergency stop"
      >
        🛑 E-STOP
      </button>

      <p className="drive-hint">Hold button or use WASD / Arrow keys · multi-key supported</p>
    </div>
  );
}

function DPadBtn({ active, disabled, children, label, ...rest }) {
  return (
    <button
      type="button"
      className={`dpad-btn ${active ? 'dpad-btn-active' : ''}`}
      disabled={disabled}
      aria-pressed={active}
      aria-label={label}
      tabIndex={-1}
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      {...rest}
    >
      {children}
    </button>
  );
}
