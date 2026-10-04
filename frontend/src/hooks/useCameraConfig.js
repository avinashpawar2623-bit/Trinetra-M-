import { PI_STREAM_URL, CAMERA_PROXY_PATH, FORCE_CAMERA_PROXY, RTDB_PATHS } from '../config/constants';
import { normalizeCamera } from '../lib/normalize';
import { useRtdbValue } from './useRtdbValue';

/**
 * Resolve the MJPEG stream URL. Priority:
 *   1. FORCE_CAMERA_PROXY → always use backend proxy
 *   2. /rover/camera/streamUrl in RTDB (dynamic override without redeploying)
 *   3. VITE_CAMERA_STREAM_URL env var
 *   4. PI_STREAM_URL  ← http://<VITE_PI_HOST>:8000/stream  (new default)
 *   5. Backend proxy (/api/camera/stream) — last resort
 */
export function useCameraConfig() {
  // We still subscribe to RTDB so the RTDB override path keeps working.
  // When Firebase is not configured rtdb is null and useRtdbValue returns error
  // immediately — the fallback chain below handles it gracefully.
  const { data, loading, error } = useRtdbValue(RTDB_PATHS.camera, normalizeCamera);

  if (FORCE_CAMERA_PROXY) {
    return { streamUrl: CAMERA_PROXY_PATH, source: 'proxy', loading: false, error: null };
  }

  if (!loading && data?.streamUrl) {
    return { streamUrl: data.streamUrl, source: 'rtdb', loading: false, error: null };
  }

  if (import.meta.env.VITE_CAMERA_STREAM_URL) {
    return { streamUrl: import.meta.env.VITE_CAMERA_STREAM_URL, source: 'env', loading: false, error: null };
  }

  // Default: Pi MJPEG stream
  return { streamUrl: PI_STREAM_URL, source: 'pi', loading: false, error: null };
}
