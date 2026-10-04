/**
 * MJPEG stream rendered in a plain <img>. Browsers natively decode
 * multipart/x-mixed-replace streams, so no player library is needed.
 * `retryKey` is appended as a cache-busting param so Retry forces a new request.
 */
function withCacheBuster(url, key) {
  if (!key) return url;
  return `${url}${url.includes('?') ? '&' : '?'}_r=${key}`;
}

export default function CameraStream({ url, retryKey, onError, onLoad }) {
  return (
    <img
      key={`${url}-${retryKey}`}
      src={withCacheBuster(url, retryKey)}
      alt="Live rover camera stream"
      className="absolute inset-0 h-full w-full object-contain"
      onError={onError}
      onLoad={onLoad}
      draggable={false}
    />
  );
}
