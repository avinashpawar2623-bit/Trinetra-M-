/**
 * One in-flight hardware command. A newer command replaces anything not yet
 * sent, so released keys cannot leave an old move waiting in a queue.
 * Priority (stop) aborts the current request and is sent next.
 */
export function createCommandGate({ timeoutMs = 350, send, onUpdate }) {
  let pending = null;
  let inflight = false;
  let currentAbort = null;
  let timeout = timeoutMs;
  const stats = {
    lastRttMs: null,
    lastAckAt: null,
    lastStatus: null,
    lastError: null,
    upstreamRttMs: null,
    timeoutMs: timeout,
    inFlight: false,
    sent: 0,
    coalesced: 0,
    timeouts: 0,
  };

  function setTimeoutMs(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 100 || n > 2000) return;
    timeout = n;
    stats.timeoutMs = n;
  }

  async function pump() {
    if (inflight || !pending) return;
    inflight = true;
    stats.inFlight = true;
    const job = pending;
    pending = null;
    const controller = new AbortController();
    currentAbort = controller;
    const timer = setTimeout(() => controller.abort(), timeout);
    const started = Date.now();
    try {
      const result = await send(job.body, { signal: controller.signal });
      stats.lastRttMs = Date.now() - started;
      stats.upstreamRttMs = Number.isFinite(result?.upstreamRttMs) ? result.upstreamRttMs : null;
      stats.lastStatus = result?.status ?? 0;
      stats.lastError = result?.ok ? null : (result?.error || `HTTP ${stats.lastStatus}`);
      if (result?.ok) stats.lastAckAt = Date.now();
      stats.sent += 1;
    } catch (err) {
      stats.lastRttMs = Date.now() - started;
      const aborted = err?.name === 'AbortError' || err?.name === 'TimeoutError';
      stats.lastError = aborted ? 'timeout' : (err?.message || 'failed');
      stats.lastStatus = err?.status || 0;
      if (aborted) stats.timeouts += 1;
    } finally {
      clearTimeout(timer);
      if (currentAbort === controller) currentAbort = null;
      inflight = false;
      stats.inFlight = false;
      onUpdate?.(stats);
      if (pending) pump();
    }
  }

  function submit(body, { priority = false } = {}) {
    if (inflight || pending) stats.coalesced += 1;
    pending = { body };
    if (priority && currentAbort) currentAbort.abort();
    pump();
  }

  return { submit, setTimeoutMs, stats };
}
