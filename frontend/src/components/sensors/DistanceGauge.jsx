import { DISTANCE_MAX_CM, NO_ECHO } from '../../config/constants';
import { TONES, distanceLevel } from '../../lib/levels';

/**
 * Ultrasonic distance readout + horizontal bar gauge.
 * States: number (cm), NO_ECHO (nothing in range), or null (no data).
 */
export default function DistanceGauge({ label, value }) {
  const isNoEcho = value === NO_ECHO;
  const isMissing = value === null || value === undefined;
  const level = distanceLevel(value);
  const tone = TONES[level];

  const pct = !isNoEcho && !isMissing
    ? Math.max(0, Math.min(100, (value / DISTANCE_MAX_CM) * 100))
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-slate-300">{label}</span>
        {isNoEcho ? (
          <span className="rounded border border-dashed border-slate-500 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-300">
            No echo
          </span>
        ) : isMissing ? (
          <span className="text-sm text-slate-500">--</span>
        ) : (
          <span className={`font-mono text-lg font-semibold ${tone.text}`}>
            {value.toFixed(1)} <span className="text-xs text-slate-400">cm</span>
          </span>
        )}
      </div>

      <div
        className="h-3.5 w-full overflow-hidden rounded-full bg-slate-950 shadow-[inset_0_2px_4px_rgb(0_0_0/0.7),0_1px_0_rgb(255_255_255/0.06)]"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={DISTANCE_MAX_CM}
        aria-valuenow={typeof value === 'number' ? value : undefined}
      >
        {isNoEcho ? (
          // Striped bar communicates "out of range / no reflection" distinctly from 0 cm.
          <div className="h-full w-full bg-[repeating-linear-gradient(45deg,#334155_0_6px,#1e293b_6px_12px)]" />
        ) : (
          // Glossy raised fill: top highlight + soft glow in the level color.
          <div
            className={`relative h-full rounded-full ${tone.bg} transition-all duration-300 after:absolute after:inset-x-1 after:top-0.5 after:h-1/3 after:rounded-full after:bg-white/35`}
            style={{ width: `${pct}%`, boxShadow: `0 0 10px ${tone.glow}` }}
          />
        )}
      </div>
    </div>
  );
}
