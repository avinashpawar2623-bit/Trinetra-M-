/**
 * Normalizers for raw RTDB payloads. They coerce types defensively so
 * components can rely on: boolean | null, number | null, or NO_ECHO.
 */
import { NO_ECHO } from '../config/constants';

export function toBool(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1' || value === 'true') return true;
  if (value === 0 || value === '0' || value === 'false') return false;
  return null;
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Distance is a number (cm), the NO_ECHO sentinel, or null when absent. */
export function toDistance(value) {
  if (typeof value === 'string' && value.trim().toLowerCase() === NO_ECHO) return NO_ECHO;
  return toNumber(value);
}

export function normalizeSensors(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    mq2: toBool(raw.mq2),
    mq6: toBool(raw.mq6),
    flame: toBool(raw.flame),
    distanceFront: toDistance(raw.distanceFront),
    distanceRear: toDistance(raw.distanceRear),
    temperature: toNumber(raw.temperature),
    humidity: toNumber(raw.humidity),
    battery: toNumber(raw.battery),
  };
}

export function normalizeStatus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    connected: toBool(raw.connected),
    lastSeen: toNumber(raw.lastSeen),
  };
}

/**
 * RTDB stores arrays as objects when keys are sparse, so accept both.
 * Invalid objects (bad bbox, missing label) are dropped.
 */
export function normalizeDetections(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const list = Array.isArray(raw.objects) ? raw.objects : Object.values(raw.objects || {});

  const objects = list
    .map((obj) => {
      if (!obj || typeof obj.label !== 'string') return null;
      const bbox = Array.isArray(obj.bbox) ? obj.bbox : Object.values(obj.bbox || {});
      const nums = bbox.map(toNumber);
      if (nums.length !== 4 || nums.some((n) => n === null)) return null;
      return { label: obj.label, confidence: toNumber(obj.confidence) ?? 0, bbox: nums };
    })
    .filter(Boolean);

  return {
    timestamp: toNumber(raw.timestamp),
    frameWidth: toNumber(raw.frameWidth) || 640,
    frameHeight: toNumber(raw.frameHeight) || 480,
    objects,
  };
}

export function normalizeCamera(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const url = typeof raw.streamUrl === 'string' ? raw.streamUrl.trim() : '';
  return { streamUrl: url || null };
}

// ── Pi FastAPI normalizers ────────────────────────────────────────────────────
// The Pi sends different field names than the Firebase schema.
// These remap Pi payloads → the shape components already expect.

/**
 * Normalizes the Pi /ws sensor payload into the same shape as normalizeSensors().
 * Pi fields:  mq2, mq6, flame, dist1_cm, dist2_cm, temp_c, humidity, fps
 * Output:     mq2, mq6, flame, distanceFront, distanceRear, temperature, humidity, fps
 * -1 from Pi means "no reading" — treat the same as null/NO_ECHO.
 */
export function normalizePiSensors(raw) {
  if (!raw || typeof raw !== 'object') return null;

  function piDist(v) {
    const n = toNumber(v);
    if (n === null) return null;
    return n < 0 ? NO_ECHO : n;
  }

  function piNum(v) {
    const n = toNumber(v);
    return n === null || n < 0 ? null : n;
  }

  return {
    mq2: toBool(raw.mq2),
    mq6: toBool(raw.mq6),
    flame: toBool(raw.flame),
    distanceFront: piDist(raw.dist1_cm),
    distanceRear: piDist(raw.dist2_cm),
    temperature: piNum(raw.temp_c),
    humidity: piNum(raw.humidity),
    fps: toNumber(raw.fps),
    battery: null, // Pi does not report battery
  };
}

/**
 * Synthesises rover status from the Pi /ws payload.
 * esp_connected == true means the ESP32 rover is reachable.
 * lastSeen is set to the current browser time on every message.
 */
export function normalizePiStatus(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    connected: toBool(raw.esp_connected),
    lastSeen: Date.now(),
  };
}

/**
 * Normalizes Pi YOLO detection objects.
 * Pi sends: { objects: [{class: string, conf: float}, ...] }
 * The detections hook expects: { timestamp, frameWidth, frameHeight, objects: [{label, confidence, bbox}] }
 * Pi does NOT send bboxes (the /ws endpoint only has class + conf),
 * so bbox is set to [0, 0, 0, 0] — the DetectionOverlay will draw nothing
 * but DetectionSummary will still show the class list correctly.
 * If the Pi sends a full bbox in future, add it here.
 */
export function normalizePiDetections(raw) {
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : (Array.isArray(raw?.objects) ? raw.objects : []);
  const objects = list
    .map((obj) => {
      if (!obj || typeof obj.class !== 'string') return null;
      return {
        label: obj.class,
        confidence: toNumber(obj.conf) ?? 0,
        bbox: [0, 0, 0, 0],
      };
    })
    .filter(Boolean);

  return {
    timestamp: Date.now(),
    frameWidth: 640,
    frameHeight: 480,
    objects,
  };
}
