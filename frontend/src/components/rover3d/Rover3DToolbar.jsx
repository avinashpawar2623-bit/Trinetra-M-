import { CAMERA_PRESETS } from '../../lib/three/interaction/cameraRig';
import { QUALITY_OPTIONS } from '../../lib/three/quality';

const btn = 'rounded-md border border-white/10 bg-slate-950/70 px-2 py-1 text-[11px] font-medium text-slate-200 backdrop-blur hover:bg-slate-900';

/** Camera presets, auto-rotate, quality, and screenshot controls over the 3D view. */
export default function Rover3DToolbar({
  preset,
  onPreset,
  autoRotate,
  autoRotateAvailable,
  onToggleAutoRotate,
  quality,
  resolvedQuality,
  onQuality,
  onScreenshot,
}) {
  return (
    <div className="absolute inset-x-2 top-2 z-10 flex flex-wrap items-start justify-between gap-1.5">
      <div role="group" aria-label="Camera preset" className="inline-flex rounded-md border border-white/10 bg-slate-950/70 p-0.5 backdrop-blur">
        {Object.entries(CAMERA_PRESETS).map(([id, p]) => (
          <button
            key={id}
            type="button"
            aria-pressed={preset === id}
            onClick={() => onPreset(id)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
              preset === id ? 'bg-emerald-500/90 text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-end gap-1.5">
        {autoRotateAvailable && preset === 'orbit' && (
          <button type="button" className={btn} aria-pressed={autoRotate} onClick={onToggleAutoRotate}>
            {autoRotate ? 'Stop' : 'Rotate'}<span className="hidden sm:inline">{autoRotate ? ' rotate' : ''}</span>
          </button>
        )}
        <label className={`${btn} flex items-center gap-1`}>
          <span className="hidden text-slate-400 sm:inline">Quality</span>
          <select
            value={quality}
            onChange={(e) => onQuality(e.target.value)}
            className="bg-transparent font-semibold text-slate-100 outline-none [&>option]:bg-slate-900"
            aria-label="Rendering quality"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q === 'auto' ? `Auto (${resolvedQuality})` : q[0].toUpperCase() + q.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={btn} onClick={() => onPreset('orbit')} aria-label="Reset view">
          Reset<span className="hidden sm:inline"> view</span>
        </button>
        <button type="button" className={btn} onClick={onScreenshot} aria-label="Screenshot">
          <span className="sm:hidden">PNG</span>
          <span className="hidden sm:inline">Screenshot</span>
        </button>
      </div>
    </div>
  );
}
