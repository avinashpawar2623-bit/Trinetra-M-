import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptimeSec: Math.round(process.uptime()),
    timestamp: Date.now(),
    cameraProxyConfigured: Boolean(process.env.CAMERA_STREAM_URL),
  });
});

export default router;
