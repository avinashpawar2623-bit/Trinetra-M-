/**
 * Fire-suppression display state.
 *
 * The pump's automatic behavior lives on the rover. This module only
 * describes telemetry the dashboard has actually received. A fire flag is
 * not treated as proof that the pump is running.
 */

export function deriveSuppression({ sensors, link }) {
  const fresh = link === 'live';
  const flame = sensors?.flame;
  const pump = sensors?.pump;
  const reportedRuntime = typeof sensors?.pumpRuntimeS === 'number' ? sensors.pumpRuntimeS : null;

  let fire = 'UNKNOWN';
  if (flame === true) fire = 'DETECTED';
  else if (flame === false) fire = 'CLEAR';

  let pumpState = 'UNKNOWN';
  if (fresh && pump === true) pumpState = 'ON';
  else if (fresh && pump === false) pumpState = 'OFF';

  const commsLost = link === 'disconnected' || link === 'stale' || link === 'invalid' || link === 'connecting';
  const pumpFault = sensors?.pumpFault === true;
  const pumpInvalid = fresh && pump === null;

  let system = 'STANDBY';
  if (commsLost || pumpFault || pumpInvalid || fire === 'UNKNOWN') system = 'FAULT';
  else if (fire === 'DETECTED' && pumpState === 'ON') system = 'ACTIVE';
  else if (fire === 'DETECTED') system = 'FAULT';
  else if (pumpState === 'ON') system = 'FAULT';
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
