import { formatAge } from '../../lib/levels';

/** Top bar: brand, role, monitoring links, and account actions. */
export default function Header({ online, lastSeen, now, actions, role, navigate, link }) {
  const admin = role === 'admin';
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${online ? 'bg-emerald-400 shadow-[0_0_10px] shadow-emerald-400' : 'bg-red-500'}`} />
          <div>
            <h1 className="text-lg font-bold tracking-[0.3em] text-slate-100">TRINETRA</h1>
            <p className="text-xs text-slate-500">
              Disaster-response rover · {link || 'link unknown'} · {lastSeen ? `last seen ${formatAge(now - lastSeen)}` : 'awaiting telemetry'}
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2 text-xs" aria-label="Dashboard">
          <a className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800" href="/" onClick={(event) => navigate?.(event, '/')}>Monitor</a>
          {admin && (
            <a className="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800" href="/control" onClick={(event) => navigate?.(event, '/control')}>Controller</a>
          )}
          {role && <span className="rounded bg-slate-800 px-2 py-1 font-semibold uppercase tracking-wide text-slate-400">{role}</span>}
          {actions}
        </nav>
      </div>
    </header>
  );
}
