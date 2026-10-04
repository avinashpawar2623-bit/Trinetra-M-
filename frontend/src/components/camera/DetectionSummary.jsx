import { colorForLabel } from '../../lib/detections';

/**
 * DetectionList — Shows each detected object on its own line below the camera.
 * Format: [color dot] [class] [confidence%]
 *
 * Replaces the old grouped "2 persons, 1 dog" pill layout with a clean list
 * that doesn't overlap the video.
 */
export default function DetectionSummary({ objects, fresh, hasPayload, error }) {
  if (error)       return <p className="text-xs text-red-300">Detection feed error: {error}</p>;
  if (!hasPayload) return <p className="text-xs text-slate-500">No detection data yet (is the companion detector running?).</p>;
  if (!fresh)      return <p className="text-xs text-slate-500">Detections stale, waiting for the companion device…</p>;
  if (!objects.length) return <p className="text-xs text-slate-400">No objects detected.</p>;

  return (
    <ul className="detection-list" aria-label="Detected objects">
      {objects.map((obj, i) => {
        const color = colorForLabel(obj.label);
        const pct   = Math.round(obj.confidence * 100);
        return (
          <li key={i} className="detection-list-item">
            {/* Color icon dot */}
            <span
              className="detection-dot"
              style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
              aria-hidden="true"
            />
            {/* Class name */}
            <span className="detection-class">{obj.label}</span>
            {/* Confidence badge */}
            <span className="detection-conf" style={{ color }}>
              {pct}%
            </span>
          </li>
        );
      })}
    </ul>
  );
}
