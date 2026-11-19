/**
 * useKeybindings — Persistent keyboard binding store.
 *
 * Loads from localStorage on mount, falls back to defaults.
 * DriveControl and ArmControl import this to get their key mappings.
 * SettingsPanel reads/writes through this same hook.
 */
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'trinetra_keybindings';

export const DEFAULT_BINDINGS = {
  driveForward:   'ArrowUp',
  driveBack:      'ArrowDown',
  driveLeft:      'ArrowLeft',
  driveRight:     'ArrowRight',
  driveForwardAlt:'KeyW',
  driveBackAlt:   'KeyS',
  driveLeftAlt:   'KeyA',
  driveRightAlt:  'KeyD',
  eStop:          'Space',
  baseCW:         'KeyQ',
  baseCCW:        'KeyE',
  shoulderUp:     'KeyR',
  shoulderDown:   'KeyF',
  elbowUp:        'KeyT',
  elbowDown:      'KeyG',
  wristUp:        'KeyY',
  wristDown:      'KeyH',
  gripperOpen:    'KeyU',
  gripperClose:   'KeyJ',
  pumpToggle:     'KeyP',
};

export const ACTION_LABELS = {
  driveForward:   'Drive Forward',
  driveBack:      'Drive Back',
  driveLeft:      'Drive Left',
  driveRight:     'Drive Right',
  eStop:          'E-Stop',
  baseCW:         'Base CW ↻',
  baseCCW:        'Base CCW ↺',
  shoulderUp:     'Shoulder Up',
  shoulderDown:   'Shoulder Down',
  elbowUp:        'Elbow Up',
  elbowDown:      'Elbow Down',
  wristUp:        'Wrist Up',
  wristDown:      'Wrist Down',
  gripperOpen:    'Gripper Open',
  gripperClose:   'Gripper Close',
  pumpToggle:     'Pump Toggle',
};

function loadBindings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_BINDINGS };
    return { ...DEFAULT_BINDINGS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

function saveBindings(b) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(b)); } catch {}
}

/** Format a code string like "ArrowUp" → "↑", "KeyW" → "W" for display. */
export function formatKey(code) {
  if (!code) return '?';
  const map = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Space: 'SPC', Escape: 'ESC', Enter: 'ENT', Tab: 'TAB',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return code;
}

// Singleton so all consumers share one binding state
let _bindings = loadBindings();
const _listeners = new Set();

function _publish(next) {
  _bindings = next;
  saveBindings(next);
  _listeners.forEach(fn => fn(next));
}

export function setBinding(action, code) {
  _publish({ ..._bindings, [action]: code });
}

export function getBindings() { return _bindings; }

export function useKeybindings() {
  const [bindings, setLocal] = useState(_bindings);

  const setBindingCb = useCallback((action, code) => {
    const next = { ..._bindings, [action]: code };
    _publish(next);
  }, []);

  useEffect(() => {
    _listeners.add(setLocal);
    setLocal(_bindings);
    return () => { _listeners.delete(setLocal); };
  }, []);

  return { bindings, setBinding: setBindingCb };
}
