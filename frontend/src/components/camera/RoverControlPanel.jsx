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
import { useState } from 'react';
import DriveControl from './DriveControl';
import ArmControl from './ArmControl';
import { sendModeCommand } from '../../hooks/usePiApi';

const DRIVE_SPEED_MIN     = 10;
const DRIVE_SPEED_MAX     = 100;
const DRIVE_SPEED_DEFAULT = 70;

const ARM_SPEED_MIN     = 1;
const ARM_SPEED_MAX     = 10;
const ARM_SPEED_DEFAULT = 5;

export default function RoverControlPanel({ disabled = false }) {
  const [mode, setMode]             = useState('drive'); // 'drive' | 'arm'
  const [driveSpeed, setDriveSpeed] = useState(DRIVE_SPEED_DEFAULT);
  const [armSpeed, setArmSpeed]     = useState(ARM_SPEED_DEFAULT);
  const [roverMode, setRoverMode]   = useState('REMOTE'); // 'REMOTE' | 'ONLINE'

  const isDrive  = mode === 'drive';
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
      {isDrive
        ? <DriveControl disabled={disabled} driveSpeed={driveSpeed} />
        : <ArmControl   disabled={disabled} armSpeed={armSpeed} />
      }
    </div>
  );
}
