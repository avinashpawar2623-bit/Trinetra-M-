/** Live under 2s, stale through the existing 10s connection window, then disconnected. */
export const SENSOR_LIVE_MS = 2_000;
export const SENSOR_STALE_MS = 10_000;

export function classifyLink({ wsOpen, lastGoodAt, now, lastMessageInvalid = false }) {
  if (!wsOpen) return 'disconnected';
  if (!lastGoodAt && !lastMessageInvalid) return 'connecting';
  if (lastMessageInvalid) return 'invalid';
  const age = now - lastGoodAt;
  if (age <= SENSOR_LIVE_MS) return 'live';
  if (age <= SENSOR_STALE_MS) return 'stale';
  return 'disconnected';
}

export function frameFreshness(receivedAt, now, { liveMs = 1_000, staleMs = 3_000 } = {}) {
  if (!receivedAt) return 'unknown';
  const age = now - receivedAt;
  if (age <= liveMs) return 'live';
  if (age <= staleMs) return 'stale';
  return 'frozen';
}
