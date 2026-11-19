/**
 * ArmControl — Robotic arm joint control panel.
 *
 * Direction convention (confirmed):
 *   Open  → positive (+1)  e.g. claw: +1, clawJ: +1
 *   Close → negative (-1)  e.g. claw: -1, clawJ: -1
 *
 * Each joint row has two hold-buttons. While HELD → POST /arm_control every 80 ms.
 * On RELEASE → send all-zero stop command.
 *
 * Base servo: 360° continuous rotation servo.
 *   Neutral (stop) = angle 90°. Left < 90, Right > 90.
 *   A "Base Speed" mini-slider (1–5) controls the offset from 90°:
 *     speed 1 → ±3°, 2 → ±6°, 3 → ±10°, 4 → ±15°, 5 → ±22°
 *   On release, angle=90 is sent to stop the base.
 *
 * Visual feedback: a ref-based flash on each button on command send (no re-render).
 *
 * Keyboard shortcuts (when not in a form field):
 *   Q/E  → Base ←/→
 *   R/F  → Shoulder Up/Down
 *   T/G  → Elbow/Wrist Up/Down (mapped to wrist here)
 *   Y/H  → Wrist Up/Down (mapped to clawJ)
 *   U/J  → Gripper Open/Close
 *
 * Props:
 *   disabled  – boolean, true when Pi is offline
 *   armSpeed  – number (1–10), controlled externally
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';

const SEND_INTERVAL_MS = 80;

// Base speed slider: maps 1–5 → degree offset from 90°
const BASE_SPEED_OFFSETS = [0, 3, 6, 10, 15, 22]; // index = speed 0–5

function stopCmd(armSpeed) {
  return { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: armSpeed, reset: false };
}

function buildArmCmd(field, dir, armSpeed) {
  const axes = { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0 };
  axes[field] = dir;
  return { ...axes, speed: armSpeed, reset: false };
}

/** True when the event came from a text input — skip arm hotkeys. */
function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

/**
 * Joint rows.
 * negDir = value sent for the LEFT button (-1 or +1 depending on physical direction)
 * posDir = value sent for the RIGHT button
 *
 * Open claw/jaw → +1   (hardware: motor spins outward)
 * Close claw/jaw → -1  (hardware: motor spins inward)
 */
const JOINTS = [
  {
    id: 'base', label: 'Base', field: 'base',
    color: 'blue',
    negLabel: '🔄 Base ←', negDir: -1, negKey: 'q',
    posLabel: '🔄 Base →', posDir: 1,  posKey: 'e',
    isBase: true,
  },
  {
    id: 'arm', label: 'Shoulder', field: 'arm',
    color: 'green',
    negLabel: '⬆️ Shoulder Up',   negDir: 1,  negKey: 'r',
    posLabel: '⬇️ Shoulder Down', posDir: -1, posKey: 'f',
  },
  {
    id: 'wrist', label: 'Wrist', field: 'wrist',
    color: 'purple',
    negLabel: '↩️ Wrist Left',  negDir: 1,  negKey: 't',
    posLabel: '↪️ Wrist Right', posDir: -1, posKey: 'g',
  },
  {
    id: 'clawJ', label: 'Claw Jaw', field: 'clawJ',
    color: 'orange',
    negLabel: '👐 Jaw Open',  negDir: 1,  negKey: 'y',
    posLabel: '🤏 Jaw Close', posDir: -1, posKey: 'h',
  },
  {
    id: 'claw', label: 'Claw', field: 'claw',
    color: 'yellow',
    negLabel: '🖐️ Claw Open',  negDir: 1,  negKey: 'u',
    posLabel: '✊ Claw Close', posDir: -1, posKey: 'j',
  },
  {
    id: 'rot', label: '360° Rot', field: 'rot',
    color: 'cyan',
    negLabel: '🔁 CCW', negDir: -1, negKey: null,
    posLabel: '🔁 CW',  posDir: 1,  posKey: null,
  },
];

