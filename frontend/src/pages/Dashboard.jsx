import { useRoverSensors } from '../hooks/useRoverSensors';
import { useRoverStatus } from '../hooks/useRoverStatus';
import { useDetections } from '../hooks/useDetections';
import { useEventLogger } from '../hooks/useEventLogger';
import { useNow } from '../hooks/useNow';
import { isRoverOnline } from '../lib/levels';
import Header from '../components/layout/Header';
import ConnectionBanner from '../components/layout/ConnectionBanner';
import LoadingState from '../components/layout/LoadingState';
import ErrorState from '../components/layout/ErrorState';
import GasFlamePanel from '../components/sensors/GasFlamePanel';
import DistancePanel from '../components/sensors/DistancePanel';
import ClimatePanel from '../components/sensors/ClimatePanel';
import MainViewPanel from '../components/MainViewPanel';
import EventLog from '../components/events/EventLog';

export default function Dashboard({ headerActions }) {
  const sensors = useRoverSensors();
  const status = useRoverStatus();
  const detections = useDetections();
  const now = useNow();
  const online = isRoverOnline(status.data, now);

  useEventLogger({ detections: detections.data, sensors: sensors.data });

  return (
    <div className="min-h-screen">
      <ConnectionBanner status={status.data} loading={status.loading} now={now} />
      <Header online={online} lastSeen={status.data?.lastSeen} now={now} actions={headerActions} />

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <MainViewPanel
            sensors={sensors.data}
            online={online}
            lastSeen={status.data?.lastSeen ?? null}
            detections={detections}
            now={now}
          />
          {sensors.error && <ErrorState title="Sensor feed error" message={sensors.error} />}
          {sensors.loading ? (
            <div className="card"><LoadingState label="Waiting for sensor data…" /></div>
          ) : (
            <ClimatePanel sensors={sensors.data} />
          )}
        </div>

        <aside className="space-y-4">
          {status.error && <ErrorState title="Status feed error" message={status.error} />}
          <GasFlamePanel sensors={sensors.data} online={status.loading ? null : online} />
          <DistancePanel sensors={sensors.data} />
          <EventLog now={now} />
        </aside>
      </main>
    </div>
  );
}
