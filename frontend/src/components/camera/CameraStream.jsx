import { memo } from 'react';
import { PI_STREAM_URL } from '../../config/constants';

/**
 * Native MJPEG <img> — memo-wrapped so it NEVER re-renders unless the
 * stream URL or retryKey explicitly changes.
 *
 * WHY THIS MATTERS:
 *   The parent (CameraPanel) re-renders every 200 ms from WebSocket sensor
 *   updates. Without memo, every re-render unmounts+remounts the <img>, which
 *   closes and reopens the MJPEG TCP connection → visible stutter every 200 ms.
 *
 *   With memo, React skips re-rendering this subtree entirely when sensor state
 *   changes. The TCP connection stays open and the stream runs uninterrupted.
 *
 * The `key` prop on <img> (driven by retryKey) is the ONLY intentional remount —
 * it fires only when the user clicks Retry or the stream errors out.
 */
const CameraStream = memo(function CameraStream({ url, retryKey, onError, onLoad }) {
  const src = retryKey
    ? `${url}${url.includes('?') ? '&' : '?'}_r=${retryKey}`
    : url;

  return (
    <img
      key={`${url}-${retryKey}`}
      src={src}
      alt="TRINETRA Camera"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center',
        display: 'block',
        imageRendering: 'crisp-edges',
        WebkitImageRendering: 'crisp-edges',
        backgroundColor: '#000',
      }}
      onError={onError}
      onLoad={onLoad}
      draggable={false}
    />
  );
});

export default CameraStream;
