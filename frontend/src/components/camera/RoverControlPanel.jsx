/**
 * Drive and arm together, next to the camera.
 * Motion is not tied to the sensor websocket — a stale telemetry link
 * must not freeze the sticks while HTTP to the Pi still works.
 */
import { useEffect, useState } from 'react';
import DriveControl from './DriveControl';
import ArmControl from './ArmControl';
import { usePiApi } from '../../hooks/usePiApi';
import { useControlStats } from '../../hooks/useControlStats';
import { engageDashboard, releaseToRemote, startModeKeepalive, subscribeDashboardMode } from '../../lib/dashboardMode';

const DRIVE_SPEED_MIN = 10;
const DRIVE_SPEED_MAX = 100;
const DRIVE_SPEED_DEFAULT = 70;
const ARM_SPEED_MIN = 1;
const ARM_SPEED_MAX = 10;
const ARM_SPEED_DEFAULT = 5;

export default function RoverControlPanel({ disabled = false }) {
  const { link } = usePiApi();
  const stats = useControlStats();
  const [driveSpeed, setDriveSpeed] = useState(DRIVE_SPEED_DEFAULT);
  const [armSpeed, setArmSpeed] = useState(ARM_SPEED_DEFAULT);
  const [online, setOnline] = useState(false);

  useEffect(() => startModeKeepalive(), []);
  useEffect(() => subscribeDashboardMode(setOnline), []);

  return (
    <div className="cockpit-controls">
      <div className="cockpit-controls-bar">
        <div>
          <div className="cockpit-kicker">Operate</div>
          <div className="cockpit-title">Camera stays in view. Hold a control to drive or move the arm.</div>
        </div>
        <button
          type="button"
          className={`cockpit-lock ${online ? 'cockpit-lock-on' : ''}`}
          onClick={() => {
            if (online) releaseToRemote().catch(() => {});
            else engageDashboard().catch(() => {});
          }}
        >
          {online ? 'Release handset' : 'Take control'}
        </button>
      </div>

      <p className="cockpit-meta">
        Link {link}
        {stats.lastRttMs != null ? ` · command ${stats.lastRttMs} ms` : ''}
        {stats.lastError ? ` · ${stats.lastError}` : ''}
        {' · '}WASD drive · R/F shoulder · Space stops
      </p>

      <div className="speed-slider-row">
        <label htmlFor="drive-speed-slider" className="speed-label">Drive</label>
        <input
          id="drive-speed-slider"
          type="range"
          min={DRIVE_SPEED_MIN}
          max={DRIVE_SPEED_MAX}
          value={driveSpeed}
          onChange={(e) => setDriveSpeed(Number(e.target.value))}
          className="speed-slider"
          tabIndex={-1}
        />
        <span className="speed-value">{driveSpeed}%</span>
      </div>

      <div className="speed-slider-row speed-slider-row-arm">
        <label htmlFor="arm-speed-slider" className="speed-label">Arm</label>
        <input
          id="arm-speed-slider"
          type="range"
          min={ARM_SPEED_MIN}
          max={ARM_SPEED_MAX}
          value={armSpeed}
          onChange={(e) => setArmSpeed(Number(e.target.value))}
          className="speed-slider speed-slider-arm"
          tabIndex={-1}
        />
        <span className="speed-value speed-value-arm">{armSpeed}/{ARM_SPEED_MAX}</span>
      </div>

      <DriveControl disabled={disabled} driveSpeed={driveSpeed} link={link} />
      <ArmControl disabled={disabled} armSpeed={armSpeed} />
    </div>
  );
}
