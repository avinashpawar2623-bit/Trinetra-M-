import { useEffect, useState } from 'react';
import { CLOCK_TICK_MS } from '../config/constants';

/**
 * Returns the current client time (ms), re-rendering every `intervalMs`.
 * Used for time-based checks (stale connection, stale detections) that must
 * update even when no new data arrives.
 */
export function useNow(intervalMs = CLOCK_TICK_MS) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
