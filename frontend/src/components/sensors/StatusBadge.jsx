/**
 * Green/red status pill. `ok` = true -> green, false -> red, null -> gray (unknown).
 */
export default function StatusBadge({ label, ok, okText = 'OK', alertText = 'ALERT', icon }) {
  const state = ok === null || ok === undefined ? 'unknown' : ok ? 'ok' : 'alert';

  // Raised, beveled pill: light inset top edge + drop shadow. Alerts glow.
  const bevel = 'shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_-2px_0_rgb(0_0_0/0.25),0_6px_14px_-6px_rgb(0_0_0/0.7)]';
  const styles = {
    ok: `border-emerald-500/40 bg-linear-to-b from-emerald-500/15 to-emerald-500/5 text-emerald-300 ${bevel}`,
    alert: `border-red-500/60 bg-linear-to-b from-red-500/25 to-red-500/10 text-red-300 ${bevel} motion-safe:animate-glow`,
    unknown: `border-slate-600 bg-linear-to-b from-slate-700/50 to-slate-800/60 text-slate-400 ${bevel}`,
  }[state];

  const dot = {
    ok: 'bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400',
    alert: 'bg-red-500 shadow-[0_0_10px] shadow-red-500',
    unknown: 'bg-slate-500',
  }[state];
  const text = { ok: okText, alert: alertText, unknown: 'No data' }[state];

  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${styles}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span aria-hidden="true">{icon}</span>}
        <span className="truncate text-sm font-medium text-slate-200">{label}</span>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {text}
      </span>
    </div>
  );
}
