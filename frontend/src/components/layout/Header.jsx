import { formatAge } from '../../lib/levels';

/** Top bar: brand, online indicator, last-seen age, and right-side actions (e.g. logout). */
export default function Header({ online, lastSeen, now, actions }) {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400' : 'bg-red-500'}`} />
          <div>
            <h1 className="text-lg font-bold tracking-[0.3em] text-slate-100">TRINETRA</h1>
            <p className="text-xs text-slate-500">
              Disaster-response rover · {lastSeen ? `last seen ${formatAge(now - lastSeen)}` : 'awaiting telemetry'}
            </p>
          </div>
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