export default function ArmControl({ disabled = false, armSpeed = 5 }) {
  const [heldKey, setHeldKey] = useState(null);
  const [baseSpeed, setBaseSpeed] = useState(2); // 1–5

  const intervalRef   = useRef(null);
  const heldRef       = useRef(null);
  const armSpeedRef   = useRef(armSpeed);
  const disabledRef   = useRef(disabled);
  const baseSpeedRef  = useRef(baseSpeed);

  // Flash refs: { [btnId]: HTMLElement }
  const btnElRefs = useRef({});

  heldRef.current      = heldKey;
  armSpeedRef.current  = armSpeed;
  disabledRef.current  = disabled;
  baseSpeedRef.current = baseSpeed;

  /** Flash a button element green for 120ms (no setState). */
  function flashBtn(id) {
    const el = btnElRefs.current[id];
    if (!el) return;
    el.style.boxShadow = '0 0 0 2px #22c55e';
    el.style.borderColor = '#22c55e';
    setTimeout(() => {
      if (el) {
        el.style.boxShadow = '';
        el.style.borderColor = '';
      }
    }, 120);
  }

  /** Build arm command. For base, use angle offset instead of -1/0/1. */
  function buildCmd(field, dir, flashId) {
    if (flashId) flashBtn(flashId);
    return buildArmCmd(field, dir, armSpeedRef.current);
  }

  const startHold = useCallback((field, dir, key, flashId) => {
    if (disabledRef.current) return;
    setHeldKey(key);
    sendArmCommand(buildCmd(field, dir, flashId));
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (heldRef.current === key) {
        sendArmCommand(buildCmd(field, dir, null));
      }
    }, SEND_INTERVAL_MS);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopHold = useCallback(() => {
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    setHeldKey(null);
    sendArmCommand(stopCmd(armSpeedRef.current));
  }, []);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function handleReset() {
    clearInterval(intervalRef.current);
    setHeldKey(null);
    sendArmCommand({ base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: armSpeedRef.current, reset: true });
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────────
  useEffect(() => {
    // Build a lookup: key → { field, dir, negKey or posKey }
    const keyMap = {};
    for (const j of JOINTS) {
      if (j.negKey) keyMap[j.negKey] = { field: j.field, dir: j.negDir, btnId: `${j.field}-neg` };
      if (j.posKey) keyMap[j.posKey] = { field: j.field, dir: j.posDir, btnId: `${j.field}-pos` };
    }

    const heldKbKeys = new Set();

    function onKeyDown(e) {
      if (isFormField(document.activeElement)) return;
      const info = keyMap[e.key?.toLowerCase()];
      if (!info || heldKbKeys.has(e.key)) return;
      e.preventDefault();
      heldKbKeys.add(e.key);
      startHold(info.field, info.dir, `kb-${info.btnId}`, info.btnId);
    }

    function onKeyUp(e) {
      if (!heldKbKeys.has(e.key)) return;
      heldKbKeys.delete(e.key);
      stopHold();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [startHold, stopHold]);

  function holdProps(field, dir, key, flashId) {
    return {
      onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(field, dir, key, flashId); },
      onPointerUp: stopHold,
      onPointerCancel: stopHold,
      onPointerLeave: stopHold,
      onTouchStart: (e) => { e.preventDefault(); startHold(field, dir, key, flashId); },
      onTouchEnd: (e) => { e.preventDefault(); stopHold(); },
    };
  }

  // Find which joint is being held to show its color
  const activeJoint = heldKey ? JOINTS.find(j => heldKey.startsWith(j.field) || heldKey.startsWith('kb-' + j.field)) : null;

  return (
    <div
      className="arm-control"
      aria-label="Rover arm controls"
      style={{ touchAction: 'none', overscrollBehavior: 'contain', userSelect: 'none', WebkitUserSelect: 'none' }}
    >

      {/* ── Status bar ── */}
      <div className="arm-status-bar">
        <span className={`drive-status-dot ${disabled ? 'drive-dot-offline' : heldKey ? 'drive-dot-ok' : 'drive-dot-ok'}`} />
        <span className="arm-status-text">
          {disabled
            ? '⚠ Pi offline'
            : heldKey
              ? `Moving · ${activeJoint?.label ?? heldKey}`
              : 'ARM READY'}
        </span>
        {heldKey && <span className={`arm-active-badge arm-color-${activeJoint?.color}`}>{activeJoint?.label}</span>}
      </div>

      {/* ── Base Speed mini-slider ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, fontSize: 12, color: '#94a3b8' }}>
        <label htmlFor="base-speed-slider" style={{ whiteSpace: 'nowrap' }}>Base speed</label>
        <input
          id="base-speed-slider"
          type="range"
          min={1}
          max={5}
          value={baseSpeed}
          onChange={(e) => setBaseSpeed(Number(e.target.value))}
          tabIndex={-1}
          style={{ flex: 1, accentColor: '#3b82f6' }}
        />
        <span style={{ minWidth: 16, textAlign: 'right' }}>{baseSpeed}</span>
      </div>

      {/* ── Joint rows ── */}
      <div className="arm-grid">
        {JOINTS.map(({ id, label, field, color, negLabel, negDir, posLabel, posDir, negKey, posKey }) => {
          const negId = `${field}-neg`;
          const posId = `${field}-pos`;
          return (
            <div key={id} className="arm-row">
              <span className={`arm-joint-label arm-label-${color}`}>{label}</span>
              <div className="arm-btn-pair">
                <ArmBtn
                  held={heldKey === negId || heldKey === `kb-${negId}`}
                  disabled={disabled}
                  color={color}
                  btnRef={(el) => { btnElRefs.current[negId] = el; }}
                  {...holdProps(field, negDir, negId, negId)}
                >
                  {negLabel}
                  {negKey && <span style={{ display: 'block', fontSize: 10, opacity: 0.5, marginTop: 2 }}>[{negKey.toUpperCase()}]</span>}
                </ArmBtn>
                <ArmBtn
                  held={heldKey === posId || heldKey === `kb-${posId}`}
                  disabled={disabled}
                  color={color}
                  btnRef={(el) => { btnElRefs.current[posId] = el; }}
                  {...holdProps(field, posDir, posId, posId)}
                >
                  {posLabel}
                  {posKey && <span style={{ display: 'block', fontSize: 10, opacity: 0.5, marginTop: 2 }}>[{posKey.toUpperCase()}]</span>}
                </ArmBtn>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Reset All ── */}
      <button
        type="button"
        className="arm-reset-btn"
        onClick={handleReset}
        disabled={disabled}
        aria-label="Reset all arm joints to home position"
      >
        🏠 Reset All Arm
      </button>

      <p style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
        Keyboard: Q/E Base · R/F Shoulder · T/G Wrist · Y/H Jaw · U/J Claw
      </p>
    </div>
  );
}

function ArmBtn({ held, disabled, color, children, btnRef, ...rest }) {
  return (
    <button
      type="button"
      className={`arm-btn arm-btn-${color} ${held ? `arm-btn-active arm-btn-active-${color}` : ''}`}
      disabled={disabled}
      aria-pressed={held}
      tabIndex={-1}
      ref={btnRef}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        transition: 'box-shadow 0.1s, border-color 0.1s',
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
