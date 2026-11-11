import { useEffect, useState } from 'react';
import { API_HEALTH_URL } from '../../config/constants';
import { useFirebaseConnection } from '../../hooks/useFirebaseConnection';
import { useControlStats } from '../../hooks/useControlStats';
import { auth } from '../../lib/firebase';

export default function SystemHealth({ link, diagnostics, camera }) {
  const firebase = useFirebaseConnection();
  const stats = useControlStats();
  const [backendMs, setBackendMs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function probe() {
      const started = performance.now();
      try {
        const response = await fetch(API_HEALTH_URL);
        if (!cancelled) setBackendMs(response.ok ? Math.round(performance.now() - started) : null);
      } catch {
        if (!cancelled) setBackendMs(null);
      }
    }
    probe();
    const timer = setInterval(probe, 15_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const age = diagnostics.lastMessageAt ? `${Math.max(0, Date.now() - diagnostics.lastMessageAt)} ms` : '—';

  return (
    <section id="health" className="card space-y-3" aria-label="System health">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300">Connection and system health</h2>
      <dl className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <Row label="Sensor link" value={link} />
        <Row label="Sensor age" value={age} />
        <Row label="Sensor interval" value={diagnostics.intervalMs ? `${diagnostics.intervalMs} ms` : '—'} />
        <Row label="Socket reconnects" value={String(diagnostics.reconnects)} />
        <Row label="Invalid samples" value={String(diagnostics.invalidCount)} />
        <Row label="Firebase" value={firebase} />
        <Row label="Backend health" value={backendMs === null ? 'unavailable' : `${backendMs} ms`} />
        <Row label="Command gateway" value={stats.lastRttMs === null ? 'no sample' : `${stats.lastRttMs} ms total`} />
        <Row label="Rover ack" value={stats.upstreamRttMs === null ? '—' : `${stats.upstreamRttMs} ms`} />
        <Row label="Command result" value={stats.lastError || (stats.lastStatus ? `HTTP ${stats.lastStatus}` : '—')} />
        <Row label="Camera" value={camera?.label || '—'} />
        <Row label="Signed in" value={auth?.currentUser ? 'yes' : 'no'} />
      </dl>
    </section>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-white/5 bg-slate-950/30 px-2 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-mono text-slate-200">{value}</dd>
    </div>
  );
}
