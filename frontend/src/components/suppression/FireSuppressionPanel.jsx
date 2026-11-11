import { useEffect, useRef, useState } from 'react';
import { deriveSuppression, observedRuntimeMs, reducePumpTimeline } from '../../lib/pump';

function stamp(ms) {
  if (!ms) return '—';
  return new Date(ms).toLocaleTimeString();
}

function formatRun(ms) {
  if (ms === null || ms === undefined) return '—';
  const total = Math.floor(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

/**
 * Displays fire and pump state from telemetry only.
 * Automatic suppression stays on the rover and does not depend on this panel.
 */
export default function FireSuppressionPanel({ sensors, link, now }) {
  const [timeline, setTimeline] = useState(null);
  const timelineRef = useRef(null);

  useEffect(() => {
    const next = reducePumpTimeline(timelineRef.current, { pump: sensors?.pump, link, now: Date.now() });
    timelineRef.current = next;
    setTimeline(next);
  }, [sensors, link]);

  const view = deriveSuppression({ sensors, link });
  const observed = observedRuntimeMs(timeline, now);
  const runtimeLabel = view.reportedRuntime !== null ? 'Reported runtime' : 'Observed this session';
  const runtime = view.reportedRuntime !== null ? `${view.reportedRuntime}s` : formatRun(view.pumpState === 'ON' ? observed : null);
  const alert = view.fire === 'DETECTED';

  return (
    <section id="suppression" className={`card space-y-3 ${alert ? 'card-alert' : ''}`} aria-label="Fire suppression">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Fire suppression</h2>
        <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${tone(view.system)}`}>{view.system}</span>
      </div>

      {alert && (
        <p className="rounded-md border border-red-500/50 bg-red-950/50 px-3 py-2 text-sm font-semibold text-red-200" role="alert">
          Fire detected. Pump state is shown only when the rover confirms it.
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Reading label="Fire" value={view.fire} />
        <Reading label="Pump" value={view.pumpState} />
        <Reading label="Last confirmed ON" value={stamp(timeline?.lastOnAt)} />
        <Reading label="Last confirmed OFF" value={stamp(timeline?.lastOffAt)} />
        <Reading label={runtimeLabel} value={runtime} />
        <Reading label="Telemetry" value={view.fresh ? 'LIVE' : view.comms.toUpperCase()} />
      </dl>
      <p className="text-[11px] leading-relaxed text-slate-500">
        The rover's existing automatic pump logic runs without this dashboard. No remote pump command is sent from here.
      </p>
    </section>
  );
}

function Reading({ label, value }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 font-mono text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function tone(system) {
  if (system === 'ACTIVE') return 'bg-red-600 text-white';
  if (system === 'FAULT') return 'bg-amber-500/20 text-amber-200';
  return 'bg-slate-800 text-slate-300';
}
