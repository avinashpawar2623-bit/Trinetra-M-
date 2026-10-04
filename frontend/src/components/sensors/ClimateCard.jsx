import { TONES } from '../../lib/levels';
import Card from '../layout/Card';

const LEVEL_TEXT = { normal: 'Normal', warning: 'Warning', danger: 'Danger', unknown: 'No data' };

/**
 * Single metric card (temperature, humidity, battery) with threshold coloring.
 */
export default function ClimateCard({ title, icon, value, unit, level, decimals = 1 }) {
  const tone = TONES[level] || TONES.unknown;
  const hasValue = value !== null && value !== undefined;

  return (
    <Card tilt alert={level === 'danger'}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          {icon && <span className="mr-1.5" aria-hidden="true">{icon}</span>}
          {title}
        </h2>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tone.soft}`}>
          {LEVEL_TEXT[level] || LEVEL_TEXT.unknown}
        </span>
      </div>
      <p
        className={`mt-3 font-mono text-4xl font-bold ${hasValue ? tone.text : 'text-slate-600'}`}
        style={hasValue ? { textShadow: `0 0 18px ${tone.glow}, 0 2px 0 rgb(0 0 0 / 0.5)` } : undefined}
      >
        {hasValue ? value.toFixed(decimals) : '--'}
        <span className="ml-1 text-lg font-medium text-slate-400" style={{ textShadow: 'none' }}>{unit}</span>
      </p>
    </Card>
  );
}
