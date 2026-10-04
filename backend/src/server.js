/**
 * TRINETRA backend: a thin API layer.
 *  - /api/health                  liveness + config info
 *  - /api/validate-sensor-data    schema check for sensor payloads
 *  - /api/camera/stream           MJPEG proxy (avoids mixed content / CORS)
 *  - serves frontend/dist with SPA fallback in production
 */
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthRouter from './routes/health.js';
import validateRouter from './routes/validate.js';
import cameraRouter from './routes/camera.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3001;
const isProduction = process.env.NODE_ENV === 'production';
const distDir = path.resolve(__dirname, process.env.FRONTEND_DIST || '../../frontend/dist');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '32kb' }));

app.use('/api/health', healthRouter);
app.use('/api/validate-sensor-data', validateRouter);
app.use('/api/camera', cameraRouter);

// Unknown API routes return JSON 404 rather than falling through to the SPA.
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));

if (isProduction) {
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir, { index: false, maxAge: '1h' }));
    // SPA fallback: any non-API GET returns index.html.
    app.get(/^(?!\/api\/).*/, (req, res) => {
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    console.warn(`[server] frontend build not found at ${distDir}. Run "npm run build" in /frontend.`);
  }
}

// Central error handler (e.g. malformed JSON bodies).
app.use((err, req, res, _next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[server] error:', err);
  if (res.headersSent) return res.end();
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

app.listen(PORT, () => {
  console.log(`[server] TRINETRA backend on http://localhost:${PORT} (${isProduction ? 'production' : 'development'})`);
  if (!process.env.CAMERA_STREAM_URL) console.log('[server] CAMERA_STREAM_URL not set; /api/camera/stream will return 503.');
});
