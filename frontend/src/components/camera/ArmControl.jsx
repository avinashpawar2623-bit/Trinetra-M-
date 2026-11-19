/**
 * ArmControl — Verified Pi API /arm_control contract.
 *
 * POST /arm_control body fields (ALL are direction deltas -1 / 0 / +1):
 *   base:  elbow servo (channel 0)
 *   arm:   SHOULDER servo (channel 1)
 *   wrist: wrist servo (channel 2)
 *   clawJ: claw-joint servo (channel 3)
 *   claw:  gripper servo (channel 4)
 *   rot:   360° continuous-rotation base (channel 5)
 *   speed: 1–10 step speed
 *   reset: bool
 *
 * Hold pattern:
 *   onPointerDown → send payload immediately, then resend every 200ms
 *   onPointerUp / Leave / Cancel → clearInterval, send ZERO_CMD
 *
 * ZERO_CMD = { base:0, arm:0, wrist:0, clawJ:0, claw:0, rot:0, speed:5 }
 *
 * Button layout:
 *   ROTATE    : [↻ CW / Q]   [↺ CCW / E]   → rot: +1 / rot: -1
 *   SHOULDER  : [▲ UP / R]   [▼ DOWN / F]  → arm: +1 / arm: -1
 *   ELBOW     : [▲ UP / T]   [▼ DOWN / G]  → base: +1 / base: -1
 *   WRIST     : [▲ UP / Y]   [▼ DOWN / H]  → wrist: +1 / wrist: -1
 *   CLAW JT   : [▲ UP / U]   [▼ DOWN / J]  → clawJ: +1 / clawJ: -1
 *   GRIPPER   : [○ OPEN / O] [● CLOSE / L] → claw: -1 / claw: +1
 *   PUMP      : [💧 PUMP / P]  (full width toggle)
 */
import { useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';
import { useKeybindings } from '../../hooks/useKeybindings';

const REPEAT_MS = 200; // resend every 200ms while held (rover expires 600ms)

// ─── API helpers ──────────────────────────────────────────────────────────────
const ZERO = { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: 5, reset: false };

function makeCmd(overrides) {
  return { ...ZERO, ...overrides };
}

function sendArm(payload) {
  console.log('[ARM] send', JSON.stringify(payload));
  sendArmCommand(payload);
}

function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const mobile = window.innerWidth < 768;

// ─── Design constants ─────────────────────────────────────────────────────────
const C = {
  bgCard:    '#0d0d1a',
  bgBtn:     'linear-gradient(145deg, #1a1a2e 0%, #12122a 100%)',
  bgBtnHov:  'linear-gradient(145deg, #22223a 0%, #1a1a30 100%)',
  border:    '1px solid #2a2a4a',
  borderHov: '1px solid #4a4a7a',
  accent:    '#6d28d9',
  accentGlo: 'rgba(109,40,217,0.6)',
  danger:    '#dc2626',
  dangerGlo: 'rgba(220,38,38,0.6)',
  success:   '#16a34a',
  textPri:   '#e2e8f0',
  textDim:   '#94a3b8',
  textKey:   '#64748b',
  radius:    '12px',
};

// ─── Button rows ──────────────────────────────────────────────────────────────
// Each entry defines the two buttons in a row.
// field: the payload field driven by this button
// dir: +1 or -1
// bindKey: key into useKeybindings bindings object
const ROWS = [
  {
    label: 'ROTATE',
    neg: { icon: '↺', label: 'CCW', bindKey: 'baseCCW',     payload: makeCmd({ rot: -1 }) },
    pos: { icon: '↻', label: 'CW',  bindKey: 'baseCW',      payload: makeCmd({ rot: +1 }) },
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
    neg: { icon: '●', label: 'CLOSE', bindKey: 'gripperClose2', payload: makeCmd({ claw: +1 }) },
    pos: { icon: '○', label: 'OPEN',  bindKey: 'gripperOpen2',  payload: makeCmd({ claw: -1 }) },
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
  const [heldId, setHeldId]   = useState(null); // which btn is held
  const [pumpOn, setPumpOn]   = useState(false);

  const intervalRef  = useRef(null);
  const heldPayRef   = useRef(null); // payload currently being repeated
  const disabledRef  = useRef(disabled);
  const armSpeedRef  = useRef(armSpeed);
  const bindingsRef  = useRef(bindings);

  disabledRef.current = disabled;
  armSpeedRef.current = armSpeed;
  bindingsRef.current = bindings;

  // Cleanup interval on unmount
  useEffect(() => () => clearInterval(intervalRef.current), []);

  function startHold(id, basePayload) {
    if (disabledRef.current) return;
    // Apply current armSpeed to payload
    const payload = { ...basePayload, speed: armSpeedRef.current };
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
    sendArm({ ...ZERO, speed: armSpeedRef.current }); // immediate stop
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

    // Build a code → { id, payload } map from bindings + ROWS
    function buildMap(b) {
      const map = {};
      ROWS.forEach((row, ri) => {
        [row.neg, row.pos].forEach((btn, bi) => {
          const code = b[btn.bindKey];
          if (code) map[code] = { id: `${ri}-${bi}`, payload: btn.payload };
        });
      });
      // Pump toggle
      if (b.pumpToggle) map[b.pumpToggle] = { pump: true };
      return map;
    }

    function onKeyDown(e) {
      if (isFormField(document.activeElement)) return;
      const map = buildMap(bindingsRef.current);
      const info = map[e.code];
      if (!info || heldKeys.has(e.code)) return;
      e.preventDefault();
      heldKeys.add(e.code);
      if (info.pump) { setPumpOn(p => !p); return; }
      startHold(info.id, info.payload);
    }

    function onKeyUp(e) {
      if (!heldKeys.has(e.code)) return;
      heldKeys.delete(e.code);
      const map = buildMap(bindingsRef.current);
      const info = map[e.code];
      if (info && !info.pump) stopHold();
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
    const m = { ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Space:'SPC' };
    return m[code] || (code.startsWith('Key') ? code.slice(3) : code);
  }

  // Build key-hint strings from current bindings
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
      {/* Header */}
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: C.textPri, marginBottom: 12, textTransform: 'uppercase' }}>
        🦾 ARM
      </div>

      {/* Status dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 11, color: C.textDim, fontFamily: 'monospace' }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
        <span>{disabled ? '⚠ Pi offline' : heldId ? 'MOVING' : 'ARM READY'}</span>
      </div>

      {/* Joint rows */}
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
                onPress={() => startHold(`${ri}-0`, row.neg.payload)}
                onRelease={stopHold}
              />
              <ArmBtn
                icon={row.pos.icon}
                label={row.pos.label}
                keyHint={hint(row.pos.bindKey)}
                held={heldId === `${ri}-1`}
                disabled={disabled}
                onPress={() => startHold(`${ri}-1`, row.pos.payload)}
                onRelease={stopHold}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Pump toggle */}
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={() => {
          setPumpOn(p => !p);
          console.warn('[ARM] pump toggle not implemented — no /pump endpoint in controlClient.js');
        }}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '10px 0',
          borderRadius: C.radius,
          border: pumpOn ? '1px solid #1d4ed8' : C.border,
          background: pumpOn
            ? 'linear-gradient(145deg, #1e3a5f, #142d47)'
            : C.bgBtn,
          color: pumpOn ? '#93c5fd' : C.textDim,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.08em',
          boxShadow: pumpOn ? '0 0 14px rgba(29,78,216,0.5)' : 'none',
          transition: 'box-shadow 80ms, border-color 80ms',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        aria-pressed={pumpOn}
      >
        💧 PUMP{!mobile && <span style={{ fontSize: 9, color: C.textKey, marginLeft: 8, fontFamily: 'monospace', background: '#0a0a18', padding: '0 3px', borderRadius: 3 }}>{hint('pumpToggle')}</span>}
      </button>

      {/* Reset */}
      <button
        type="button"
        tabIndex={-1}
        onClick={handleReset}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '7px 0',
          marginTop: 6,
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
          Q/E Rotate · R/F Shoulder · T/G Elbow · Y/H Wrist · U/J ClawJt · O/L Gripper · P Pump
        </p>
      )}
    </div>
  );
}
