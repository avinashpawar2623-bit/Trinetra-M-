/**
 * ArmControl — Redesigned game-controller-style arm panel.
 *
 * Base servo: 360° CONTINUOUS ROTATION servo.
 *   angle 90 = STOP.  < 90 = CCW.  > 90 = CW.
 *   CW button held  → send base_angle = 100 (90+10), release → 90
 *   CCW button held → send base_angle = 80  (90-10), release → 90
 *   NO base speed slider — fixed 10° offset.
 *
 * All other joints: POSITIONAL servos.
 *   Track angle client-side (init 90°), clamp 0–180.
 *   Each tick (100ms): angle ± 5°
 *   On release: send current angle (hold position).
 *
 * Keyboard shortcuts (from useKeybindings, remappable in SettingsPanel):
 *   Q/E  → Base CCW/CW
 *   R/F  → Shoulder Up/Down
 *   T/G  → Elbow Up/Down
 *   Y/H  → Wrist Up/Down
 *   U/J  → Gripper Open/Close
 *   P    → Pump toggle
 *
 * Visual flash on each button when command fires (ref-based, no re-render).
 * Key badges hidden on mobile (<768px).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';
import { useKeybindings } from '../../hooks/useKeybindings';

const SEND_INTERVAL_MS = 100;
const STEP = 5;             // positional servo: degrees per tick
const BASE_CW_ANGLE  = 100; // 90 + 10 → slow CW
const BASE_CCW_ANGLE = 80;  // 90 - 10 → slow CCW
const BASE_STOP      = 90;  // neutral stop

const isMobile = () => window.innerWidth < 768;

function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const COLOR_MAP = {
  blue:   { border: '#3b82f6', glow: '#3b82f6', label: '#60a5fa' },
  green:  { border: '#22c55e', glow: '#22c55e', label: '#4ade80' },
  purple: { border: '#a855f7', glow: '#a855f7', label: '#c084fc' },
  orange: { border: '#f97316', glow: '#f97316', label: '#fb923c' },
  yellow: { border: '#eab308', glow: '#eab308', label: '#facc15' },
  cyan:   { border: '#06b6d4', glow: '#06b6d4', label: '#22d3ee' },
  red:    { border: '#ef4444', glow: '#ef4444', label: '#f87171' },
};

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
    marginBottom: 10,
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  rowLabel: (color) => ({
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: COLOR_MAP[color]?.label ?? '#94a3b8',
    minWidth: 52,
    textAlign: 'right',
    flexShrink: 0,
  }),
  btnPair: {
    display: 'flex',
    gap: 6,
    flex: 1,
  },
  btn: (held, color) => {
    const c = COLOR_MAP[color] ?? COLOR_MAP.blue;
    return {
      flex: 1,
      minHeight: isMobile() ? 56 : 52,
      borderRadius: 12,
      border: `2px solid ${held ? c.glow : c.border}`,
      background: held
        ? `linear-gradient(145deg, ${c.border}66, ${c.border}33)`
        : 'linear-gradient(145deg, #16213e, #0f172a)',
      color: held ? '#fff' : '#94a3b8',
      fontSize: 12,
      fontWeight: 600,
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      boxShadow: held
        ? `0 0 12px ${c.glow}88, 0 2px 6px rgba(0,0,0,0.5)`
        : '0 2px 6px rgba(0,0,0,0.3)',
      transition: 'box-shadow 80ms, border-color 80ms, background 80ms',
      userSelect: 'none',
      WebkitUserSelect: 'none',
      touchAction: 'none',
      padding: '4px 2px',
    };
  },
  keyBadge: {
    fontSize: 9,
    color: '#888',
    background: '#111',
    borderRadius: 3,
    padding: '1px 3px',
    fontFamily: 'monospace',
    marginTop: 1,
  },
  pumpBtn: (on) => ({
    width: '100%',
    padding: '10px 0',
    marginTop: 8,
    borderRadius: 12,
    border: `2px solid ${on ? '#06b6d4' : '#0f3460'}`,
    background: on
      ? 'linear-gradient(145deg, #164e63, #0c4a6e)'
      : 'linear-gradient(145deg, #16213e, #0f172a)',
    color: on ? '#67e8f9' : '#64748b',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.08em',
    boxShadow: on ? '0 0 14px #06b6d488' : 'none',
    transition: 'box-shadow 80ms, border-color 80ms',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  }),
  resetBtn: {
    width: '100%',
    padding: '8px 0',
    marginTop: 6,
    borderRadius: 10,
    border: '1px solid #334155',
    background: 'linear-gradient(145deg, #1e293b, #0f172a)',
    color: '#475569',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    userSelect: 'none',
    WebkitUserSelect: 'none',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    fontSize: 11,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  statusDot: (color) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: color,
    flexShrink: 0,
  }),
};

// ─── Joint definitions ────────────────────────────────────────────────────────
const JOINTS = [
  {
    id: 'base', label: 'Base', color: 'blue',
    negLabel: '↺ CCW', posLabel: 'CW ↻',
    bindNeg: 'baseCCW', bindPos: 'baseCW',
    isBase: true,
  },
  {
    id: 'shoulder', label: 'Shoulder', color: 'green',
    negLabel: '↓ Down', posLabel: '↑ Up',
    bindNeg: 'shoulderDown', bindPos: 'shoulderUp',
    field: 'arm', negDelta: -STEP, posDelta: +STEP,
  },
  {
    id: 'elbow', label: 'Elbow', color: 'purple',
    negLabel: '↓ Down', posLabel: '↑ Up',
    bindNeg: 'elbowDown', bindPos: 'elbowUp',
    field: 'wrist', negDelta: -STEP, posDelta: +STEP,
  },
  {
    id: 'wrist', label: 'Wrist', color: 'orange',
    negLabel: '↓ Down', posLabel: '↑ Up',
    bindNeg: 'wristDown', bindPos: 'wristUp',
    field: 'clawJ', negDelta: -STEP, posDelta: +STEP,
  },
  {
    id: 'gripper', label: 'Gripper', color: 'yellow',
    negLabel: '● Close', posLabel: '○ Open',
    bindNeg: 'gripperClose', bindPos: 'gripperOpen',
    field: 'claw', negDelta: -STEP, posDelta: +STEP,
  },
];

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export default function ArmControl({ disabled = false, armSpeed = 5 }) {
  const { bindings } = useKeybindings();
  const [heldKey, setHeldKey] = useState(null);
  const [pumpOn, setPumpOn] = useState(false);
  const mobile = isMobile();

  // Positional servo angles tracked client-side (init 90°)
  const angles = useRef({ arm: 90, wrist: 90, clawJ: 90, claw: 90 });

  const intervalRef  = useRef(null);
  const heldRef      = useRef(null);
  const armSpeedRef  = useRef(armSpeed);
  const disabledRef  = useRef(disabled);
  const bindingsRef  = useRef(bindings);
  const btnElRefs    = useRef({});

  heldRef.current     = heldKey;
  armSpeedRef.current = armSpeed;
  disabledRef.current = disabled;
  bindingsRef.current = bindings;

  /** Flash a button green for 120ms (no setState). */
  function flashBtn(id) {
    const el = btnElRefs.current[id];
    if (!el) return;
    el.style.boxShadow = '0 0 0 2px #22c55e';
    el.style.borderColor = '#22c55e';
    setTimeout(() => {
      if (el) { el.style.boxShadow = ''; el.style.borderColor = ''; }
    }, 120);
  }

  /** Build and send one arm command. */
  function sendCmd(joint, delta, flashId) {
    if (flashId) flashBtn(flashId);

    if (joint.isBase) {
      // Base: continuous rotation — use fixed angle
      const angle = delta > 0 ? BASE_CW_ANGLE : BASE_CCW_ANGLE;
      const cmd = { base_angle: angle, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: armSpeedRef.current, reset: false };
      console.log('[ArmControl] base cmd', cmd);
      sendArmCommand(cmd);
    } else {
      // Positional: track angle client-side
      const field = joint.field;
      angles.current[field] = clamp(angles.current[field] + delta, 0, 180);
      const cmd = {
        base_angle: BASE_STOP, // keep base stopped
        arm:   field === 'arm'   ? angles.current.arm   : 0,
        wrist: field === 'wrist' ? angles.current.wrist : 0,
        clawJ: field === 'clawJ' ? angles.current.clawJ : 0,
        claw:  field === 'claw'  ? angles.current.claw  : 0,
        rot: 0,
        speed: armSpeedRef.current,
        reset: false,
      };
      console.log('[ArmControl] positional cmd', joint.id, field, angles.current[field], cmd);
      sendArmCommand(cmd);
    }
  }

  /** Stop: send base neutral, keep positional at current angles. */
  function sendStop() {
    const cmd = {
      base_angle: BASE_STOP,
      arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0,
      speed: armSpeedRef.current, reset: false,
    };
    sendArmCommand(cmd);
  }

  const startHold = useCallback((joint, delta, key, flashId) => {
    if (disabledRef.current) return;
    setHeldKey(key);
    sendCmd(joint, delta, flashId);
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (heldRef.current === key) {
        sendCmd(joint, delta, null);
      }
    }, SEND_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopHold = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setHeldKey(null);
    sendStop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function handleReset() {
    clearInterval(intervalRef.current);
    setHeldKey(null);
    angles.current = { arm: 90, wrist: 90, clawJ: 90, claw: 90 };
    sendArmCommand({ base_angle: BASE_STOP, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: armSpeedRef.current, reset: true });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const heldKbKeys = new Set();

    function findAction(code) {
      const b = bindingsRef.current;
      for (const j of JOINTS) {
        if (code === b[j.bindNeg]) return { joint: j, delta: j.isBase ? -1 : j.negDelta, btnId: `${j.id}-neg` };
        if (code === b[j.bindPos]) return { joint: j, delta: j.isBase ?  1 : j.posDelta, btnId: `${j.id}-pos` };
      }
      if (code === b.pumpToggle) return { pump: true };
      return null;
    }

    function onKeyDown(e) {
      if (isFormField(document.activeElement)) return;
      const info = findAction(e.code);
      if (!info || heldKbKeys.has(e.code)) return;
      e.preventDefault();
      heldKbKeys.add(e.code);
      if (info.pump) {
        setPumpOn(p => !p);
        return;
      }
      startHold(info.joint, info.delta, `kb-${info.btnId}`, info.btnId);
    }

    function onKeyUp(e) {
      if (!heldKbKeys.has(e.code)) return;
      heldKbKeys.delete(e.code);
      const info = findAction(e.code);
      if (info && !info.pump) stopHold();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [startHold, stopHold]);

  function holdProps(joint, delta, key, flashId) {
    return {
      onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(joint, delta, key, flashId); },
      onPointerUp: stopHold,
      onPointerCancel: stopHold,
      onPointerLeave: stopHold,
      onTouchStart: (e) => { e.preventDefault(); startHold(joint, delta, key, flashId); },
      onTouchEnd: (e) => { e.preventDefault(); stopHold(); },
    };
  }

  const fmtKey = (code) => {
    if (!code) return '?';
    const m = { ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Space:'SPC' };
    return m[code] || (code.startsWith('Key') ? code.slice(3) : code);
  };

  const dotColor = disabled ? '#6b7280' : heldKey ? '#22c55e' : '#3b82f6';

  return (
    <div style={S.panel} aria-label="Rover arm controls">

      {/* Header */}
      <div style={S.header}>🦾 ARM CONTROL</div>

      {/* Status */}
      <div style={S.statusRow}>
        <div style={S.statusDot(dotColor)} />
        <span>
          {disabled ? '⚠ Pi offline' : heldKey ? `Moving · ${heldKey.replace('kb-', '')}` : 'ARM READY'}
        </span>
      </div>

      {/* Joint rows */}
      <div style={S.grid}>
        {JOINTS.map((joint) => {
          const negId = `${joint.id}-neg`;
          const posId = `${joint.id}-pos`;
          const negDelta = joint.isBase ? -1 : joint.negDelta;
          const posDelta = joint.isBase ?  1 : joint.posDelta;
          const negHeld = heldKey === negId || heldKey === `kb-${negId}`;
          const posHeld = heldKey === posId || heldKey === `kb-${posId}`;

          return (
            <div key={joint.id} style={S.row}>
              <span style={S.rowLabel(joint.color)}>{joint.label}</span>
              <div style={S.btnPair}>
                {/* Neg button */}
                <button
                  type="button"
                  disabled={disabled}
                  style={S.btn(negHeld, joint.color)}
                  ref={el => { btnElRefs.current[negId] = el; }}
                  tabIndex={-1}
                  aria-pressed={negHeld}
                  {...holdProps(joint, negDelta, negId, negId)}
                >
                  {joint.negLabel}
                  {!mobile && <span style={S.keyBadge}>{fmtKey(bindings[joint.bindNeg])}</span>}
                </button>
                {/* Pos button */}
                <button
                  type="button"
                  disabled={disabled}
                  style={S.btn(posHeld, joint.color)}
                  ref={el => { btnElRefs.current[posId] = el; }}
                  tabIndex={-1}
                  aria-pressed={posHeld}
                  {...holdProps(joint, posDelta, posId, posId)}
                >
                  {joint.posLabel}
                  {!mobile && <span style={S.keyBadge}>{fmtKey(bindings[joint.bindPos])}</span>}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pump toggle */}
      <button
        type="button"
        style={S.pumpBtn(pumpOn)}
        onClick={() => setPumpOn(p => !p)}
        disabled={disabled}
        aria-pressed={pumpOn}
      >
        💧 {pumpOn ? 'PUMP ON' : 'PUMP TOGGLE'}
        {!mobile && <span style={{ ...S.keyBadge, marginLeft: 6 }}>{fmtKey(bindings.pumpToggle)}</span>}
      </button>

      {/* Reset */}
      <button type="button" style={S.resetBtn} onClick={handleReset} disabled={disabled}>
        🏠 Reset All Joints (→ 90°)
      </button>

      {!mobile && (
        <p style={{ fontSize: 10, color: '#334155', marginTop: 6, textAlign: 'center' }}>
          Q/E Base · R/F Shoulder · T/G Elbow · Y/H Wrist · U/J Gripper · P Pump
        </p>
      )}
    </div>
  );
}
