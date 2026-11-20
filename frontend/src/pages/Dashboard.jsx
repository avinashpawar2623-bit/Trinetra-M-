import { useState } from 'react';
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
import EventLog from '../components/events/EventLog';
import SystemHealth from '../components/layout/SystemHealth';
import SensorDebugPanel from '../components/layout/SensorDebugPanel';
import SettingsPanel from '../components/SettingsPanel';
import Cockpit from '../components/operate/Cockpit';

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
      <SettingsPanel />
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

      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4">
        {sessionError && <ErrorState title="Session" message={sessionError} />}
        <Cockpit onStreamStatus={setCamera} controls={showController} />

        <section id="sensors" className="sensor-strip">
          {status.error && <ErrorState title="Status feed error" message={status.error} />}
          {sensors.error && <ErrorState title="Sensor feed error" message={sensors.error} />}
          <GasFlamePanel sensors={sensors.data} online={status.loading ? null : online} />
          <WaterPumpCard sensors={sensors.data} link={link} now={now} />
          <DistancePanel sensors={sensors.data} />
          {sensors.loading ? (
            <div className="card"><LoadingState label="Waiting for sensor data…" /></div>
          ) : (
            <ClimatePanel sensors={sensors.data} />
          )}
        </section>

        <details className="card">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-slate-400">
            Log and diagnostics
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <EventLog now={now} />
            <div className="space-y-4">
              <SystemHealth link={link} diagnostics={diagnostics} camera={camera} />
              <SensorDebugPanel sensors={sensors.data} diagnostics={diagnostics} />
            </div>
          </div>
        </details>
      </main>
    </div>
  );
}
