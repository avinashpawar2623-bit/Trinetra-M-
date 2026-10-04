import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { firestore, firebaseConfigError } from '../lib/firebase';
import { EVENTS_COLLECTION, EVENT_LOG_LIMIT } from '../config/constants';

/** Convert a Firestore Timestamp / number / null into ms epoch. */
function toMillis(value, fallback) {
  if (value && typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value === 'number') return value;
  return fallback ?? null;
}

/**
 * Live list of the most recent events from Firestore, newest first.
 * Returns { events, loading, error }.
 */
export function useEvents(max = EVENT_LOG_LIMIT) {
  const [state, setState] = useState({ events: [], loading: true, error: null });

  useEffect(() => {
    if (!firestore) {
      setState({ events: [], loading: false, error: firebaseConfigError });
      return undefined;
    }

    const q = query(
      collection(firestore, EVENTS_COLLECTION),
      orderBy('timestamp', 'desc'),
      limit(max),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const events = snapshot.docs.map((doc) => {
          const d = doc.data({ serverTimestamps: 'estimate' });
          return {
            id: doc.id,
            type: d.type || 'unknown',
            label: d.label || null,
            confidence: typeof d.confidence === 'number' ? d.confidence : null,
            message: d.message || null,
            timestamp: toMillis(d.timestamp, d.clientTs),
          };
        });
        setState({ events, loading: false, error: null });
      },
      (err) => {
        setState({ events: [], loading: false, error: err?.message || 'Failed to load events' });
      },
    );

    return unsubscribe;
  }, [max]);

  return state;
}
