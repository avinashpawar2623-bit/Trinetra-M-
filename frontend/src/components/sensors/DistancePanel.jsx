import Card from '../layout/Card';
import DistanceGauge from './DistanceGauge';

export default function DistancePanel({ sensors }) {
  return (
    <Card tilt className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Distance</h2>
      <DistanceGauge label="Front" value={sensors?.distanceFront ?? null} />
      <DistanceGauge label="Rear" value={sensors?.distanceRear ?? null} />
    </Card>
  );
}
