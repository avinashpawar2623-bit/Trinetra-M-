/**
 * ArmControl — Pi API /arm_control contract.
 *
 * Joint deltas are -1 / 0 / +1. Both pitch joints rest at their high stop
 * (shoulder at ARM_MAX 140, hanging down). UP sends -1 so the position steps
 * off that stop. DOWN sends +1 and does nothing until the joint has been lifted.
 *
 *   arm  — shoulder 1
 *   base — shoulder 2 (second pitch joint, Pi channel 0)
 *
 * Hold uses pointer capture. Leaving the button bounds does not release,
 * so a small finger slip cannot abort the move before the Pi receives it.
 */
import { useEffect, useRef, useState } from 'react';
import { sendArmCommand } from '../../hooks/usePiApi';
import { useKeybindings } from '../../hooks/useKeybindings';
import { noteControlActivity, releaseToRemote, subscribeDashboardMode } from '../../lib/dashboardMode';

const REPEAT_MS = 160;

const ZERO = { base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: 5, reset: false };

function makeCmd(overrides) {
  return { ...ZERO, ...overrides };
}

function sendArm(payload) {
  sendArmCommand(payload);
}

function isFormField(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const ROWS = [
  {
    label: 'ROTATE',
    hint: 'Base spin',
    isRotate: true,
    neg: { icon: '↺', label: 'CCW', bindKey: 'baseCCW', payload: makeCmd({ rot: -1 }) },
    pos: { icon: '↻', label: 'CW', bindKey: 'baseCW', payload: makeCmd({ rot: +1 }) },
  },
  {
    label: 'SHOULDER',
    hint: 'Rests fully down — hold UP to lift',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'shoulderDown', payload: makeCmd({ arm: +1 }) },
    pos: { icon: '▲', label: 'UP', bindKey: 'shoulderUp', payload: makeCmd({ arm: -1 }) },
  },
  {
    label: 'SHOULDER 2',
    hint: 'Second shoulder — hold UP to lift',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'elbowDown', payload: makeCmd({ base: +1 }) },
    pos: { icon: '▲', label: 'UP', bindKey: 'elbowUp', payload: makeCmd({ base: -1 }) },
  },
  {
    label: 'WRIST',
    hint: '',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'wristDown', payload: makeCmd({ wrist: -1 }) },
    pos: { icon: '▲', label: 'UP', bindKey: 'wristUp', payload: makeCmd({ wrist: +1 }) },
  },
  {
    label: 'CLAW JT',
    hint: '',
    neg: { icon: '▼', label: 'DOWN', bindKey: 'gripperClose', payload: makeCmd({ clawJ: -1 }) },
    pos: { icon: '▲', label: 'UP', bindKey: 'gripperOpen', payload: makeCmd({ clawJ: +1 }) },
  },
  {
    label: 'GRIPPER',
    hint: '',
    neg: { icon: '○', label: 'OPEN', bindKey: 'gripperOpen2', payload: makeCmd({ claw: -1 }) },
    pos: { icon: '●', label: 'CLOSE', bindKey: 'gripperClose2', payload: makeCmd({ claw: +1 }) },
  },
];

function ArmBtn({ label, icon, keyHint, held, disabled, onPress, onRelease }) {
  const ref = useRef(null);

  function pointerDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    onPress?.();
  }

  function pointerUp(e) {
    if (ref.current?.hasPointerCapture?.(e.pointerId)) {
      ref.current.releasePointerCapture(e.pointerId);
    }
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
      onPointerCancel={pointerUp}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        flex: 1,
        minHeight: 48,
        background: held
          ? 'linear-gradient(145deg, #3b1d8a 0%, #2d1570 100%)'
          : 'linear-gradient(145deg, #1a1a2e 0%, #12122a 100%)',
        border: held ? '1px solid #7c3aed' : '1px solid #2a2a4a',
        borderRadius: 10,
        color: held ? '#c4b5fd' : '#e2e8f0',
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        padding: '6px 4px',
        boxShadow: held ? '0 0 14px rgba(109,40,217,0.6)' : '0 2px 6px rgba(0,0,0,0.3)',
      }}
    >
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span>{label}{keyHint ? ` ${keyHint}` : ''}</span>
    </button>
  );
}

