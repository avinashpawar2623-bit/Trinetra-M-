/**
 * Central configuration for the TRINETRA dashboard.
 * All thresholds, timeouts, and tunables live here so behavior can be
 * adjusted without hunting through components.
 */
import { buildPiConfig, normalizeBaseUrl, resolveApiUrl } from '../lib/apiConfig';

export { resolveApiUrl };

const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || '');
export const API_BASE_URL = API_BASE;
/**
 * Absolute URL for the Express backend health endpoint, or null when
 * VITE_API_BASE_URL is not set. Components MUST check for null before fetching —
 * a relative '/api/health' would hit Vercel and return 404.
 */
export const API_HEALTH_URL = API_BASE ? resolveApiUrl('api/health', API_BASE) : null;

// ---- Raspberry Pi FastAPI backend -----------------------------------------
/**
 * Set VITE_PI_HOST in frontend/.env to the Pi's IP or Tailscale hostname.
 * Example: VITE_PI_HOST=100.64.0.5  or  VITE_PI_HOST=my-pi.local
 */
const piConfig = buildPiConfig({
  host: import.meta.env.VITE_PI_HOST,
  port: import.meta.env.VITE_PI_PORT,
});
/** Base HTTP URL for the Pi FastAPI (GET /sensors, POST /control, etc.). */
export const PI_BASE_URL = piConfig.baseUrl;
/** WebSocket URL for real-time push (/ws sends data every 500 ms). */
export const PI_WS_URL = piConfig.wsUrl;
/** MJPEG stream URL — used directly as <img src={...} />. */
export const PI_STREAM_URL = piConfig.streamUrl;
/**
 * Initial WebSocket reconnect delay (ms). Doubles on each failure:
 *   attempt 0 → 500 ms, 1 → 1 s, 2 → 2 s, … capped at PI_WS_MAX_RECONNECT_MS.
 * Override with VITE_WS_RECONNECT_MS in .env.
 */
export const PI_WS_RECONNECT_MS = Number(import.meta.env.VITE_WS_RECONNECT_MS || 500);
/** Hard ceiling for exponential backoff. Override with VITE_WS_MAX_RECONNECT_MS. */
export const PI_WS_MAX_RECONNECT_MS = Number(import.meta.env.VITE_WS_MAX_RECONNECT_MS || 30_000);

// ---- RTDB paths -----------------------------------------------------------
export const RTDB_PATHS = {
  sensors: 'rover/sensors',
  status: 'rover/status',
  detections: 'rover/detections',
  camera: 'rover/camera',
};

// ---- Firestore ------------------------------------------------------------
export const EVENTS_COLLECTION = 'events';
export const EVENT_LOG_LIMIT = 25;

// ---- Connection / staleness ----------------------------------------------
/** Rover is considered disconnected if lastSeen is older than this. */
export const STALE_STATUS_MS = 10_000;
/** Detection payloads older than this are hidden (prevents ghost boxes). */
export const STALE_DETECTION_MS = 2_000;
/** How often time-based checks (banner, stale detections) re-evaluate. */
export const CLOCK_TICK_MS = 1_000;

// ---- Temperature (°C) -----------------------------------------------------
// value < warning => normal, warning <= value < danger => warning, >= danger => danger
// Pi spec: temp_c > 60 => WARNING (disaster environment alert)
export const TEMP_THRESHOLDS = {
  warning: 60,  // > 60°C → amber warning
  danger:  75,  // > 75°C → red danger
};

// ---- Humidity (%) ---------------------------------------------------------
// Outside [low, high] => warning; outside [criticalLow, criticalHigh] => danger
export const HUMIDITY_THRESHOLDS = {
  criticalLow: 10,
  low: 20,
  high: 80,
  criticalHigh: 90,
};

// ---- Distance (HC-SR04) ---------------------------------------------------
/** Value the ESP32 sends when the ultrasonic sensor gets no echo. */
export const NO_ECHO = 'no echo';
/** Full-scale value for the distance bar gauge (HC-SR04 range is ~400 cm). */
export const DISTANCE_MAX_CM = 400;
/** Obstacle closer than this is shown as danger / warning. */
export const DISTANCE_THRESHOLDS = {
  danger: 30,   // < 30 cm → red (obstacle warning)
  warning: 50,  // < 50 cm → amber
};

// ---- Battery (%) ----------------------------------------------------------
export const BATTERY_THRESHOLDS = {
  danger: 15,
  warning: 30,
};

// ---- Camera ---------------------------------------------------------------
/** '4/3' (ESP32-CAM default VGA) or '16/9'. */
export const CAMERA_ASPECT_RATIO = '4/3';
/** Backend proxy endpoint for the MJPEG stream. */
export const CAMERA_PROXY_PATH = resolveApiUrl('api/camera/stream', API_BASE_URL);
/**
 * Force using the backend proxy even if RTDB/env supply a direct URL.
 * Useful when the dashboard is served over HTTPS (mixed-content) or
 * the camera is on a private network only the backend can reach.
 */
export const FORCE_CAMERA_PROXY = import.meta.env.VITE_FORCE_CAMERA_PROXY === 'true';

// ---- Detection overlay ----------------------------------------------------
export const DETECTION_COLORS = {
  person: '#ef4444', // red
  default: '#3b82f6', // blue
};
export const OVERLAY_MIN_CONFIDENCE = 0.3;

// ---- 3D rover view --------------------------------------------------------
export const ROVER3D = {
  /** Horizontal FOV of the rover camera; maps bbox center x to a bearing. */
  cameraFovDeg: 60,
  /** Marker range (scene units) when no front distance reading is available. */
  defaultMarkerRange: 2.5,
  /** Scene length of a distance cone at DISTANCE_MAX_CM. */
  coneMaxLength: 4,
  autoRotate: true,
  maxPixelRatio: 2,
  /** 'auto' | 'high' | 'low'. Auto picks low on touch / low-memory / reduced-motion devices. */
  defaultQuality: 'auto',
  /** Past detection positions kept per class for trails. */
  trailLength: 20,
  /** Max live particles per effect (flame, smoke, dust scale from this). */
  particleCount: { high: 300, low: 75 },
  /** Only pixels brighter than `threshold` glow (LEDs, flames, lenses, beacon). */
  bloom: { strength: 0.75, radius: 0.45, threshold: 0.82 },
  presetTweenMs: 600,
  /** Rubble-free radius around the rover (scene units ~ meters). */
  clearRadius: 3,
};

// ---- Detection logging ----------------------------------------------------
/** Classes that generate a Firestore event when detected. */
export const PRIORITY_CLASSES = ['person'];
/** Minimum confidence required to log a priority detection. */
export const DETECTION_LOG_MIN_CONFIDENCE = 0.6;
/** Max 1 logged event per class (or sensor) per this window. */
export const DETECTION_LOG_DEBOUNCE_MS = 10_000;
/**
 * Set false if a backend / companion writer handles event logging,
 * so the frontend doesn't produce duplicates.
 */
export const FRONTEND_EVENT_LOGGING_ENABLED =
  import.meta.env.VITE_FRONTEND_EVENT_LOGGING !== 'false';
