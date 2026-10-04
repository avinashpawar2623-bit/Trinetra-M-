export default function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <div role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
      <p className="font-semibold">{title}</p>
      {message && <p className="mt-1 break-words text-red-300/90">{message}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 rounded-md bg-red-500/20 px-3 py-1 text-xs font-semibold hover:bg-red-500/30"
        >
          Retry
        </button>
      )}
    </div>
  );
}