export default function ArmControl({ disabled = false, armSpeed = 5 }) {
  const { bindings } = useKeybindings();
  const [heldIds, setHeldIds] = useState(() => new Set());
  const [rotSpeed, setRotSpeed] = useState(2);
  const [onlineOk, setOnlineOk] = useState(false);

  const intervalRef = useRef(null);
  const heldPayRef = useRef(null);
  const activeRef = useRef(new Map());
  const disabledRef = useRef(disabled);
  const armSpeedRef = useRef(armSpeed);
  const rotSpeedRef = useRef(2);
  const bindingsRef = useRef(bindings);

  disabledRef.current = disabled;
  armSpeedRef.current = armSpeed;
  bindingsRef.current = bindings;

  useEffect(() => subscribeDashboardMode(setOnlineOk), []);
  useEffect(() => () => clearInterval(intervalRef.current), []);

  function mergedPayload() {
    const merged = { ...ZERO, speed: armSpeedRef.current };
    let rotateSpeed = null;
    for (const payload of activeRef.current.values()) {
      for (const key of ['base', 'arm', 'wrist', 'clawJ', 'claw', 'rot']) {
        if (payload[key]) merged[key] = payload[key];
      }
      if (payload.rot) rotateSpeed = payload.speed;
    }
    if (rotateSpeed != null && merged.base === 0 && merged.arm === 0 && merged.wrist === 0 && merged.clawJ === 0 && merged.claw === 0) {
      merged.speed = rotateSpeed;
    }
    return merged;
  }

  function publish() {
    const ids = new Set(activeRef.current.keys());
    setHeldIds(ids);
    if (ids.size === 0) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
      heldPayRef.current = null;
      sendArm({ ...ZERO, speed: armSpeedRef.current });
      return;
    }
    const payload = mergedPayload();
    heldPayRef.current = payload;
    noteControlActivity();
    sendArm(payload);
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        if (!heldPayRef.current) return;
        noteControlActivity();
        sendArm(heldPayRef.current);
      }, REPEAT_MS);
    }
  }

  function startHold(id, basePayload, isRotate) {
    if (disabledRef.current) return;
    const speed = isRotate ? rotSpeedRef.current : armSpeedRef.current;
    activeRef.current.set(id, { ...basePayload, speed });
    publish();
  }

  function stopHold(id) {
    if (id) activeRef.current.delete(id);
    else activeRef.current.clear();
    publish();
  }

  function handleReset() {
    activeRef.current.clear();
    clearInterval(intervalRef.current);
    intervalRef.current = null;
    heldPayRef.current = null;
    setHeldIds(new Set());
    noteControlActivity();
    sendArm({ ...ZERO, speed: armSpeedRef.current, reset: true });
  }

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
      const info = buildMap(bindingsRef.current)[e.code];
      if (!info || heldKeys.has(e.code)) return;
      e.preventDefault();
      heldKeys.add(e.code);
      startHold(info.id, info.payload, info.isRotate);
    }

    function onKeyUp(e) {
      if (!heldKeys.has(e.code)) return;
      heldKeys.delete(e.code);
      const info = buildMap(bindingsRef.current)[e.code];
      if (info) stopHold(info.id);
    }

    function onBlur() {
      heldKeys.clear();
      stopHold();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      heldKeys.clear();
    };
  }, []);

  function fmtKey(code) {
    if (!code) return '';
    const m = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Space: 'SPC' };
    return m[code] || (code.startsWith('Key') ? code.slice(3) : code);
  }

  const moving = heldIds.size > 0;

  return (
    <div className="arm-dock" style={{ userSelect: 'none', touchAction: 'none' }} aria-label="Rover arm controls">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: onlineOk ? '#16a34a' : '#64748b',
          boxShadow: onlineOk ? '0 0 8px #16a34a' : 'none',
        }} />
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: '#e2e8f0' }}>
          ARM
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontFamily: 'monospace', color: moving ? '#c4b5fd' : '#64748b' }}>
          {disabled ? 'PAUSED' : moving ? 'MOVING' : 'HOLD A JOINT'}
        </span>
        <button
          type="button"
          tabIndex={-1}
          title="Give control back to the physical remote"
          onClick={() => {
            stopHold();
            releaseToRemote().catch(() => {});
          }}
          style={{
            padding: '4px 8px',
            background: '#7f1d1d',
            color: '#fecaca',
            border: '1px solid #b91c1c',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          Release
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ROWS.map((row, ri) => (
          <div key={row.label}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.08em', color: ri === 1 || ri === 2 ? '#6ee7b7' : '#94a3b8' }}>
                {row.label}
              </span>
              {row.hint && (
                <span style={{ fontSize: 9, color: '#64748b' }}>{row.hint}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <ArmBtn
                icon={row.neg.icon}
                label={row.neg.label}
                keyHint={fmtKey(bindings[row.neg.bindKey])}
                held={heldIds.has(`${ri}-0`)}
                disabled={disabled}
                onPress={() => startHold(`${ri}-0`, row.neg.payload, !!row.isRotate)}
                onRelease={() => stopHold(`${ri}-0`)}
              />
              <ArmBtn
                icon={row.pos.icon}
                label={row.pos.label}
                keyHint={fmtKey(bindings[row.pos.bindKey])}
                held={heldIds.has(`${ri}-1`)}
                disabled={disabled}
                onPress={() => startHold(`${ri}-1`, row.pos.payload, !!row.isRotate)}
                onRelease={() => stopHold(`${ri}-1`)}
              />
            </div>
            {ri === 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, fontSize: 10, color: '#94a3b8' }}>
                SPIN
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
                  style={{ flex: 1, accentColor: '#6d28d9' }}
                />
                <span style={{ fontFamily: 'monospace', color: '#c4b5fd', width: 12 }}>{rotSpeed}</span>
              </label>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        tabIndex={-1}
        onClick={handleReset}
        disabled={disabled}
        style={{
          width: '100%',
          marginTop: 8,
          padding: '8px 0',
          borderRadius: 10,
          border: '1px solid #2a2a4a',
          background: '#12122a',
          color: '#94a3b8',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Reset arm to rest
      </button>
    </div>
  );
}
