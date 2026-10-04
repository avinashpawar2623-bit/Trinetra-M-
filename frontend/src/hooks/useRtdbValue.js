import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { rtdb, firebaseConfigError } from '../lib/firebase';

/**
 * Subscribe to a Realtime Database path with onValue.
 * Returns { data, loading, error }. `data` is null when the node is absent.
 * An optional `transform` normalizes the raw snapshot value.
 */
export function useRtdbValue(path, transform) {
  const [state, setState] = useState({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!rtdb) {
      setState({ data: null, loading: false, error: firebaseConfigError });
      return undefined;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    const unsubscribe = onValue(
      ref(rtdb, path),
      (snapshot) => {
        const raw = snapshot.exists() ? snapshot.val() : null;
        setState({ data: transform ? transform(raw) : raw, loading: false, error: null });
      },
      (err) => {
        setState({ data: null, loading: false, error: err?.message || 'Failed to read data' });
      },
    );

    return unsubscribe;
    // `transform` must be a stable (module-level) function; it is not a dependency.
  }, [path]);

  return state;
}
