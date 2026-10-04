import { Router } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const router = Router();
const CONNECT_TIMEOUT_MS = Number(process.env.CAMERA_CONNECT_TIMEOUT_MS) || 5000;

/**
 * GET /api/camera/stream
 * Proxies the rover's MJPEG stream (CAMERA_STREAM_URL) so an HTTPS dashboard
 * can show an HTTP camera without mixed-content blocking, and so the browser
 * never needs direct network access to the rover.
 *
 * Note: ESP32-CAM firmware usually serves ONE stream client at a time, so each
 * open dashboard tab (and the companion detector) competes for that slot.
 */
router.get('/stream', async (req, res) => {
  const upstreamUrl = process.env.CAMERA_STREAM_URL;
  if (!upstreamUrl) {
    return res.status(503).json({ error: 'CAMERA_STREAM_URL is not configured on the server' });
  }

  const controller = new AbortController();
  const connectTimer = setTimeout(() => controller.abort(new Error('connect timeout')), CONNECT_TIMEOUT_MS);

  // Viewer navigated away / closed the tab: stop pulling from the rover.
  const onClose = () => controller.abort(new Error('client disconnected'));
  res.on('close', onClose);

  let upstream;
  try {
    upstream = await fetch(upstreamUrl, { signal: controller.signal, headers: { Accept: 'multipart/x-mixed-replace, image/jpeg, */*' } });
  } catch (err) {
    clearTimeout(connectTimer);
    res.off('close', onClose);
    if (res.writableEnded || req.destroyed) return undefined;
    console.warn(`[camera] upstream connect failed: ${err.cause?.code || err.cause?.message || err.message}`);
    return res.status(502).json({ error: 'Camera stream unreachable' });
  }
  clearTimeout(connectTimer);

  if (!upstream.ok || !upstream.body) {
    controller.abort();
    res.off('close', onClose);
    console.warn(`[camera] upstream responded ${upstream.status}`);
    return res.status(502).json({ error: `Camera responded with HTTP ${upstream.status}` });
  }

  // Forward Content-Type verbatim: it carries the multipart boundary the browser needs.
  res.status(200);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'multipart/x-mixed-replace');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable buffering behind nginx
  res.flushHeaders();

  try {
    await pipeline(Readable.fromWeb(upstream.body), res);
  } catch (err) {
    // Aborts from client disconnect are expected; anything else is an upstream drop.
    if (!controller.signal.aborted) console.warn(`[camera] stream ended with error: ${err.message}`);
  } finally {
    res.off('close', onClose);
    if (!res.writableEnded) res.end();
  }
  return undefined;
});

export default router;
