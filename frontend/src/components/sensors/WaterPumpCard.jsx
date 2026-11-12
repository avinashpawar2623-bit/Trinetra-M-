import { useEffect, useRef, useState } from 'react';
import {
  deriveSuppression,
  observedRuntimeMs,
  reducePumpTimeline,
} from '../../lib/pump';
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
 * Combined Water Pump + Fire Detection card.
 *
 * Shows:
 *  - Pulsing fire-detected alert banner when flame sensor fires
 *  - Live pump ON/OFF indicator (animated bulb)
 *  - Pump response context when fire is detected
 *  - Session runtime counter (ticks every second while pump is ON)
 *  - Last confirmed ON/OFF timestamps
 *  - Comms quality pill
 */
export default function WaterPumpCard({ sensors, link, now }) {
  const [timeline, setTimeline] = useState(null);
  const timelineRef = useRef(null);

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

  const fireDetected = view.fire === 'DETECTED';
  const fireClear = view.fire === 'CLEAR';
  const isOn = view.pumpState === 'ON' || view.pumpState === 'ON (stale)';
  const isOff = view.pumpState === 'OFF' || view.pumpState === 'OFF (stale)';
  const isUnknown = view.pumpState === 'UNKNOWN';

  const fault = sensors?.pumpFault === true;

  const observed = observedRuntimeMs(timeline, now);
  const runtimeMs =
    view.reportedRuntime !== null
      ? view.reportedRuntime * 1000
      : isOn
      ? observed
      : null;
  const runtimeLabel = view.reportedRuntime !== null ? 'Reported runtime' : 'Session runtime';

  const commsPill = view.fresh
    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30';

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

  const pumpStatusText = isOn ? 'RUNNING' : isOff ? 'IDLE' : 'NO DATA';
  const pumpStatusColor = isOn
    ? 'text-cyan-300'
    : isOff
    ? 'text-slate-400'
    : 'text-slate-500';

  const statusText = isOn ? 'RUNNING' : isOff ? 'IDLE' : 'NO DATA';
  const statusTextColor = isOn
    ? 'text-cyan-300'
    : isOff
    ? 'text-slate-400'
    : 'text-slate-500';

  const systemBadge = {
    ACTIVE: 'bg-red-600 text-white',
    SUPPRESSING: 'bg-orange-500/30 text-orange-200 border border-orange-500/40',
    FAULT: 'bg-amber-500/20 text-amber-200',
    STANDBY: 'bg-slate-800 text-slate-300',
  }[view.system] ?? 'bg-slate-800 text-slate-300';

  return (
    <Card tilt={!fireDetected && !isOn} alert={fireDetected}>
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="text-lg">
            {fireDetected ? '🔥' : '💧'}
          </span>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
            Water Pump
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold tracking-wide ${systemBadge}`}>
            {view.system}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${commsPill}`}>
            {view.fresh ? 'LIVE' : view.comms.toUpperCase()}
          </span>
        </div>
      </div>

      {fireDetected && (
        <div
          role="alert"
          className="mb-3 flex items-center gap-2 rounded-md border border-red-500/60 bg-red-950/60 px-3 py-2.5 motion-safe:animate-pulse"
        >
          <span className="text-base" aria-hidden="true">
            🔥
          </span>
          <div>
            <p className="text-sm font-bold text-red-200">FIRE DETECTED</p>
            <p className="text-[11px] text-red-400">
              {isOn
                ? 'Pump is running — suppression active.'
                : 'Waiting for pump confirmation from rover.'}
            </p>
          </div>
        </div>
      )}

      {fireClear && isOn && (
        <div className="mb-3 flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-950/40 px-3 py-2">
          <span className="text-base" aria-hidden="true">
            ⚠️
          </span>
          <p className="text-xs text-amber-300">Fire clear — pump still running. Check rover.</p>
        </div>
      )}

      <div className="flex items-center gap-4 py-2">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-slate-900 transition-all duration-500 ${indicatorRing}`}
        >
          <span
            className={`h-8 w-8 rounded-full transition-all duration-500 ${bulbColor} ${
              isOn ? 'motion-safe:animate-pulse' : ''
            }`}
          />
        </div>

        <div className="min-w-0">
          <p className={`text-lg font-bold tracking-widest ${pumpStatusColor}`}>
            {pumpStatusText}
          </p>
          <p className="text-xs text-slate-500">
            {isOn
              ? `Running for ${fmt(runtimeMs)}`
              : isOff
              ? `Last ran ${stamp(timeline?.lastOnAt)}`
              : 'Awaiting telemetry'}
          </p>
          {fireDetected && !isOn && (
            <p className="mt-0.5 text-xs font-semibold text-orange-400">
              Pump state unconfirmed by rover
            </p>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <Detail label="Fire sensor" value={view.fire} valueClass={fireDetected ? 'text-red-300 font-bold' : fireClear ? 'text-emerald-400' : 'text-slate-400'} />
        <Detail label="Pump state" value={view.pumpState} />
        <Detail label={runtimeLabel} value={fmt(runtimeMs)} />
        <Detail label="Last ON" value={stamp(timeline?.lastOnAt)} />
        <Detail label="Last OFF" value={stamp(timeline?.lastOffAt)} />
      </dl>

      {fault && (
        <p
          className="mt-3 rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200"
          role="alert"
        >
          The rover reports a pump fault.
        </p>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Status reflects rover telemetry only. Suppression is controlled autonomously on the rover.
      </p>
    </Card>
  );
}

function Detail({ label, value, valueClass = 'text-slate-100' }) {
  return (
    <div className="rounded-md border border-white/8 bg-slate-950/40 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-0.5 font-mono text-sm ${valueClass}`}>{value}</dd>
    </div>
  );
}
