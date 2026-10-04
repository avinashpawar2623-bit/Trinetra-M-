import { formatAge } from '../../lib/levels';
import { SENSOR_INFO } from './sensorInfo';

const LEVEL_STYLE = {
  normal: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  warning: 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  danger: 'text-red-300 border-red-500/50 bg-red-500/15',
  unknown: 'text-slate-400 border-slate-600 bg-slate-800/60',
};

/**
 * Details for a clicked sensor housing or detection marker, anchored near
 * the click point and flipped to stay inside the 3D panel.
 * selection = { pick, x, y, width, height }
 */
export default function SensorDetailPopover({ selection, sensors, now, onClose }) {
  const { pick, x, y, width, height } = selection;
  const flipX = x > width / 2;
  const flipY = y > height / 2;

  let title;
  let rows;
  let description = null;
  let level = 'unknown';

  if (pick.type === 'sensor') {
    const info = SENSOR_INFO[pick.key];
    if (!info) return null;
    const reading = info.read(sensors || {});
    title = info.name;
    description = info.description;
    level = reading.level;
    rows = [
      ['Reading', reading.value],
      ['Threshold', info.threshold],
    ];
  } else {
    title = `Detection: ${pick.label}`;
    level = pick.label === 'person' ? 'danger' : 'warning';
    rows = [
      ['Confidence', `${Math.round(pick.confidence * 100)}%`],
      ['Bearing', `${pick.bearingDeg > 0 ? '+' : ''}${pick.bearingDeg}° from heading`],
      ['Seen', formatAge(now - pick.timestamp)],
    ];
    description = 'Position is approximate: bearing comes from the camera frame, range from the front ultrasonic sensor.';
  }

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute z-20 w-64 max-w-[calc(100%-1rem)] rounded-lg border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-300 shadow-2xl backdrop-blur"
      style={{
        left: x,
        top: y,
        transform: `translate(${flipX ? 'calc(-100% - 10px)' : '10px'}, ${flipY ? 'calc(-100% - 10px)' : '10px'})`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 -mt-1 rounded px-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100">
          ×
        </button>
      </div>
      <dl className="space-y-1">
        {rows.map(([k, v], i) => (
          <div key={k} className="flex justify-between gap-3">
            <dt className="text-slate-500">{k}</dt>
            <dd className={i === 0 ? `rounded border px-1.5 font-mono font-semibold ${LEVEL_STYLE[level]}` : 'text-right text-slate-200'}>{v}</dd>
          </div>
        ))}
      </dl>
      {description && <p className="mt-2 leading-snug text-slate-400">{description}</p>}
    </div>
  );
}
