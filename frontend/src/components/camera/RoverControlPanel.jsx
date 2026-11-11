/**
 * RoverControlPanel — Unified rover control UI.
 *
 * Contains:
 *  • ONLINE / REMOTE mode toggle pill (top)
 *  • DRIVE MODE / ARM MODE stylish toggle switch
 *  • Context-sensitive speed slider ("Speed: X%" or "Arm Speed: X/10")
 *  • DriveControl (shown when DRIVE mode)
 *  • ArmControl   (shown when ARM mode)
 *
 * Props:
 *   disabled – boolean, forwarded to both child controls
 */
import { useEffect, useRef, useState } from 'react';
import DriveControl from './DriveControl';
import ArmControl from './ArmControl';
import { sendArmCommand, sendDriveCommand, sendModeCommand, usePiApi } from '../../hooks/usePiApi';
import { setCommandTimeoutMs } from '../../lib/controlClient';
import { useControlStats } from '../../hooks/useControlStats';

const DRIVE_SPEED_MIN     = 10;
const DRIVE_SPEED_MAX     = 100;
const DRIVE_SPEED_DEFAULT = 70;

const ARM_SPEED_MIN     = 1;
const ARM_SPEED_MAX     = 10;
const ARM_SPEED_DEFAULT = 5;

export default function RoverControlPanel({ disabled = false }) {
  const { link } = usePiApi();
  const stats = useControlStats();
  const [mode, setMode]             = useState('drive'); // 'drive' | 'arm'
  const [driveSpeed, setDriveSpeed] = useState(DRIVE_SPEED_DEFAULT);
  const [armSpeed, setArmSpeed]     = useState(ARM_SPEED_DEFAULT);
  const [roverMode, setRoverMode]   = useState('REMOTE'); // 'REMOTE' | 'ONLINE'
  const [timeoutMs, setTimeoutMs]   = useState(stats.timeoutMs || 350);
  const wasLive = useRef(false);

  useEffect(() => {
    if (link === 'live') {
      wasLive.current = true;
      return;
    }
    if (!wasLive.current) return;
    wasLive.current = false;
    // Zero the existing command. The ESP32's documented 600 ms watchdog
    // remains the safety path when this request cannot be delivered.
    sendDriveCommand({ speed: 0, steer: 0, estop: false, priority: true });
    sendArmCommand({ base: 0, arm: 0, wrist: 0, clawJ: 0, claw: 0, rot: 0, speed: 0, reset: false });
  }, [link]);

  const isDrive  = mode === 'drive';
  const motionDisabled = disabled || link !== 'live';
  const isOnline = roverMode === 'ONLINE';

  const toggleRoverMode = async () => {
    const newMode = isOnline ? 'REMOTE' : 'ONLINE';
    setRoverMode(newMode);
    await sendModeCommand(newMode);
  };

  return (
    <div className="rover-control-panel">

      {/* ── Rover Mode Toggle (ONLINE / REMOTE) ──────────────────────────── */}
      <button
        id="rover-mode-toggle"
        type="button"
        className={`rover-mode-btn ${isOnline ? 'rover-mode-online' : 'rover-mode-remote'}`}
        onClick={toggleRoverMode}
        aria-pressed={isOnline}
        aria-label={`Rover mode: ${roverMode}. Click to toggle.`}
      >
        {isOnline
          ? '🟢 ONLINE / DASHBOARD MODE  |  Click to go Remote →'
          : '🎮 REMOTE CONTROL MODE  |  Click to go Online →'}
      </button>

      {/* ── Mode Toggle — pill tabs ──────────────────────────────────────── */}
      <div className="mode-toggle-wrap" role="group" aria-label="Drive or Arm mode">
        <span
          id="mode-drive-tab"
          role="button"
          tabIndex={0}
          className={`mode-tab-label ${isDrive ? 'mode-tab-active' : 'mode-tab-dim'}`}
          onClick={() => setMode('drive')}
          onKeyDown={(e) => e.key === 'Enter' && setMode('drive')}
          aria-pressed={isDrive}
        >
          🚗 Drive Mode
        </span>
        <span
          id="mode-arm-tab"
          role="button"
          tabIndex={0}
          className={`mode-tab-label ${!isDrive ? 'mode-tab-active' : 'mode-tab-dim'}`}
          onClick={() => setMode('arm')}
          onKeyDown={(e) => e.key === 'Enter' && setMode('arm')}
          aria-pressed={!isDrive}
        >
          🦾 Arm Mode
        </span>
      </div>

      {/* ── Mode indicator strip ─────────────────────────────────────────── */}
      <div className={`mode-indicator ${isDrive ? 'mode-indicator-drive' : 'mode-indicator-arm'}`}>
        <span className="mode-indicator-dot" />
        <span className="mode-indicator-text">
          {isDrive ? 'DRIVE MODE ACTIVE' : 'ARM MODE ACTIVE'}
        </span>
      </div>

      {/* ── Speed slider ─────────────────────────────────────────────────── */}
      {isDrive ? (
        <div className="speed-slider-row">
          <label htmlFor="drive-speed-slider" className="speed-label">Drive Speed</label>
          <input
            id="drive-speed-slider"
            type="range"
            min={DRIVE_SPEED_MIN}
            max={DRIVE_SPEED_MAX}
            value={driveSpeed}
            onChange={(e) => setDriveSpeed(Number(e.target.value))}
            className="speed-slider"
            aria-valuenow={driveSpeed}
            aria-valuemin={DRIVE_SPEED_MIN}
            aria-valuemax={DRIVE_SPEED_MAX}
          />
          <span className="speed-value">{driveSpeed}%</span>
        </div>
      ) : (
        <div className="speed-slider-row speed-slider-row-arm">
          <label htmlFor="arm-speed-slider" className="speed-label">Arm Speed</label>
          <input
            id="arm-speed-slider"
            type="range"
            min={ARM_SPEED_MIN}
            max={ARM_SPEED_MAX}
            value={armSpeed}
            onChange={(e) => setArmSpeed(Number(e.target.value))}
            className="speed-slider speed-slider-arm"
            aria-valuenow={armSpeed}
            aria-valuemin={ARM_SPEED_MIN}
            aria-valuemax={ARM_SPEED_MAX}
          />
          <span className="speed-value speed-value-arm">{armSpeed}/{ARM_SPEED_MAX}</span>
        </div>
      )}

      {/* ── Control panels ───────────────────────────────────────────────── */}
      <div className="speed-slider-row">
        <label htmlFor="command-timeout" className="speed-label">Timeout</label>
        <input
          id="command-timeout"
          type="number"
          min={100}
          max={2000}
          step={50}
          value={timeoutMs}
          onChange={(event) => {
            const next = Number(event.target.value);
            setTimeoutMs(next);
            setCommandTimeoutMs(next);
          }}
          className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100"
        />
        <span className="speed-value">ms</span>
      </div>
      <p className="text-[11px] text-slate-500">
        Link {link}. Gateway {stats.lastRttMs === null ? '—' : `${stats.lastRttMs} ms`} · rover ack {stats.upstreamRttMs === null ? '—' : `${stats.upstreamRttMs} ms`}.
        {link !== 'live' ? ' Motion is held. A zero command is sent when a live link drops; the rover watchdog covers a dead link.' : ''}
      </p>

      {isDrive
        ? <DriveControl disabled={motionDisabled} driveSpeed={driveSpeed} link={link} />
        : <ArmControl   disabled={motionDisabled} armSpeed={armSpeed} />
      }
    </div>
  );
}
