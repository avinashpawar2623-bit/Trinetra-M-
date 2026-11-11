import { useEffect, useState } from 'react';
import { getControlStats, subscribeControlStats } from '../lib/controlClient';

export function useControlStats() {
  const [stats, setStats] = useState(getControlStats);
  useEffect(() => subscribeControlStats(setStats), []);
  return stats;
}
