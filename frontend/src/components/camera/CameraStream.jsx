import { memo } from 'react';
import { PI_STREAM_URL } from '../../config/constants';

/**
 * Module-level constant — built once at import time, never changes.
 * Because the url prop is always === STREAM_URL, React's memo() shallow-compare
 * always returns "equal" → CameraStream NEVER re-renders after initial mount.
 * The browser owns the MJPEG TCP connection in its C++ network stack.
 */
export const STREAM_URL = PI_STREAM_URL;

/**
 * Lag-free native MJPEG <img>.
 *
 * Rules that make this work:
 *  1. memo() — skips re-render when url prop is the same reference.
 *  2. No key prop — a changing key forces a full DOM remount (= TCP reconnect = stutter).
 *  3. No onError / onLoad / retryKey — zero extra props that could change.
 *  4. No hooks — no useState, no useEffect, no useCallback.
 *  5. url comes from the module-level STREAM_URL constant → never changes.
 */
const CameraStream = memo(function CameraStream({ url }) {
  return (
    <img
      src={url}
      alt="live feed"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center',
        display: 'block',
        background: '#000',
      }}
      draggable={false}
    />
  );
});

export default CameraStream;
