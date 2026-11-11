export async function forwardToPi(pathname, body, timeoutMs) {
  const base = process.env.PI_BASE_URL;
  if (!base) {
    const err = new Error('PI_BASE_URL is not configured');
    err.status = 503;
    throw err;
  }
  const started = Date.now();
  const response = await fetch(new URL(pathname, base.endsWith('/') ? base : `${base}/`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { ok: response.ok, status: response.status, rttMs: Date.now() - started };
}
