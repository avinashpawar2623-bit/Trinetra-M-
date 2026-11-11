import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    timestamp: Date.now(),
    cameraProxyConfigured: Boolean(process.env.CAMERA_STREAM_URL),
    controlGatewayConfigured: Boolean(process.env.PI_BASE_URL),
    authConfigured: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
  });
});

export default router;
