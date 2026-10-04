import { formatAge } from '../../lib/levels';

const TYPE_STYLES = {
  gas: { icon: '💨', ring: 'border-amber-500/40 bg-amber-500/10', title: 'Gas' },
  flame: { icon: '🔥', ring: 'border-red-500/40 bg-red-500/10', title: 'Flame' },
  detection: { icon: '👁️', ring: 'border-sky-500/40 bg-sky-500/10', title: 'Detection' },
  unknown: { icon: '•', ring: 'border-slate-600 bg-slate-800/60', title: 'Event' },
};

function formatTimestamp(ms) {
  if (!ms) return 'pending…';
  const date = new Date(ms);
  const sameDay = date.toDateString() === new Date().toDateString();
  return sameDay ? date.toLocaleTimeString() : date.toLocaleString();
}

export default function EventItem({ event, now }) {
  const style = TYPE_STYLES[event.type] || TYPE_STYLES.unknown;

  return (
    <li className={`flex gap-3 rounded-lg border px-3 py-2 ${style.ring}`}>
      <span className="text-lg leading-6" aria-hidden="true">{style.icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-100">
            {style.title}
            {event.label && <span className="ml-1 font-normal text-slate-300">· {event.label}</span>}
          </span>
          <time className="shrink-0 font-mono text-[11px] text-slate-400" dateTime={event.timestamp ? new Date(event.timestamp).toISOString() : undefined}>
            {formatTimestamp(event.timestamp)}
          </time>
        </div>
        {event.message && <p className="truncate text-xs text-slate-400">{event.message}</p>}
        {event.timestamp && <p className="text-[10px] text-slate-500">{formatAge(now - event.timestamp)}</p>}
      </div>
    </li>
  );
}
