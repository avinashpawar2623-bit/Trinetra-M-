import { Router } from 'express';
import { authenticateHeader } from '../roles.js';
import { sanitizeArm, sanitizeDrive, sanitizeMode } from '../validateCommand.js';
import { auditPrivileged, auditSnapshot, noteAuthFailure } from '../audit.js';

async function readUser(req, verify) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  let decoded = null;
  if (token) {
    try {
      decoded = await verify(token);
    } catch (err) {
      err.status = err.status || 401;
      throw err;
    }
  }
  return authenticateHeader(header, decoded);
}

function requireAdmin(verify) {
  return async (req, res, next) => {
    try {
      const user = await readUser(req, verify);
      if (user.role !== 'admin') {
        noteAuthFailure(user.uid, `${req.method} ${req.path}`);
        return res.status(403).json({ error: 'Admin role required' });
      }
      req.user = user;
      return next();
    } catch (err) {
      noteAuthFailure(null, `${req.method} ${req.path}`);
      return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
    }
  };
}

let lastMotionAudit = 0;

async function proxy(req, res, { pathname, sanitize, forward, timeoutMs }) {
  const cleaned = sanitize(req.body);
  if (cleaned.error) return res.status(400).json({ error: cleaned.error });
  const started = Date.now();
  try {
    const upstream = await forward(pathname, cleaned.value, timeoutMs);
    const motion = pathname === '/control' && cleaned.value.estop !== true;
    const now = Date.now();
    const shouldAudit = !motion || now - lastMotionAudit > 2000;
    if (motion) lastMotionAudit = now;
    if (shouldAudit) {
      auditPrivileged({
        uid: req.user.uid,
        action: pathname,
        allowed: true,
        detail: `upstream=${upstream.status}`,
      });
    }
    return res.status(upstream.ok ? 200 : upstream.status).json({
      ok: upstream.ok,
      upstreamStatus: upstream.status,
      upstreamRttMs: upstream.rttMs,
      gatewayMs: Date.now() - started,
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    auditPrivileged({
      uid: req.user.uid,
      action: pathname,
      allowed: false,
      detail: timeout ? 'timeout' : 'upstream-failed',
    });
    return res.status(timeout ? 504 : (err.status || 502)).json({
      error: timeout ? 'Rover command timed out' : 'Rover command was not delivered',
    });
  }
}

export function createControlRouter({ verify, forward, revoke, timeoutMs }) {
  const router = Router();
  const admin = requireAdmin(verify);

  router.post('/control', admin, (req, res) => proxy(req, res, { pathname: '/control', sanitize: sanitizeDrive, forward, timeoutMs }));
  router.post('/arm_control', admin, (req, res) => proxy(req, res, { pathname: '/arm_control', sanitize: sanitizeArm, forward, timeoutMs }));
  router.post('/setmode', admin, (req, res) => proxy(req, res, { pathname: '/setmode', sanitize: sanitizeMode, forward, timeoutMs }));

  // Control is not a WebSocket. Viewers are rejected before this handler.
  router.all('/control/stream', admin, (req, res) => {
    res.status(405).json({ error: 'Motor commands use authorized HTTP requests, not a control socket.' });
  });

  router.get('/diagnostics', admin, (req, res) => {
    res.json(auditSnapshot());
  });

  router.post('/session/logout', async (req, res) => {
    try {
      const user = await readUser(req, verify);
      await revoke(user.uid);
      auditPrivileged({ uid: user.uid, action: 'logout', allowed: true });
      return res.status(204).end();
    } catch (err) {
      noteAuthFailure(null, 'logout');
      return res.status(err.status || 401).json({ error: err.message || 'Unauthorized' });
    }
  });

  return router;
}
