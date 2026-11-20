import { memo } from 'react';

/**
 * Native MJPEG <img> stream.
 *
 * Rules that keep this lag-free:
 *  1. memo() — React never re-renders this unless `url` changes.
 *     The parent re-renders every 200ms from WebSocket; without memo every
 *     re-render would remount the <img>, closing and reopening the MJPEG TCP
 *     connection → visible stutter.
 *  2. No `key` prop on the <img> — a changing key forces a DOM remount which
 *     is identical to a src change. The browser handles the MJPEG stream
 *     entirely in its C++ network stack once the <img> is mounted.
 *  3. url is a module-level constant from env — never reconstructed inside
 *     a render function, so memo's shallow comparison always returns equal.
 */
const CameraStream = memo(function CameraStream({ url }) {
  return (
    <img
      src={url}
      alt="live"
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        objectPosition: 'center',
        display: 'block',
        backgroundColor: '#000',
      }}
      draggable={false}
    />
  );
});

export default CameraStream;
