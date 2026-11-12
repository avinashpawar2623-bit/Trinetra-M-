import { useEffect, useRef, useState } from 'react';
import { deriveSuppression, observedRuntimeMs, reducePumpTimeline } from '../../lib/pump';
import Card from '../layout/Card';

function fmt(ms) {
  if (ms === null || ms === undefined) return '—';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

function stamp(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString();
}

/**
 * Dedicated water-pump status card.
 * Reads pump state from live telemetry (sensors.pump boolean) and shows:
 *  - Animated ON / OFF / UNKNOWN indicator
 *  - Comms quality pill
 *  - Last confirmed ON / OFF timestamps
 *  - Running-time counter (ticks in real-time while pump is ON)
 */
export default function WaterPumpCard({ sensors, link, now }) {
  const [timeline, setTimeline] = useState(null);
  const timelineRef = useRef(null);

  // Update timeline whenever sensors or link changes
  useEffect(() => {
    const next = reducePumpTimeline(timelineRef.current, {
      pump: sensors?.pump,
      link,
      now: Date.now(),
    });
    timelineRef.current = next;
    setTimeline(next);
  }, [sensors, link]);

  const view = deriveSuppression({ sensors, link });
  const isOn = view.pumpState === 'ON';
  const isOff = view.pumpState === 'OFF';
  const isUnknown = view.pumpState === 'UNKNOWN';

  const observed = observedRuntimeMs(timeline, now);
  const runtimeMs = view.reportedRuntime !== null
    ? view.reportedRuntime * 1000
    : (isOn ? observed : null);
  const runtimeLabel = view.reportedRuntime !== null ? 'Reported runtime' : 'Session runtime';

  // Visual theming
  const cardAlert = isOn; // pump running = blue-tinted accent (not a danger alert)
  const indicatorRing = isOn
    ? 'ring-2 ring-cyan-400/60 shadow-[0_0_20px_4px_rgba(34,211,238,0.35)]'
    : isOff
    ? 'ring-2 ring-slate-600/50'
    : 'ring-2 ring-slate-700/40';

  const bulbColor = isOn
    ? 'bg-cyan-400 shadow-[0_0_18px_6px_rgba(34,211,238,0.6)]'
    : isOff
    ? 'bg-slate-600'
    : 'bg-slate-700';

  const statusText = isOn ? 'RUNNING' : isOff ? 'IDLE' : 'NO DATA';
  const statusTextColor = isOn
    ? 'text-cyan-300'
    : isOff
    ? 'text-slate-400'
    : 'text-slate-500';

  const commsPill =
    view.fresh
      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';

  return (
    <Card tilt={!isOn}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">💧</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Water Pump
          </h2>
        </div>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${commsPill}`}>
          {view.fresh ? 'LIVE' : view.comms.toUpperCase()}
        </span>
      </div>

      {/* Big indicator */}
      <div className="flex flex-col items-center gap-3 py-3">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-full bg-slate-900 transition-all duration-500 ${indicatorRing}`}
        >
          <span
            className={`h-10 w-10 rounded-full transition-all duration-500 ${bulbColor} ${
              isOn ? 'motion-safe:animate-pulse' : ''
            }`}
          />
        </div>

        <span className={`text-xl font-bold tracking-widest ${statusTextColor}`}>
          {statusText}
        </span>

        {isOn && (
          <span className="text-xs text-cyan-400/70 animate-pulse">● Pump is active</span>
        )}
      </div>

      {/* Detail grid */}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        <Detail label="Pump state" value={view.pumpState} />
        <Detail label={runtimeLabel} value={fmt(runtimeMs)} />
        <Detail label="Last ON" value={stamp(timeline?.lastOnAt)} />
        <Detail label="Last OFF" value={stamp(timeline?.lastOffAt)} />
      </dl>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Status reflects rover telemetry only. Pump is controlled autonomously on the rover.
      </p>
    </Card>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-md border border-white/8 bg-slate-950/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-mono text-sm text-slate-100">{value}</dd>
    </div>
  );
}

