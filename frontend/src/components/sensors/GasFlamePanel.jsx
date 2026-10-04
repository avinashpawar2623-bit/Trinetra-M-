import Card from '../layout/Card';
import StatusBadge from './StatusBadge';

/**
 * Hazard + connection badges. Sensor booleans are "true = detected",
 * so the badge is OK when the value is false.
 */
export default function GasFlamePanel({ sensors, online }) {
  const invert = (v) => (v === null || v === undefined ? null : !v);
  const hazard = sensors?.flame === true || sensors?.mq2 === true || sensors?.mq6 === true;

  return (
    <Card tilt alert={hazard}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Status</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        <StatusBadge label="Connection" icon="📡" ok={online} okText="Online" alertText="Offline" />
        <StatusBadge label="Flame" icon="🔥" ok={invert(sensors?.flame)} okText="Clear" alertText="Fire" />
        <StatusBadge label="Gas (MQ-2)" icon="💨" ok={invert(sensors?.mq2)} okText="Clear" alertText="Gas" />
        <StatusBadge label="Gas (MQ-6)" icon="🧪" ok={invert(sensors?.mq6)} okText="Clear" alertText="Gas" />
      </div>
    </Card>
  );
}
