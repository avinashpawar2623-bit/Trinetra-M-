/**
 * ArmControl — Pi API /arm_control contract.
 *
 * POST /arm_control body fields (ALL are direction deltas -1 / 0 / +1):
 *   base:  elbow servo (channel 0)
 *   arm:   SHOULDER servo (channel 1)
 *   wrist: wrist servo (channel 2)
 *   clawJ: claw-joint servo (channel 3)
 *   claw:  gripper servo (channel 4)   claw>0 → CLOSE, claw<0 → OPEN
 *   rot:   360° continuous-rotation (channel 5)   rot>0 → CW, rot<0 → CCW
 *   speed: 1–10 step speed
 *   reset: bool
 *
 * Hold pattern:
 *   onPointerDown → setmode ONLINE (once) + send payload immediately + setInterval 200ms
 *   onPointerUp / Leave / Cancel → clearInterval + send ZERO_CMD
 *
 * ZERO_CMD = { base:0, arm:0, wrist:0, clawJ:0, claw:0, rot:0, speed:5, reset:false }
 *
 * Button layout (6 rows, no pump):
 *   ROTATE    : [↻ CW / Q]    [↺ CCW / E]   → rot: +1 / rot: -1
 *   [ROT SPEED slider 1–5, default 2]
 *   SHOULDER  : [▲ UP / R]    [▼ DOWN / F]  → arm: +1 / arm: -1
 *   ELBOW     : [▲ UP / T]    [▼ DOWN / G]  → base: +1 / base: -1
 *   WRIST     : [▲ UP / Y]    [▼ DOWN / H]  → wrist: +1 / wrist: -1
 *   CLAW JT   : [▲ UP / U]    [▼ DOWN / J]  → clawJ: +1 / clawJ: -1
 *   GRIPPER   : [○ OPEN / O]  [● CLOSE / L] → claw: -1 / claw: +1
 */
import { useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';
import { useKeybindings } from '../../hooks/useKeybindings';
import { PI_BASE_URL } from '../../config/constants';

const REPEAT_MS = 200; // resend every 200ms (rover expires 600ms)

// ─── API helpers ──────────────────────────────────────────────────────────────
const ZERO = { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: 5, reset: false };

function makeCmd(overrides) {
  return { ...ZERO, ...overrides };
}

function sendArm(payload) {
  console.log('[ARM] send payload:', JSON.stringify(payload));
  console.log('[ARM] fetch to:', PI_BASE_URL + '/arm_control');
  sendArmCommand(payload);
}

/** POST /setmode ONLINE to put rover in dashboard control mode. Returns a promise. */
function sendOnlineMode() {
  return fetch(`${PI_BASE_URL}/setmode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'ONLINE' }),
  });
}

function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const mobile = window.innerWidth < 768;

// ─── Design constants ─────────────────────────────────────────────────────────
const C = {
  bgCard:   '#0d0d1a',
  bgBtn:    'linear-gradient(145deg, #1a1a2e 0%, #12122a 100%)',
  border:   '1px solid #2a2a4a',
  accent:   '#6d28d9',
  accentGlo:'rgba(109,40,217,0.6)',
  textPri:  '#e2e8f0',
  textDim:  '#94a3b8',
  textKey:  '#64748b',
  radius:   '12px',
};

// ─── Button rows ──────────────────────────────────────────────────────────────
// ROTATE row is index 0 — receives rotSpeedRef value at press time
// GRIPPER: claw < 0 → OPEN (fingers spread), claw > 0 → CLOSE (fingers grip)
const ROWS = [
  {
    label: 'ROTATE',
    isRotate: true, // special: speed comes from rotSpeedRef, not armSpeedRef
    neg: { icon: '↺', label: 'CCW', bindKey: 'baseCCW',      payload: makeCmd({ rot: -1 }) },
    pos: { icon: '↻', label: 'CW',  bindKey: 'baseCW',       payload: makeCmd({ rot: +1 }) },
  },
  {
    label: 'SHOULDER',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'shoulderDown', payload: makeCmd({ arm: -1 }) },
    pos: { icon: '▲', label: 'UP',   bindKey: 'shoulderUp',   payload: makeCmd({ arm: +1 }) },
  },
  {
    label: 'ELBOW',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'elbowDown',    payload: makeCmd({ base: -1 }) },
    pos: { icon: '▲', label: 'UP',   bindKey: 'elbowUp',      payload: makeCmd({ base: +1 }) },
  },
  {
    label: 'WRIST',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'wristDown',    payload: makeCmd({ wrist: -1 }) },
    pos: { icon: '▲', label: 'UP',   bindKey: 'wristUp',      payload: makeCmd({ wrist: +1 }) },
  },
  {
    label: 'CLAW JT',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'gripperClose', payload: makeCmd({ clawJ: -1 }) },
    pos: { icon: '▲', label: 'UP',   bindKey: 'gripperOpen',  payload: makeCmd({ clawJ: +1 }) },
  },
  {
    label: 'GRIPPER',
    // claw: -1 → OPEN (spread), claw: +1 → CLOSE (grip)
    neg: { icon: '○', label: 'OPEN',  bindKey: 'gripperOpen2',  payload: makeCmd({ claw: -1 }) },
    pos: { icon: '●', label: 'CLOSE', bindKey: 'gripperClose2', payload: makeCmd({ claw: +1 }) },
  },
];

// ─── Shared button component ──────────────────────────────────────────────────
function ArmBtn({ label, icon, keyHint, held, disabled, onPress, onRelease }) {
  const ref = useRef(null);

  function pointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    if (ref.current) ref.current.classList.add('arm-pressed');
    onPress?.();
  }
  function pointerUp() {
    if (ref.current) ref.current.classList.remove('arm-pressed');
    onRelease?.();
  }

  return (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      disabled={disabled}
      aria-pressed={held}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerLeave={pointerUp}
      onPointerCancel={pointerUp}
      onTouchStart={(e) => { e.preventDefault(); onPress?.(); }}
      onTouchEnd={(e) => { e.preventDefault(); onRelease?.(); }}
      style={{
        flex: 1,
        minHeight: mobile ? 60 : 52,
        background: held
          ? 'linear-gradient(145deg, #3b1d8a 0%, #2d1570 100%)'
          : C.bgBtn,
        border: held ? '1px solid #7c3aed' : C.border,
        borderRadius: C.radius,
        color: held ? '#c4b5fd' : C.textPri,
        fontSize: 11,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        padding: '6px 4px',
        position: 'relative',
        boxShadow: held
          ? `0 0 14px ${C.accentGlo}, 0 2px 6px rgba(0,0,0,0.5)`
          : '0 2px 6px rgba(0,0,0,0.3)',
        transition: 'box-shadow 80ms, border-color 80ms, background 80ms, color 80ms',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ letterSpacing: '0.4px' }}>{label}</span>
      {!mobile && keyHint && (
        <span style={{
          position: 'absolute', bottom: 3, right: 4,
          fontSize: 9, color: C.textKey,
          background: '#0a0a18', borderRadius: 3, padding: '0 3px',
          lineHeight: '14px', fontFamily: 'monospace',
        }}>{keyHint}</span>
      )}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ArmControl({ disabled = false, armSpeed = 5 }) {
  const { bindings } = useKeybindings();
  const [heldId, setHeldId] = useState(null);
  const [rotSpeed, setRotSpeed] = useState(2); // UI state for slider display
  const [onlineOk, setOnlineOk] = useState(false); // green = ONLINE mode confirmed

  const intervalRef   = useRef(null);
  const heldPayRef    = useRef(null);
  const disabledRef   = useRef(disabled);
  const armSpeedRef   = useRef(armSpeed);
  const rotSpeedRef   = useRef(2);   // 1–5, used for rot commands
  const bindingsRef   = useRef(bindings);
  const modeSetRef    = useRef(false); // tracks if ONLINE mode was sent this session

  disabledRef.current = disabled;
  armSpeedRef.current = armSpeed;
  bindingsRef.current = bindings;

  // ── Send SETMODE ONLINE on mount + repeat every 2s while panel is visible ──
  // The physical remote sends UDP every 50ms which resets remoteMode.
  // Repeating every 2s overwrites it frequently enough for arm commands to land.
  useEffect(() => {
    const doSend = () => {
      sendOnlineMode()
        .then(() => setOnlineOk(true))
        .catch(() => setOnlineOk(false));
    };
    doSend(); // immediate on mount
    const id = setInterval(doSend, 2000); // repeat every 2s
    return () => clearInterval(id); // cleanup on unmount
  }, []);

  // ── Cleanup arm repeat interval on unmount ────────────────────────────────
  useEffect(() => () => clearInterval(intervalRef.current), []);

  // ── Re-send ONLINE mode on first button press (extra safety) ─────────────
  function ensureOnlineMode() {
    if (!modeSetRef.current) {
      sendOnlineMode().catch(() => {});
      modeSetRef.current = true;
    }
  }

  function startHold(id, basePayload, isRotate) {
    if (disabledRef.current) return;
    ensureOnlineMode();
    // Use rotSpeedRef for rotation row, armSpeedRef for all others
    const speed = isRotate ? rotSpeedRef.current : armSpeedRef.current;
    const payload = { ...basePayload, speed };
    clearInterval(intervalRef.current);
    heldPayRef.current = payload;
    setHeldId(id);
    sendArm(payload); // immediate first send
    intervalRef.current = setInterval(() => {
      if (heldPayRef.current) sendArm(heldPayRef.current);
    }, REPEAT_MS);
  }

  function stopHold() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    heldPayRef.current = null;
    setHeldId(null);
    sendArm({ ...ZERO, speed: armSpeedRef.current }); // stop
  }

  function handleReset() {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    heldPayRef.current = null;
    setHeldId(null);
    sendArm({ ...ZERO, speed: armSpeedRef.current, reset: true });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const heldKeys = new Set();

    function buildMap(b) {
      const map = {};
      ROWS.forEach((row, ri) => {
        [row.neg, row.pos].forEach((btn, bi) => {
          const code = b[btn.bindKey];
          if (code) map[code] = { id: `${ri}-${bi}`, payload: btn.payload, isRotate: !!row.isRotate };
        });
      });
      return map;
    }

    function onKeyDown(e) {
      if (isFormField(document.activeElement)) return;
      const map = buildMap(bindingsRef.current);
      const info = map[e.code];
      if (!info || heldKeys.has(e.code)) return;
      e.preventDefault();
      heldKeys.add(e.code);
      startHold(info.id, info.payload, info.isRotate);
    }

    function onKeyUp(e) {
      if (!heldKeys.has(e.code)) return;
      heldKeys.delete(e.code);
      const map = buildMap(bindingsRef.current);
      const info = map[e.code];
      if (info) stopHold();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
      heldKeys.clear();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function fmtKey(code) {
    if (!code) return '?';
    const m = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPC' };
    return m[code] || (code.startsWith('Key') ? code.slice(3) : code);
  }

  function hint(bindKey) { return fmtKey(bindings[bindKey]); }

  const dotColor = disabled ? '#6b7280' : heldId ? '#22c55e' : '#3b82f6';

  return (
    <div
      style={{
        background: C.bgCard,
        border: C.border,
        borderRadius: 16,
        padding: '16px 14px 14px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
      aria-label="Rover arm controls"
    >
      {/* Pulse animation for online dot */}
      <style>{`@keyframes armOnlinePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:0.65}}`}</style>

      {/* Header with ONLINE status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          title={onlineOk ? 'Rover ONLINE mode active' : 'Waiting for ONLINE mode confirmation'}
          style={{
            width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
            background: onlineOk ? '#16a34a' : '#dc2626',
            animation: onlineOk ? 'armOnlinePulse 2s ease-in-out infinite' : 'none',
          }}
        />
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: C.textPri, textTransform: 'uppercase' }}>
          🦾 ARM CONTROL
        </div>
      </div>

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span>{disabled ? '⚠ Pi offline' : heldId ? 'MOVING' : 'ARM READY'}</span>
      </div>

      {/* Joint rows with ROT SPEED slider inserted after ROTATE row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ROWS.map((row, ri) => (
          <div key={ri}>
            {/* Row label */}
            <div style={{ fontSize: 10, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>
              {row.label}
            </div>

            {/* Button pair */}
            <div style={{ display: 'flex', gap: 6 }}>
              <ArmBtn
                icon={row.neg.icon}
                label={row.neg.label}
                keyHint={hint(row.neg.bindKey)}
                held={heldId === `${ri}-0`}
                disabled={disabled}
                onPress={() => startHold(`${ri}-0`, row.neg.payload, !!row.isRotate)}
                onRelease={stopHold}
              />
              <ArmBtn
                icon={row.pos.icon}
                label={row.pos.label}
                keyHint={hint(row.pos.bindKey)}
                held={heldId === `${ri}-1`}
                disabled={disabled}
                onPress={() => startHold(`${ri}-1`, row.pos.payload, !!row.isRotate)}
                onRelease={stopHold}
              />
            </div>

            {/* ROT SPEED slider — inserted after ROTATE row (ri === 0) */}
            {ri === 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginTop: 6, padding: '6px 8px',
                background: '#16213e', borderRadius: 8,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: C.textDim, textTransform: 'uppercase', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                  ROT SPEED
                </span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={rotSpeed}
                  tabIndex={-1}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setRotSpeed(v);
                    rotSpeedRef.current = v;
                  }}
                  style={{ flex: 1, accentColor: C.accent, cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', minWidth: 14, textAlign: 'right', fontFamily: 'monospace' }}>
                  {rotSpeed}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reset */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleReset}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '7px 0',
          marginTop: 8,
          borderRadius: 10,
          border: C.border,
          background: C.bgBtn,
          color: C.textDim,
          fontSize: 11,
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
      >
        🏠 Reset All
      </button>

      {!mobile && (
        <p style={{ fontSize: 10, color: '#334155', marginTop: 6, textAlign: 'center', lineHeight: 1.6 }}>
          Q/E Rotate · R/F Shoulder · T/G Elbow · Y/H Wrist · U/J ClawJt · O/L Gripper
        </p>
      )}
    </div>
  );
}
