export default function WaterPumpCard({ sensors, link }) {
  const live = link === 'live';
  const pump = sensors?.pump;
  const known = live && typeof pump === 'boolean';
  const isOn = known && pump;
  const fault = sensors?.pumpFault === true;

  const status = known ? (isOn ? 'ON' : 'OFF') : 'UNKNOWN';
  const statusTone = known
    ? (isOn ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300' : 'border-slate-500/40 bg-slate-500/10 text-slate-300')
    : 'border-amber-400/40 bg-amber-500/10 text-amber-200';

  return (
    <section className="card space-y-3" aria-label="Water pump status" aria-live="polite">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Water pump</h2>
        <span className={`rounded border px-2.5 py-1 text-xs font-bold tracking-wider ${statusTone}`}>
          {status}
        </span>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-400">
        <span className={`h-2 w-2 rounded-full ${known ? (isOn ? 'bg-emerald-400' : 'bg-slate-500') : 'bg-amber-400'}`} aria-hidden="true" />
        <span>{live ? 'Live telemetry' : `Telemetry ${link || 'disconnected'}`}</span>
      </div>

      {fault ? (
        <p className="rounded-md border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-red-200" role="alert">
          The rover reports a pump fault.
        </p>
      ) : !known ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Pump state is unavailable. Check that the rover sends its pump state in live telemetry.
        </p>
      ) : null}
    </section>
  );
}
