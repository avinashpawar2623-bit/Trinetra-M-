import { useRoverSensors } from '../../hooks/useRoverSensors';
import { useRoverStatus } from '../../hooks/useRoverStatus';
import { useDetections } from '../../hooks/useDetections';
import { useNow } from '../../hooks/useNow';
import { isRoverOnline } from '../../lib/levels';
import MainViewPanel from '../MainViewPanel';
import RoverControlPanel from '../camera/RoverControlPanel';

/**
 * Camera and both controllers on one screen.
 * The camera stays put while the controls are used beside it (or directly under it on a phone).
 */
export default function Cockpit({ onStreamStatus, controls = true }) {
  const sensors = useRoverSensors();
  const status = useRoverStatus();
  const detections = useDetections();
  const now = useNow();
  const online = isRoverOnline(status.data, now);

  return (
    <div className="cockpit-grid">
      <div className="cockpit-stage">
        <MainViewPanel
          sensors={sensors.data}
          online={online}
          lastSeen={status.data?.lastSeen ?? null}
          detections={detections}
          now={now}
          onStreamStatus={onStreamStatus}
        />
      </div>
      {controls && <RoverControlPanel />}
    </div>
  );
}
