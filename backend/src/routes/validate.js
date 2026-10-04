import { Router } from 'express';

const router = Router();

const BOOL_FIELDS = ['mq2', 'mq6', 'flame'];
const DISTANCE_FIELDS = ['distanceFront', 'distanceRear'];
const NO_ECHO = 'no echo';

function isNum(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Validate a /rover/sensors payload. Returns a list of human-readable errors.
 * Ranges reflect sensor specs: HC-SR04 2-400 cm, DHT11 0-50 °C / 20-90 %
 * (with slack, since readings outside spec are still worth storing).
 */
export function validateSensors(data) {
  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) return ['Body must be a JSON object'];

  for (const f of BOOL_FIELDS) {
    if (typeof data[f] !== 'boolean') errors.push(`${f} must be a boolean`);
  }
  for (const f of DISTANCE_FIELDS) {
    const v = data[f];
    if (v === NO_ECHO) continue;
    if (!isNum(v) || v < 0 || v > 1000) errors.push(`${f} must be a number 0-1000 (cm) or "${NO_ECHO}"`);
  }
  if (!isNum(data.temperature) || data.temperature < -40 || data.temperature > 125) {
    errors.push('temperature must be a number between -40 and 125 (°C)');
  }
  if (!isNum(data.humidity) || data.humidity < 0 || data.humidity > 100) {
    errors.push('humidity must be a number between 0 and 100 (%)');
  }
  if (data.battery !== undefined && data.battery !== null && (!isNum(data.battery) || data.battery < 0 || data.battery > 100)) {
    errors.push('battery, if present, must be a number between 0 and 100 (%)');
  }
  return errors;
}

router.post('/', (req, res) => {
  const errors = validateSensors(req.body);
  res.status(errors.length ? 422 : 200).json({ valid: errors.length === 0, errors });
});

export default router;
