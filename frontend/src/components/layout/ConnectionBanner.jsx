import { formatAge, isRoverOnline } from '../../lib/levels';

/**
 * Sticky warning shown when the rover hasn't reported within STALE_STATUS_MS.
 * `now` comes from useNow(), so this re-evaluates every second even if no
 * new data arrives (the whole point: silence is what indicates the outage).
 */
export default function ConnectionBanner({ status, loading, now }) {
  if (loading || isRoverOnline(status, now)) return null;

  let detail;
  if (!status || status.lastSeen === null) {
    detail = 'No status has been received from the rover yet.';
  } else if (status.connected === false) {
    detail = `Rover reports disconnected. Last seen ${formatAge(now - status.lastSeen)}.`;
  } else {
    detail = `No update for ${formatAge(now - status.lastSeen).replace(' ago', '')}. Last seen ${new Date(status.lastSeen).toLocaleTimeString()}.`;
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-red-500/50 bg-red-600/90 px-4 py-2.5 text-sm text-white backdrop-blur"
    >
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
      </span>
      <span className="font-semibold">Connection lost</span>
      <span className="text-red-100">{detail}</span>
    </div>
  );
}
