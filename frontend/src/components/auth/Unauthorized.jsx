export default function Unauthorized({ onBack }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg items-center px-4">
      <section className="card space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Access denied</p>
        <h1 className="text-xl font-semibold text-slate-100">The rover controller is limited to administrators</h1>
        <p className="text-sm leading-relaxed text-slate-400">
          This account can monitor sensors, the camera, detections, fire status, and event history.
          It cannot send motor commands or open controller settings.
        </p>
        <a href="/" onClick={onBack} className="inline-block text-sm font-semibold text-emerald-300">
          Return to monitoring
        </a>
      </section>
    </main>
  );
}
