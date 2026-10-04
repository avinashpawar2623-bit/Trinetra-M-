import { DETECTION_COLORS, STALE_DETECTION_MS } from '../config/constants';

/**
 * True if the detection payload is recent enough to display.
 * Same clock-skew caveat as isRoverOnline(): the timestamp comes from the
 * companion device, `now` from the browser, so keep both NTP-synced.
 */
export function isDetectionFresh(detections, now) {
  if (!detections || detections.timestamp === null) return false;
  return now - detections.timestamp <= STALE_DETECTION_MS;
}

export function colorForLabel(label) {
  return DETECTION_COLORS[label] || DETECTION_COLORS.default;
}

/** [{label, count}] sorted by count desc, then label. */
export function countByLabel(objects) {
  const counts = new Map();
  for (const obj of objects) counts.set(obj.label, (counts.get(obj.label) || 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/** Naive English plural, good enough for COCO labels ("2 persons, 1 dog"). */
export function pluralize(label, count) {
  if (count === 1) return label;
  if (/(s|x|ch|sh)$/.test(label)) return `${label}es`;
  return `${label}s`;
}
