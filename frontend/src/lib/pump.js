/**
 * Fire-suppression display state.
 *
 * The pump's automatic behavior lives on the rover. This module only
 * describes telemetry the dashboard has actually received. A fire flag is
 * not treated as proof that the pump is running.
 */

export function deriveSuppression({ sensors, link }) {
  const fresh = link === 'live';
  // Fire is reported whenever the sensor says so, regardless of link freshness.
  // 'UNKNOWN' only when the field has never arrived (undefined/null).
  const flame = sensors?.flame;
  const pump = sensors?.pump;
  const reportedRuntime = typeof sensors?.pumpRuntimeS === 'number' ? sensors.pumpRuntimeS : null;

  let fire = 'UNKNOWN';
  if (flame === true) fire = 'DETECTED';
  else if (flame === false) fire = 'CLEAR';
  // If sensors exist but flame field is missing, treat as UNKNOWN
  // but if sensors is null entirely (no data yet) also UNKNOWN — that's fine.

  // Pump state is only meaningful when link is live (confirmed real-time reading).
  let pumpState = 'UNKNOWN';
  if (fresh && pump === true) pumpState = 'ON';
  else if (fresh && pump === false) pumpState = 'OFF';
  // If link is stale but we have a known pump value, still surface it as a hint.
  else if (!fresh && pump === true) pumpState = 'ON (stale)';
  else if (!fresh && pump === false) pumpState = 'OFF (stale)';

  const commsLost = link === 'disconnected' || link === 'stale' || link === 'invalid' || link === 'connecting';
  const pumpFault = sensors?.pumpFault === true;

  // System state: don't mark FAULT just because fire is UNKNOWN (no sensor data yet).
  // Only escalate to FAULT when we have confirmed fire but no pump, or comms are lost.
  let system = 'STANDBY';
  if (commsLost) system = 'FAULT';
  else if (pumpFault) system = 'FAULT';
  else if (fire === 'DETECTED' && (pumpState === 'ON' || pumpState === 'ON (stale)')) system = 'ACTIVE';
  else if (fire === 'DETECTED') system = 'SUPPRESSING'; // fire + pump unknown/off
  else if (pumpState === 'ON') system = 'FAULT'; // pump running with no fire
  else system = 'STANDBY';

  return {
    fire,
    pumpState,
    system,
    fresh,
    reportedRuntime,
    comms: link || 'disconnected',
  };
}

/**
 * Session timestamps for confirmed pump edges. Runtime here is only the time
 * this dashboard tab has continuously observed pump === true.
 */
export function reducePumpTimeline(state, { pump, link, now }) {
  const next = state || { pump: undefined, lastOnAt: null, lastOffAt: null, observedSince: null };
  if (link !== 'live' || (pump !== true && pump !== false)) {
    return { ...next, observedSince: pump === true ? next.observedSince : null };
  }
  if (pump === true && next.pump !== true) {
    return { pump: true, lastOnAt: now, lastOffAt: next.lastOffAt, observedSince: now };
  }
  if (pump === false && next.pump === true) {
    return { pump: false, lastOnAt: next.lastOnAt, lastOffAt: now, observedSince: null };
  }
  return { ...next, pump };
}

export function observedRuntimeMs(timeline, now) {
  if (!timeline?.observedSince) return null;
  return Math.max(0, now - timeline.observedSince);
}
