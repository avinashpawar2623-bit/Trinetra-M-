import { lazy, Suspense, useState } from 'react';
import { useRoverSensors } from '../hooks/useRoverSensors';
import { useRoverStatus } from '../hooks/useRoverStatus';
import { useDetections } from '../hooks/useDetections';
import { useEventLogger } from '../hooks/useEventLogger';
import { useNow } from '../hooks/useNow';
import { usePiApi } from '../hooks/usePiApi';
import { canControlRover } from '../lib/rbac';
import { isRoverOnline } from '../lib/levels';
import Header from '../components/layout/Header';
import ConnectionBanner from '../components/layout/ConnectionBanner';
import LoadingState from '../components/layout/LoadingState';
import ErrorState from '../components/layout/ErrorState';
import GasFlamePanel from '../components/sensors/GasFlamePanel';
import DistancePanel from '../components/sensors/DistancePanel';
import ClimatePanel from '../components/sensors/ClimatePanel';
import WaterPumpCard from '../components/sensors/WaterPumpCard';
import MainViewPanel from '../components/MainViewPanel';
import EventLog from '../components/events/EventLog';
import FireSuppressionPanel from '../components/suppression/FireSuppressionPanel';
import SystemHealth from '../components/layout/SystemHealth';
const RoverControlPanel = lazy(() => import('../components/camera/RoverControlPanel'));

export default function Dashboard({ headerActions, role, navigate, sessionError }) {
  const sensors = useRoverSensors();
  const status = useRoverStatus();
  const detections = useDetections();
  const { link, diagnostics } = usePiApi();
  const now = useNow();
  const online = isRoverOnline(status.data, now);
  const [camera, setCamera] = useState(null);
  const showController = canControlRover(role);

  useEventLogger({ detections: detections.data, sensors: sensors.data });

  return (
    <div className="min-h-screen">
      <ConnectionBanner status={status.data} loading={status.loading} now={now} />
      <Header
        online={online}
        lastSeen={status.data?.lastSeen}
        now={now}
        actions={headerActions}
        role={role}
        navigate={navigate}
        link={link}
      />

      <main className="mx-auto grid max-w-7xl gap-4 px-4 py-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <section id="overview" className="card">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Rover overview</h2>
            <p className="mt-2 text-sm text-slate-400">
              Telemetry link <span className="font-mono text-slate-200">{link}</span>
              {sensors.data?.updatedAt ? ` · sample ${Math.max(0, now - sensors.data.updatedAt)} ms old` : ''}.
              {sessionError ? ` ${sessionError}` : ''}
            </p>
          </section>

          <section id="camera">
            <MainViewPanel
              sensors={sensors.data}
              online={online}
              lastSeen={status.data?.lastSeen ?? null}
              detections={detections}
              now={now}
              onStreamStatus={setCamera}
            />
          </section>

          <section id="sensors" className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Real-time sensors</h2>
            {sensors.error && <ErrorState title="Sensor feed error" message={sensors.error} />}
            {sensors.loading ? (
              <div className="card"><LoadingState label="Waiting for sensor data…" /></div>
            ) : (
              <ClimatePanel sensors={sensors.data} />
            )}
          </section>

          {showController && (
            <section id="controller" className="space-y-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Rover controller</h2>
              <Suspense fallback={<div className="card"><LoadingState label="Loading controller…" /></div>}>
                <RoverControlPanel />
              </Suspense>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          {status.error && <ErrorState title="Status feed error" message={status.error} />}
          <GasFlamePanel sensors={sensors.data} online={status.loading ? null : online} />
          <DistancePanel sensors={sensors.data} />
          <WaterPumpCard sensors={sensors.data} link={link} />
          <FireSuppressionPanel sensors={sensors.data} link={link} now={now} />
          <section id="events">
            <EventLog now={now} />
          </section>
          <SystemHealth link={link} diagnostics={diagnostics} camera={camera} />
        </aside>
      </main>
    </div>
  );
}
