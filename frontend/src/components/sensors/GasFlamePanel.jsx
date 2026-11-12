import Card from '../layout/Card';
import StatusBadge from './StatusBadge';

/**
 * Hazard + connection badges.
 * Sensor booleans: true = detected (bad), false = clear (good).
 * When fire is detected, the whole card pulses red and shows a prominent banner.
 */
export default function GasFlamePanel({ sensors, online }) {
  const invert = (v) => (v === null || v === undefined ? null : !v);
  const fireDetected = sensors?.flame === true;
  const gasDetected = sensors?.mq2 === true || sensors?.mq6 === true;
  const hazard = fireDetected || gasDetected;

  return (
    <Card tilt={!hazard} alert={hazard}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Status</h2>

      {/* Fire alert banner — only shown when flame sensor is actively triggered */}
      {fireDetected && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2.5 motion-safe:animate-pulse"
        >
          <span className="text-xl" aria-hidden="true">🔥</span>
          <div>
            <p className="text-sm font-bold text-red-200">FIRE DETECTED</p>
            <p className="text-[11px] text-red-400">Flame sensor triggered — rover suppression active.</p>
          </div>
        </div>
      )}

      {gasDetected && !fireDetected && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-950/50 px-3 py-2"
        >
          <span className="text-base" aria-hidden="true">⚠️</span>
          <p className="text-xs font-semibold text-amber-300">Gas detected — check environment.</p>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <StatusBadge label="Connection" icon="📡" ok={online} okText="Online" alertText="Offline" />
        <StatusBadge label="Flame" icon="🔥" ok={invert(sensors?.flame)} okText="Clear" alertText="FIRE" />
        <StatusBadge label="Gas (MQ-2)" icon="💨" ok={invert(sensors?.mq2)} okText="Clear" alertText="Gas" />
        <StatusBadge label="Gas (MQ-6)" icon="🧪" ok={invert(sensors?.mq6)} okText="Clear" alertText="Gas" />
      </div>
    </Card>
  );
}
