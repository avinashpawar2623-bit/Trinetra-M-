/**
 * DriveControl — Redesigned game-controller-style D-pad.
 *
 * Layout:
 *        [⬆ W]
 *   [⬅ A] [■] [➡ D]
 *        [⬇ S]
 *   ─────────────────
 *   DRIVE SPEED slider
 *   ⛔ EMERGENCY STOP
 *
 * Features:
 *   • 100ms repeat interval (ESP32 watchdog 600ms, 100ms = safe)
 *   • Immediate first command on press (zero felt latency)
 *   • Arrow keys call preventDefault — no page scroll
 *   • body.overflow hidden while driving, restored on key-up
 *   • Keyboard bindings loaded from useKeybindings (remappable)
 *   • Key badges hidden on mobile (<768px)
 *   • user-select:none and touch-action:none on all buttons
 */
import { useEffect, useRef, useState } from 'react';
import { sendDriveCommand } from '../../hooks/usePiApi';
import { useControlStats } from '../../hooks/useControlStats';
import { useKeybindings } from '../../hooks/useKeybindings';
import { noteControlActivity } from '../../lib/dashboardMode';

const isMobile = () => window.innerWidth < 768;

function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function sendDrive(speed, steer) {
  sendDriveCommand({ speed, steer, estop: false });
  if (import.meta.env.DEV) {
    console.log('[DriveControl] send', { speed, steer });
  }
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = {
  panel: {
    background: '#1a1a2e',
    border: '1px solid #16213e',
    borderRadius: 16,
    padding: '16px 14px 14px',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
    overscrollBehavior: 'contain',
  },
  header: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#e94560',
    marginBottom: 12,
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  dpadWrap: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 64px)',
    gridTemplateRows: 'repeat(3, 64px)',
    gap: 6,
    justifyContent: 'center',
    marginBottom: 10,
  },
  btn: (active) => ({
    width: 64,
    height: 64,
    minWidth: 64,
    minHeight: 64,
    borderRadius: 14,
    border: `2px solid ${active ? '#e94560' : '#0f3460'}`,
    background: active
      ? 'linear-gradient(145deg, #e94560, #c73652)'
      : 'linear-gradient(145deg, #16213e, #0f3460)',
    color: active ? '#fff' : '#94a3b8',
    fontSize: 22,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    boxShadow: active
      ? '0 0 12px #e94560, 0 2px 8px rgba(0,0,0,0.5)'
      : '0 2px 8px rgba(0,0,0,0.4)',
    transition: 'box-shadow 80ms, border-color 80ms, background 80ms',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    touchAction: 'none',
  }),
  keyBadge: {
    fontSize: 9,
    color: '#888',
    background: '#111',
    borderRadius: 4,
    padding: '1px 4px',
    fontFamily: 'monospace',
    letterSpacing: '0.05em',
  },
  centerBtn: (active) => ({
    width: 52,
    height: 52,
    minWidth: 52,
    minHeight: 52,
    borderRadius: 10,
    border: `2px solid ${active ? '#e94560' : '#334155'}`,
    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
    color: '#475569',
    fontSize: 18,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
  }),
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    padding: '8px 4px',
    background: '#16213e',
    borderRadius: 10,
  },
  sliderLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    whiteSpace: 'nowrap',
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#e94560',
    minWidth: 40,
    textAlign: 'right',
    fontFamily: 'monospace',
  },
  estopBtn: (active) => ({
    width: '100%',
    padding: '12px 0',
    borderRadius: 12,
    border: '2px solid #ef4444',
    background: active
      ? 'linear-gradient(145deg, #7f1d1d, #450a0a)'
      : 'linear-gradient(145deg, #991b1b, #7f1d1d)',
    color: '#fca5a5',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    boxShadow: active
      ? '0 0 20px #ef4444'
      : '0 2px 8px rgba(239,68,68,0.3)',
    transition: 'box-shadow 80ms',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }),
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  statusDot: (color) => ({
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
};

export default function DriveControl({ disabled = false, driveSpeed = 70, link = 'disconnected' }) {
  const { bindings } = useKeybindings();
  const [estop, setEstop] = useState(false);
  const [heldKeys, setHeldKeys] = useState({ forward: false, backward: false, left: false, right: false });
  const mobile = isMobile();

  const pressedRef    = useRef({ forward: false, backward: false, left: false, right: false });
  const estopRef      = useRef(false);
  const driveSpeedRef = useRef(driveSpeed);
  const disabledRef   = useRef(disabled);
  const bindingsRef   = useRef(bindings);

  estopRef.current    = estop;
  driveSpeedRef.current = driveSpeed;
  disabledRef.current = disabled;
  bindingsRef.current = bindings;

  function computeCmd() {
    const p = pressedRef.current;
    let speed = 0, steer = 0;
    if (p.forward)  speed = -driveSpeedRef.current;
    if (p.backward) speed =  driveSpeedRef.current;
    if (p.left)     steer = -100;
    if (p.right)    steer =  100;
    return { speed, steer };
  }

  // ── 100ms repeat interval ─────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (estopRef.current || disabledRef.current) return;
      const p = pressedRef.current;
      if (!p.forward && !p.backward && !p.left && !p.right) return;
      const { speed, steer } = computeCmd();
      noteControlActivity();
      sendDrive(speed, steer);
    }, 100);
    return () => clearInterval(iv);
  }, []);

  const press = (key) => {
    if (estopRef.current || disabledRef.current) return;
    pressedRef.current[key] = true;
    setHeldKeys(prev => ({ ...prev, [key]: true }));
    const { speed, steer } = computeCmd();
    noteControlActivity();
    sendDrive(speed, steer);
  };

  const release = (key) => {
    pressedRef.current[key] = false;
    setHeldKeys(prev => {
      const next = { ...prev, [key]: false };
      if (!next.forward && !next.backward && !next.left && !next.right) {
        if (!estopRef.current) sendDrive(0, 0);
      }
      return next;
    });
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const SCROLL_PREVENT = new Set([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
    ]);
    const down = new Set();

    function codeToDir(code) {
      const b = bindingsRef.current;
      if (code === b.driveForward   || code === b.driveForwardAlt) return 'forward';
      if (code === b.driveBack      || code === b.driveBackAlt)    return 'backward';
      if (code === b.driveLeft      || code === b.driveLeftAlt)    return 'left';
      if (code === b.driveRight     || code === b.driveRightAlt)   return 'right';
      return null;
    }

    function onKeyDown(e) {
      if (isFormField(document.activeElement)) return;
      if (SCROLL_PREVENT.has(e.code)) e.preventDefault();
      if (e.code === bindingsRef.current.eStop) {
        if (down.has(e.code)) return;
        down.add(e.code);
        pressedRef.current = { forward: false, backward: false, left: false, right: false };
        setHeldKeys({ forward: false, backward: false, left: false, right: false });
        estopRef.current = true;
        setEstop(true);
        sendDriveCommand({ speed: 0, steer: 0, estop: true });
        document.body.style.overflow = '';
        return;
      }
      const dir = codeToDir(e.code);
      if (!dir || down.has(e.code)) return;
      down.add(e.code);
      press(dir);
      document.body.style.overflow = 'hidden';
    }

    function onKeyUp(e) {
      if (isFormField(document.activeElement)) return;
      down.delete(e.code);
      const dir = codeToDir(e.code);
      if (!dir) return;
      release(dir);
      if (down.size === 0) document.body.style.overflow = '';
    }

    function onBlur() {
      down.clear();
      pressedRef.current = { forward: false, backward: false, left: false, right: false };
      setHeldKeys({ forward: false, backward: false, left: false, right: false });
      if (!estopRef.current) sendDrive(0, 0);
      document.body.style.overflow = '';
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.body.style.overflow = '';
    };
  }, []);

  // ── E-STOP ────────────────────────────────────────────────────────────────
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

  function btnProps(key) {
    return {
      onPointerDown: (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        press(key);
      },
      onPointerUp: (e) => {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        release(key);
      },
      onPointerCancel: () => release(key),
      onContextMenu: (e) => e.preventDefault(),
    };
  }

  const stats = useControlStats();
  const isDisabled = disabled || estop;
  const anyHeld = heldKeys.forward || heldKeys.backward || heldKeys.left || heldKeys.right;

  const dotColor = estop ? '#ef4444' : disabled ? '#6b7280' : anyHeld ? '#22c55e' : '#3b82f6';

  const fmtKey = (code) => {
    if (!code) return '?';
    const m = { ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Space:'SPC' };
    return m[code] || (code.startsWith('Key') ? code.slice(3) : code);
  };

  return (
    <div style={S.panel} aria-label="Rover drive controls">

      {/* Header */}
      <div style={S.header}>🚗 DRIVE CONTROL</div>

      {/* Status row */}
      <div style={S.statusRow}>
        <div style={S.statusDot(dotColor)} />
        <span>
          {estop ? 'E-STOP ACTIVE' : disabled ? `Link ${link}` : anyHeld ? 'DRIVING' : 'READY'}
          {stats.lastRttMs !== null ? ` · ${stats.lastRttMs}ms` : ''}
          {stats.lastError ? ` · ${stats.lastError}` : ''}
        </span>
        {estop && (
          <button type="button" onClick={liftEstop}
            style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#fca5a5', fontSize: 11, cursor: 'pointer' }}>
            Lift E-Stop
          </button>
        )}
      </div>

      {/* D-pad */}
      <div style={S.dpadWrap}>
        {/* Row 1: empty | Up | empty */}
        <div />
        <button type="button" disabled={isDisabled} style={S.btn(heldKeys.forward)} {...btnProps('forward')} tabIndex={-1}>
          ⬆
          {!mobile && <span style={S.keyBadge}>{fmtKey(bindings.driveForward)}/{fmtKey(bindings.driveForwardAlt)}</span>}
        </button>
        <div />

        {/* Row 2: Left | Center-Stop | Right */}
        <button type="button" disabled={isDisabled} style={S.btn(heldKeys.left)} {...btnProps('left')} tabIndex={-1}>
          ⬅
          {!mobile && <span style={S.keyBadge}>{fmtKey(bindings.driveLeft)}/{fmtKey(bindings.driveLeftAlt)}</span>}
        </button>
        <div style={S.centerBtn(false)}>■</div>
        <button type="button" disabled={isDisabled} style={S.btn(heldKeys.right)} {...btnProps('right')} tabIndex={-1}>
          ➡
          {!mobile && <span style={S.keyBadge}>{fmtKey(bindings.driveRight)}/{fmtKey(bindings.driveRightAlt)}</span>}
        </button>

        {/* Row 3: empty | Down | empty */}
        <div />
        <button type="button" disabled={isDisabled} style={S.btn(heldKeys.backward)} {...btnProps('backward')} tabIndex={-1}>
          ⬇
          {!mobile && <span style={S.keyBadge}>{fmtKey(bindings.driveBack)}/{fmtKey(bindings.driveBackAlt)}</span>}
        </button>
        <div />
      </div>

      {/* E-STOP */}
      <button
        type="button"
        style={S.estopBtn(estop)}
        onClick={estop ? liftEstop : handleEstop}
        aria-label="Emergency stop"
      >
        ⛔ {estop ? 'LIFT E-STOP' : 'EMERGENCY STOP'}
      </button>

      {!mobile && (
        <p style={{ fontSize: 10, color: '#475569', marginTop: 8, textAlign: 'center' }}>
          Hold button or use {fmtKey(bindings.driveForwardAlt)}/{fmtKey(bindings.driveBackAlt)}/{fmtKey(bindings.driveLeftAlt)}/{fmtKey(bindings.driveRightAlt)} · multi-key supported
        </p>
      )}
    </div>
  );
}
