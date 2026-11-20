import { Router } from 'express';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { authenticateHeader } from '../roles.js';
import { verifyIdToken } from '../firebaseAdmin.js';

const router = Router();
const CONNECT_TIMEOUT_MS = Number(process.env.CAMERA_CONNECT_TIMEOUT_MS) || 5000;
const SNAPSHOT_TIMEOUT_MS = Number(process.env.CAMERA_SNAPSHOT_TIMEOUT_MS) || 2500;

function snapshotUrlFrom(streamUrl) {
  if (!streamUrl || !/\/stream(?=$|\?)/.test(streamUrl)) return '';
  return streamUrl.replace(/\/stream(?=$|\?)/, '/snapshot');
}

async function authorizeCamera(req) {
  if (process.env.CAMERA_PROXY_REQUIRE_AUTH !== 'true') return;
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const decoded = token ? await verifyIdToken(token) : null;
  authenticateHeader(header, decoded);
}

/** Read the newest complete JPEG, then drop the rest of the stream. */
async function readOneJpeg(streamUrl, signal) {
  const upstream = await fetch(streamUrl, {
    signal,
    headers: { Accept: 'multipart/x-mixed-replace, image/jpeg, */*' },
  });
  if (!upstream.ok || !upstream.body) {
    const err = new Error(`stream HTTP ${upstream.status}`);
    err.status = 502;
    throw err;
  }
  const reader = upstream.body.getReader();
  const parts = [];
  let total = 0;
  try {
    while (total < 1_500_000) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(Buffer.from(value));
      total += value.length;
      const buf = Buffer.concat(parts);
      const start = buf.indexOf(Buffer.from([0xff, 0xd8]));
      if (start < 0) continue;
      const end = buf.indexOf(Buffer.from([0xff, 0xd9]), start + 2);
      if (end > start) return buf.subarray(start, end + 2);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const err = new Error('no JPEG in camera stream');
  err.status = 502;
  throw err;
}

/**
 * GET /api/camera/stream
 * Proxies the rover's MJPEG stream (CAMERA_STREAM_URL) so an HTTPS dashboard
 * can show an HTTP camera without mixed-content blocking, and so the browser
 * never needs direct network access to the rover.
 *
 * Note: ESP32-CAM firmware usually serves ONE stream client at a time, so each
 * open dashboard tab (and the companion detector) competes for that slot.
 */
/**
 * GET /api/camera/snapshot
 * One JPEG, then the connection closes. The dashboard polls this so the
 * browser cannot build an MJPEG backlog and the Pi is free between frames
 * to take arm and drive commands.
 */
router.get('/snapshot', async (req, res) => {
  try {
    await authorizeCamera(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }

  const direct = process.env.CAMERA_SNAPSHOT_URL || snapshotUrlFrom(process.env.CAMERA_STREAM_URL);
  const streamUrl = process.env.CAMERA_STREAM_URL;
  if (!direct && !streamUrl) {
    return res.status(503).json({ error: 'CAMERA_STREAM_URL is not configured on the server' });
  }

  try {
    let jpeg = null;
    if (direct) {
      const controller = new AbortController();
      const directTimer = setTimeout(() => controller.abort(), SNAPSHOT_TIMEOUT_MS);
      try {
        const upstream = await fetch(direct, {
          signal: controller.signal,
          headers: { Accept: 'image/jpeg, */*' },
        });
        const type = upstream.headers.get('content-type') || '';
        if (upstream.ok && type.includes('image/jpeg') && upstream.body) {
          jpeg = Buffer.from(await upstream.arrayBuffer());
        }
      } catch {
        jpeg = null;
      } finally {
        clearTimeout(directTimer);
      }
    }
    if (!jpeg && streamUrl && streamUrl !== direct) {
      const grab = new AbortController();
      const grabTimer = setTimeout(() => grab.abort(), SNAPSHOT_TIMEOUT_MS);
      try {
        jpeg = await readOneJpeg(streamUrl, grab.signal);
      } finally {
        clearTimeout(grabTimer);
      }
    }
    if (!jpeg?.length) return res.status(502).json({ error: 'Camera snapshot unavailable' });
    res.status(200);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(jpeg);
  } catch (err) {
    if (res.headersSent) return undefined;
    const timeout = err?.name === 'AbortError' || err?.name === 'TimeoutError';
    return res.status(timeout ? 504 : (err.status || 502)).json({
      error: timeout ? 'Camera snapshot timed out' : 'Camera snapshot unreachable',
    });
  }
});

router.get('/stream', async (req, res) => {
  try {
    await authorizeCamera(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
  }

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
  res.socket?.setNoDelay(true);
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
