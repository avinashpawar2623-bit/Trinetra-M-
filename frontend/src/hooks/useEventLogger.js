import { useEffect, useRef } from 'react';
import {
  DETECTION_LOG_DEBOUNCE_MS,
  DETECTION_LOG_MIN_CONFIDENCE,
  FRONTEND_EVENT_LOGGING_ENABLED,
  PRIORITY_CLASSES,
} from '../config/constants';
import { isDetectionFresh } from '../lib/detections';
import { writeEvent } from '../lib/eventWriter';

const SENSOR_EVENTS = [
  { key: 'mq2', type: 'gas', label: 'MQ-2', message: 'Gas detected by MQ-2 sensor' },
  { key: 'mq6', type: 'gas', label: 'MQ-6', message: 'Gas detected by MQ-6 sensor' },
  { key: 'flame', type: 'flame', label: 'flame', message: 'Flame detected' },
];

/**
 * Writes hazard and priority-detection events to Firestore from the browser.
 *
 * Tradeoffs (see README "Detection logging"): this only runs while a
 * dashboard tab is open, and each open tab logs independently (duplicates).
 * The companion device or a backend writer is the better place for this; set
 * VITE_FRONTEND_EVENT_LOGGING=false once one exists.
 *
 * Debounce: at most one event per class/sensor per DETECTION_LOG_DEBOUNCE_MS.
 * Sensors log on a rising edge (not-detected -> detected); an alarm that is
 * already active when the dashboard opens counts as a rising edge.
 */
export function useEventLogger({ detections, sensors }) {
  const lastLoggedRef = useRef({});
  const prevSensorsRef = useRef({});

  // Returns true (and records the time) if `key` is outside its debounce window.
  function claim(key) {
    const now = Date.now();
    const last = lastLoggedRef.current[key] || 0;
    if (now - last < DETECTION_LOG_DEBOUNCE_MS) return false;
    lastLoggedRef.current[key] = now;
    return true;
  }

  function log(event) {
    writeEvent(event).catch((err) => console.error('Failed to log event:', err));
  }

  // Priority object detections.
  useEffect(() => {
    if (!FRONTEND_EVENT_LOGGING_ENABLED || !isDetectionFresh(detections, Date.now())) return;

    // Highest-confidence qualifying hit per priority class in this frame.
    const best = new Map();
    for (const obj of detections.objects) {
      if (!PRIORITY_CLASSES.includes(obj.label) || obj.confidence < DETECTION_LOG_MIN_CONFIDENCE) continue;
      if (!best.has(obj.label) || obj.confidence > best.get(obj.label).confidence) best.set(obj.label, obj);
    }

    for (const [label, obj] of best) {
      if (!claim(`detection:${label}`)) continue;
      const count = detections.objects.filter((o) => o.label === label).length;
      log({
        type: 'detection',
        label,
        confidence: obj.confidence,
        message: `${count} ${label}${count > 1 ? 's' : ''} detected (${Math.round(obj.confidence * 100)}%)`,
      });
    }
    // claim/log only touch refs and module functions.
  }, [detections]);

  // Gas / flame rising edges.
  useEffect(() => {
    if (!FRONTEND_EVENT_LOGGING_ENABLED || !sensors) return;
    for (const { key, type, label, message } of SENSOR_EVENTS) {
      const current = sensors[key] === true;
      const previous = prevSensorsRef.current[key] === true;
      if (current && !previous && claim(`${type}:${key}`)) log({ type, label, message });
      prevSensorsRef.current[key] = sensors[key];
    }
  }, [sensors]);
}
