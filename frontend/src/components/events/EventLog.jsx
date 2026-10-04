import { EVENT_LOG_LIMIT } from '../../config/constants';
import { useEvents } from '../../hooks/useEvents';
import Card from '../layout/Card';
import LoadingState from '../layout/LoadingState';
import ErrorState from '../layout/ErrorState';
import EventItem from './EventItem';

/** Most recent gas / flame / detection events from Firestore (live). */
export default function EventLog({ now }) {
  const { events, loading, error } = useEvents(EVENT_LOG_LIMIT);

  return (
    <Card tilt className="flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Event log</h2>
        <span className="text-xs text-slate-500">last {EVENT_LOG_LIMIT}</span>
      </div>

      {loading ? (
        <LoadingState label="Loading events…" />
      ) : error ? (
        <ErrorState title="Could not load events" message={error} />
      ) : events.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">No events recorded yet.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          {events.map((event) => (
            <EventItem key={event.id} event={event} now={now} />
          ))}
        </ul>
      )}
    </Card>
  );
}
