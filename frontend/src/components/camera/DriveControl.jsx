/**
 * DriveControl — Directional drive pad for the rover.
 *
 * Layout: 3-column grid
 *   [ ← ]  [ ⬆️ ]  [ → ]
 *   [   ]  [ ⬇️ ]  [   ]
 *         [🛑 E-STOP]
 *
 * Safety:
 *   • One shared interval reads all pressed buttons every 80 ms.
 *   • pressedRef tracks simultaneous keys — no stale closure.
 *   • Zero-speed stop sent immediately when all keys released.
 *   • E-STOP clears all state and sends estop: true.
 *   • Keyboard: WASD / Arrow keys (multi-key aware).
 *
 * Props:
 *   disabled    – boolean, true when Pi offline
 *   driveSpeed  – number (10–100), from RoverControlPanel
 */
import { useEffect, useRef, useState } from 'react';
import { sendDriveCommand } from '../../hooks/usePiApi';

/** Fire-and-forget drive POST. */
function sendDrive(speed, steer) {
  sendDriveCommand({ speed, steer, estop: false });
}

export default function DriveControl({ disabled = false, driveSpeed = 70 }) {
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

  // ── One shared interval — reads pressedRef every 80 ms ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      if (estopRef.current || disabledRef.current) return;
      const p = pressedRef.current;
      if (!p.forward && !p.backward && !p.left && !p.right) return;

      let speed = 0;
      let steer = 0;
      if (p.forward)  speed = -driveSpeedRef.current;
      if (p.backward) speed =  driveSpeedRef.current;
      if (p.left)     steer = -100;
      if (p.right)    steer =  100;

      sendDrive(speed, steer);
    }, 80);
    return () => clearInterval(interval);
  }, []); // mount once — reads refs, never stale

  // ── Press / release ─────────────────────────────────────────────────────────
  const press = (key) => {
    if (estopRef.current || disabledRef.current) return;
    pressedRef.current[key] = true;
    setHeldKeys(prev => ({ ...prev, [key]: true }));
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
      ArrowUp: 'forward',   KeyW: 'forward',
      ArrowDown: 'backward', KeyS: 'backward',
      ArrowLeft: 'left',    KeyA: 'left',
      ArrowRight: 'right',  KeyD: 'right',
    };
    const down = new Set();
    function onKeyDown(e) {
      const key = MAP[e.code];
      if (!key || down.has(e.code)) return;
      down.add(e.code);
      press(key);
    }
    function onKeyUp(e) {
      const key = MAP[e.code];
      if (!key) return;
      down.delete(e.code);
      release(key);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, []); // mount once — press/release read refs

  // ── E-STOP ───────────────────────────────────────────────────────────────────
  function handleEstop() {
    pressedRef.current = { forward: false, backward: false, left: false, right: false };
    setHeldKeys({ forward: false, backward: false, left: false, right: false });
    setEstop(true);
    sendDriveCommand({ speed: 0, steer: 0, estop: true });
  }

  function liftEstop() {
    setEstop(false);
    sendDriveCommand({ speed: 0, steer: 0, estop: false });
  }

  // ── Button props helper ───────────────────────────────────────────────────────
  function btnProps(key) {
    return {
      onMouseDown:  ()  => press(key),
      onMouseUp:    ()  => release(key),
      onMouseLeave: ()  => release(key),          // safety: cursor leaves button
      onTouchStart: (e) => { e.preventDefault(); press(key); },
      onTouchEnd:   (e) => { e.preventDefault(); release(key); },
      onTouchCancel:(e) => { e.preventDefault(); release(key); },
    };
  }

  const isDisabled = disabled || estop;
  const anyHeld    = heldKeys.forward || heldKeys.backward || heldKeys.left || heldKeys.right;
  // Status label: list all active keys
  const heldLabel  = Object.entries(heldKeys)
    .filter(([, v]) => v)
    .map(([k]) => k.toUpperCase())
    .join(' + ');

  return (
    <div className="drive-control" aria-label="Rover drive controls">

      {/* ── Panel title + status ── */}
      <div className="drive-panel-header">
        <span className="drive-panel-title">DRIVE CONTROL</span>
        <div className="drive-status-inline">
          <span className={`drive-status-dot ${estop ? 'drive-dot-estop' : disabled ? 'drive-dot-offline' : anyHeld ? 'drive-dot-driving' : 'drive-dot-ok'}`} />
          <span className="drive-status-text">
            {estop ? 'E-STOP ACTIVE' : disabled ? 'Pi offline' : anyHeld ? `DRIVING · ${heldLabel}` : 'READY'}
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
        <DPadBtn active={heldKeys.left}     disabled={isDisabled} {...btnProps('left')}>⬅️</DPadBtn>
        <DPadBtn active={heldKeys.forward}  disabled={isDisabled} {...btnProps('forward')}>⬆️</DPadBtn>
        <DPadBtn active={heldKeys.right}    disabled={isDisabled} {...btnProps('right')}>➡️</DPadBtn>

        {/* Row 2: gap ↓ gap */}
        <div className="dpad-empty" />
        <DPadBtn active={heldKeys.backward} disabled={isDisabled} {...btnProps('backward')}>⬇️</DPadBtn>
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

function DPadBtn({ active, disabled, children, ...rest }) {
  return (
    <button
      type="button"
      className={`dpad-btn ${active ? 'dpad-btn-active' : ''}`}
      disabled={disabled}
      aria-pressed={active}
      {...rest}
    >
      {children}
    </button>
  );
}
