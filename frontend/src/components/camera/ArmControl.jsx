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
 * Props:
 *   disabled  – boolean, true when Pi is offline
 *   armSpeed  – number (1–10), controlled externally
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';

const SEND_INTERVAL_MS = 80;

function stopCmd(armSpeed) {
  return { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: armSpeed, reset: false };
}

function buildArmCmd(field, dir, armSpeed) {
  const axes = { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0 };
  axes[field] = dir;
  return { ...axes, speed: armSpeed, reset: false };
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
    negLabel: '🔄 Base ←', negDir: -1,
    posLabel: '🔄 Base →', posDir: 1,
  },
  {
    id: 'arm', label: 'Shoulder', field: 'arm',
    color: 'green',
    negLabel: '⬆️ Shoulder Up', negDir: 1,
    posLabel: '⬇️ Shoulder Down', posDir: -1,
  },
  {
    id: 'wrist', label: 'Wrist', field: 'wrist',
    color: 'purple',
    negLabel: '↩️ Wrist Left', negDir: 1,
    posLabel: '↪️ Wrist Right', posDir: -1,
  },
  {
    id: 'clawJ', label: 'Claw Jaw', field: 'clawJ',
    color: 'orange',
    negLabel: '👐 Jaw Open', negDir: 1,
    posLabel: '🤏 Jaw Close', posDir: -1,
  },
  {
    id: 'claw', label: 'Claw', field: 'claw',
    color: 'yellow',
    negLabel: '🖐️ Claw Open', negDir: 1,
    posLabel: '✊ Claw Close', posDir: -1,
  },
  {
    id: 'rot', label: '360° Rot', field: 'rot',
    color: 'cyan',
    negLabel: '🔁 CCW', negDir: -1,
    posLabel: '🔁 CW', posDir: 1,
  },
];

export default function ArmControl({ disabled = false, armSpeed = 5 }) {
  const [heldKey, setHeldKey] = useState(null);
  const intervalRef  = useRef(null);
  const heldRef      = useRef(null);
  const armSpeedRef  = useRef(armSpeed);
  const disabledRef  = useRef(disabled);

  heldRef.current     = heldKey;
  armSpeedRef.current = armSpeed;
  disabledRef.current = disabled;

  const startHold = useCallback((field, dir, key) => {
    if (disabledRef.current) return;
    setHeldKey(key);
    sendArmCommand(buildArmCmd(field, dir, armSpeedRef.current));
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (heldRef.current === key) {
        sendArmCommand(buildArmCmd(field, dir, armSpeedRef.current));
      }
    }, SEND_INTERVAL_MS);
  }, []);

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

  function holdProps(field, dir, key) {
    return {
      onPointerDown: (e) => { e.currentTarget.setPointerCapture(e.pointerId); startHold(field, dir, key); },
      onPointerUp: stopHold,
      onPointerCancel: stopHold,
      onTouchStart: (e) => { e.preventDefault(); startHold(field, dir, key); },
      onTouchEnd: (e) => { e.preventDefault(); stopHold(); },
    };
  }

  // Find which joint is being held to show its color
  const activeJoint = heldKey ? JOINTS.find(j => heldKey.startsWith(j.field)) : null;

  return (
    <div className="arm-control" aria-label="Rover arm controls">

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

      {/* ── Joint rows ── */}
      <div className="arm-grid">
        {JOINTS.map(({ id, label, field, color, negLabel, negDir, posLabel, posDir }) => {
          const negKey = `${field}-neg`;
          const posKey = `${field}-pos`;
          return (
            <div key={id} className="arm-row">
              <span className={`arm-joint-label arm-label-${color}`}>{label}</span>
              <div className="arm-btn-pair">
                <ArmBtn
                  held={heldKey === negKey}
                  disabled={disabled}
                  color={color}
                  {...holdProps(field, negDir, negKey)}
                >
                  {negLabel}
                </ArmBtn>
                <ArmBtn
                  held={heldKey === posKey}
                  disabled={disabled}
                  color={color}
                  {...holdProps(field, posDir, posKey)}
                >
                  {posLabel}
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
    </div>
  );
}

function ArmBtn({ held, disabled, color, children, ...rest }) {
  return (
    <button
      type="button"
      className={`arm-btn arm-btn-${color} ${held ? `arm-btn-active arm-btn-active-${color}` : ''}`}
      disabled={disabled}
      aria-pressed={held}
      {...rest}
    >
      {children}
    </button>
  );
}
