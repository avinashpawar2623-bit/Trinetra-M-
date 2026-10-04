export default function CameraOffline({ url, onRetry }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900 p-4 text-center">
      <span className="text-4xl" aria-hidden="true">📷</span>
      <p className="font-semibold text-slate-200">Camera offline</p>
      <p className="max-w-sm break-all text-xs text-slate-500">Could not load stream from {url}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
      >
        Retry
      </button>
    </div>
  );
}
