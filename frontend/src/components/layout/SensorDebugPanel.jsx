/**
 * SensorDebugPanel — shows the raw Pi WebSocket payload keys + normalized sensor values.
 *
 * Rendered only in development (import.meta.env.DEV) or when explicitly forced via
 * the ?debug=1 query param. Helps diagnose "why isn't flame showing?" instantly.
 *
 * Usage: <SensorDebugPanel sensors={sensors.data} diagnostics={diagnostics} />
 */
export default function SensorDebugPanel({ sensors, diagnostics }) {
  const show =
    import.meta.env.DEV ||
    (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1');

  if (!show) return null;

  const raw = diagnostics?.lastRaw;
  const rawKeys = raw ? Object.keys(raw) : [];

  // Sensor fields we care about — show each with raw Pi value and normalised result.
  const watchFields = [
    'flame', 'fire', 'flame_detected', 'fire_detected', 'flameDetected', 'fireDetected',
    'pump', 'pump_on', 'pumpOn', 'water_pump',
    'mq2', 'mq6',
    'temp_c', 'temperature', 'humidity',
    'dist1_cm', 'dist2_cm',
    'fps',
  ];

  const present = raw
    ? watchFields.filter((k) => raw[k] !== undefined)
    : [];

  const absent = raw
    ? watchFields.filter((k) => raw[k] === undefined)
    : [];

  return (
    <section className="card space-y-3 border border-violet-500/30 bg-violet-950/20">
      <div className="flex items-center gap-2">
        <span className="text-base" aria-hidden="true">🛠</span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-300">
          Sensor Debug
        </h2>
        <span className="ml-auto text-[10px] text-violet-500">
          {import.meta.env.DEV ? 'dev mode' : '?debug=1'}
        </span>
      </div>

      {/* Normalised output */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wider text-violet-500">Normalised sensor values</p>
        {sensors ? (
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(sensors)
              .filter(([k]) => k !== 'updatedAt')
              .map(([k, v]) => (
                <div key={k} className="rounded bg-slate-900/60 px-2 py-1 font-mono text-[11px]">
                  <span className={`${v === true ? 'text-red-400' : v === false ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {k}
                  </span>
                  <span className="text-slate-500"> = </span>
                  <span className={v === true ? 'text-red-300 font-bold' : v === false ? 'text-emerald-300' : 'text-slate-400'}>
                    {v === null || v === undefined ? 'null' : String(v)}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No sensor data yet.</p>
        )}
      </div>

      {/* Raw Pi payload field presence */}
      {raw ? (
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-violet-500">Raw Pi payload keys</p>
          <p className="mb-1 text-[10px] text-slate-500">All keys: <span className="font-mono text-slate-300">{rawKeys.join(', ')}</span></p>
          {present.length > 0 && (
            <p className="text-[11px] text-emerald-400">
              ✓ Present: {present.map((k) => `${k}=${JSON.stringify(raw[k])}`).join(' · ')}
            </p>
          )}
          {absent.length > 0 && (
            <p className="mt-1 text-[11px] text-amber-400">
              ✗ Missing: {absent.join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Waiting for first Pi message…</p>
      )}
    </section>
  );
}

