/**
 * TRINETRA backend: a thin API layer.
 *  - /api/health                  liveness + config info
 *  - /api/validate-sensor-data    schema check for sensor payloads
 *  - /api/camera/stream           MJPEG proxy (avoids mixed content / CORS)
 *  - /api/control                 admin-only drive proxy to the existing Pi API
 *  - /api/arm_control             admin-only arm proxy
 *  - /api/setmode                 admin-only mode proxy
 *  - serves frontend/dist with SPA fallback in production
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.js';
import validateRouter from './routes/validate.js';
import cameraRouter from './routes/camera.js';
import { createControlRouter } from './routes/control.js';
import { forwardToPi } from './piForward.js';
import { revokeUserSessions, verifyIdToken } from './firebaseAdmin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(overrides = {}) {
  const verify = overrides.verify || verifyIdToken;
  const forward = overrides.forward || forwardToPi;
  const revoke = overrides.revoke || revokeUserSessions;
  const timeoutMs = overrides.timeoutMs || Number(process.env.COMMAND_TIMEOUT_MS) || 350;
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, process.env.FRONTEND_DIST || '../../frontend/dist');

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/health', healthRouter);
  app.use('/api/validate-sensor-data', validateRouter);
  app.use('/api/camera', cameraRouter);
  app.use('/api', createControlRouter({ verify, forward, revoke, timeoutMs }));

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

  if (isProduction) {
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false, maxAge: '1h' }));
      app.get(/^(?!\/api\/).*/, (req, res) => {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(distDir, 'index.html'));
      });
    } else {
      console.warn(`[server] frontend build not found at ${distDir}. Run "npm run build" in /frontend.`);
    }
  }

  app.use((err, req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error('[server] error:', err);
    if (res.headersSent) return res.end();
    res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
  });

  return app;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 3001;
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] TRINETRA backend on http://localhost:${PORT} (${process.env.NODE_ENV === 'production' ? 'production' : 'development'})`);
    if (!process.env.CAMERA_STREAM_URL) console.log('[server] CAMERA_STREAM_URL not set; /api/camera/stream will return 503.');
    if (!process.env.PI_BASE_URL) console.log('[server] PI_BASE_URL not set; motor commands will fail closed.');
  });
}
