import { useState } from 'react';
import { NO_ECHO } from '../../config/constants';
import { distanceLevel, temperatureLevel } from '../../lib/levels';

const SWATCH = {
  normal: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  unknown: 'bg-slate-500',
};

function formatDistance(v) {
  if (v === NO_ECHO) return 'no echo';
  if (typeof v === 'number') return `${v.toFixed(0)} cm`;
  return '--';
}

function Row({ level, label, value }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${SWATCH[level]}`} />
        {label}
      </span>
      <span className="font-mono text-slate-200">{value}</span>
    </li>
  );
}

/** What each 3D visual means, with live values. Open by default only on wide screens. */
export default function Rover3DLegend({ sensors, online, detectionCount }) {
  const [open, setOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1280);
  const s = sensors || {};
  const flag = (v) => (v === true ? 'danger' : v === false ? 'normal' : 'unknown');
  const flagText = (v, on) => (v === true ? on : v === false ? 'clear' : '--');
  const temp = s.temperature ?? null;
  const alarm = s.flame === true || s.mq2 === true || s.mq6 === true;

  return (
    <div className="absolute bottom-2 left-2 z-10 max-w-[16rem] text-[11px] text-slate-300">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mb-1 rounded-md border border-white/10 bg-slate-950/70 px-2 py-0.5 font-semibold backdrop-blur hover:bg-slate-900"
        aria-expanded={open}
      >
        {open ? 'Hide legend' : 'Legend'}
      </button>
      {open && (
        <div className="rounded-lg border border-white/10 bg-slate-950/75 p-2.5 shadow-xl backdrop-blur">
          <ul className="space-y-1">
            <Row level={online ? 'normal' : 'danger'} label="Status LED / headlights" value={online ? 'online' : 'offline'} />
            <Row level={alarm ? 'warning' : 'normal'} label="Amber beacon (any alarm)" value={alarm ? 'ON' : 'off'} />
            <Row level={flag(s.flame)} label="Fire particles (flame)" value={flagText(s.flame, 'FIRE')} />
            <Row level={flag(s.mq2)} label="Smoke + ring (MQ-2)" value={flagText(s.mq2, 'GAS')} />
            <Row level={flag(s.mq6)} label="Smoke + ring (MQ-6)" value={flagText(s.mq6, 'GAS')} />
            <Row level={distanceLevel(s.distanceFront ?? null)} label="Front beam + wall" value={formatDistance(s.distanceFront)} />
            <Row level={distanceLevel(s.distanceRear ?? null)} label="Rear beam + wall" value={formatDistance(s.distanceRear)} />
            <Row level={temperatureLevel(temp)} label="Heat haze / tint (temp)" value={temp === null ? '--' : `${temp.toFixed(1)}°C`} />
            <Row
              level={detectionCount ? 'warning' : 'unknown'}
              label="Detection markers + trails"
              value={detectionCount === null ? 'stale' : detectionCount}
            />
          </ul>
          <p className="mt-2 border-t border-white/10 pt-1.5 text-[10px] text-slate-500">Click a sensor or marker for details · drag to orbit · scroll to zoom</p>
        </div>
      )}
    </div>
  );
}
