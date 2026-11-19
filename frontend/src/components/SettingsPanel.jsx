/**
 * SettingsPanel — Side drawer for PC keyboard remapping and About info.
 *
 * Toggle: ⚙️ gear icon button, renders a 320px right-side drawer.
 * Tab "PC Keys": shows all rover actions + their current key, click to remap.
 * Tab "About":   static project info.
 * Hidden on mobile (< 768px screen) — PC-only keyboard remapping.
 */
import { useState, useEffect, useRef } from 'react';
import { useKeybindings, ACTION_LABELS, DEFAULT_BINDINGS, formatKey } from '../hooks/useKeybindings';

const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Ordered list of actions to show in the table (excludes Alt bindings)
const REMAP_ACTIONS = [
  'driveForward', 'driveBack', 'driveLeft', 'driveRight', 'eStop',
  'baseCW', 'baseCCW',
  'shoulderUp', 'shoulderDown',
  'elbowUp', 'elbowDown',
  'wristUp', 'wristDown',
  'gripperOpen', 'gripperClose',
  'pumpToggle',
];

const S = {
  gearBtn: (open) => ({
    position: 'fixed',
    top: 14,
    right: 14,
    zIndex: 300,
    width: 38,
    height: 38,
    borderRadius: '50%',
    border: `2px solid ${open ? '#e94560' : '#0f3460'}`,
    background: open ? '#1a1a2e' : '#16213e',
    color: open ? '#e94560' : '#94a3b8',
    fontSize: 18,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: open ? '0 0 12px #e94560' : '0 2px 8px rgba(0,0,0,0.5)',
    transition: 'box-shadow 150ms, border-color 150ms',
    userSelect: 'none',
  }),
  drawer: (open) => ({
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    width: 320,
    background: '#1a1a2e',
    borderLeft: '1px solid #16213e',
    zIndex: 200,
    transform: open ? 'translateX(0)' : 'translateX(100%)',
    transition: 'transform 220ms cubic-bezier(0.4,0,0.2,1)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-4px 0 24px rgba(0,0,0,0.6)',
    overflowY: 'auto',
  }),
  drawerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 16px 8px',
    borderBottom: '1px solid #16213e',
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.1em',
    color: '#e94560',
    textTransform: 'uppercase',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    fontSize: 20,
    cursor: 'pointer',
    padding: 4,
  },
  tabs: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid #16213e',
  },
  tab: (active) => ({
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #e94560' : '2px solid transparent',
    color: active ? '#e94560' : '#64748b',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    transition: 'color 150ms, border-color 150ms',
  }),
  content: {
    padding: 12,
    flex: 1,
  },
  row: (listening) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    borderRadius: 8,
    marginBottom: 4,
    background: listening ? '#16213e' : 'transparent',
    border: listening ? '1px solid #e94560' : '1px solid transparent',
    transition: 'background 150ms',
  }),
  actionLabel: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
  },
  keyBadge: (listening) => ({
    minWidth: 36,
    padding: '2px 6px',
    borderRadius: 6,
    background: listening ? '#e94560' : '#0f3460',
    color: listening ? '#fff' : '#93c5fd',
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    fontWeight: 700,
    letterSpacing: '0.05em',
  }),
  remapBtn: {
    fontSize: 10,
    color: '#475569',
    background: 'none',
    border: '1px solid #334155',
    borderRadius: 5,
    padding: '2px 6px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  resetAllBtn: {
    width: '100%',
    marginTop: 10,
    padding: '8px 0',
    borderRadius: 10,
    border: '1px solid #334155',
    background: 'transparent',
    color: '#475569',
    fontSize: 11,
    cursor: 'pointer',
  },
  about: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 1.7,
  },
};

export default function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('keys');
  const [listeningFor, setListeningFor] = useState(null); // action string
  const { bindings, setBinding } = useKeybindings();
  const drawerRef = useRef(null);

  // Key capture while listening
  useEffect(() => {
    if (!listeningFor) return;
    function onKeyDown(e) {
      e.preventDefault();
      if (e.code === 'Escape') { setListeningFor(null); return; }
      setBinding(listeningFor, e.code);
      setListeningFor(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [listeningFor, setBinding]);

  // Close drawer on click outside
  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function resetAll() {
    Object.entries(DEFAULT_BINDINGS).forEach(([action, code]) => setBinding(action, code));
  }

  return (
    <>
      {/* Gear button */}
      <button
        type="button"
        style={S.gearBtn(open)}
        onClick={() => setOpen(o => !o)}
        aria-label="Open settings"
        title="Settings"
      >
        ⚙
      </button>

      {/* Drawer */}
      <div ref={drawerRef} style={S.drawer(open)} aria-modal={open} role="dialog" aria-label="Settings">
        <div style={S.drawerHeader}>
          <span style={S.title}>⚙ Settings</span>
          <button type="button" style={S.closeBtn} onClick={() => setOpen(false)} aria-label="Close">✕</button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          <button type="button" style={S.tab(tab === 'keys')}  onClick={() => setTab('keys')}>PC Keys</button>
          <button type="button" style={S.tab(tab === 'about')} onClick={() => setTab('about')}>About</button>
        </div>

        <div style={S.content}>
          {tab === 'keys' && (
            isMobile ? (
              <p style={S.about}>
                Keyboard remapping is for PC only.<br />
                Use the on-screen buttons on mobile.
              </p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: '#475569', marginBottom: 10 }}>
                  Click <strong style={{ color: '#64748b' }}>Remap</strong> then press any key to rebind.
                  Press Esc to cancel.
                </p>
                {REMAP_ACTIONS.map(action => {
                  const isListening = listeningFor === action;
                  return (
                    <div key={action} style={S.row(isListening)}>
                      <span style={S.actionLabel}>{ACTION_LABELS[action] ?? action}</span>
                      <span style={S.keyBadge(isListening)}>
                        {isListening ? 'Press…' : formatKey(bindings[action])}
                      </span>
                      <button
                        type="button"
                        style={S.remapBtn}
                        onClick={() => setListeningFor(isListening ? null : action)}
                      >
                        {isListening ? 'Cancel' : 'Remap'}
                      </button>
                    </div>
                  );
                })}
                <button type="button" style={S.resetAllBtn} onClick={resetAll}>
                  Reset to defaults
                </button>
              </>
            )
          )}

          {tab === 'about' && (
            <div style={S.about}>
              <p><strong style={{ color: '#e94560' }}>TRINETRA Rover Dashboard</strong></p>
              <p>v2.0 — Wi-Fi Controlled Fire-Fighting Rover</p>
              <br />
              <p>Pi link via Tailscale · React + Vite frontend</p>
              <p>Commands → <code style={{ color: '#60a5fa', fontSize: 11 }}>vsit.tail13799b.ts.net</code></p>
              <br />
              <p>Drive: WASD / Arrow keys</p>
              <p>Arm: Q/E/R/F/T/G/Y/H/U/J</p>
              <p>All bindings remappable in PC Keys tab.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
