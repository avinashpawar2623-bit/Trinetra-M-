export default function LoadingState({ label = 'Loading…', fullScreen = false }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 text-slate-400 ${fullScreen ? 'min-h-screen' : 'py-8'}`}
      role="status"
    >
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-emerald-400" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
