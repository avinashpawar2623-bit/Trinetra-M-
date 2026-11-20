import { useEffect, useRef } from 'react';

/**
 * Ultra-low-latency snapshot poller — CORS-free.
 *
 * WHY THIS APPROACH:
 *   fetch() to a cross-origin URL requires CORS headers on the Pi.
 *   <img src="..."> never requires CORS — the browser loads it natively.
 *
 * HOW IT WORKS:
 *   We create two hidden <img> elements (double buffer) and alternate which
 *   one is "loading" vs "visible". The moment onload fires, we swap src into
 *   the visible img ref. This gives:
 *     - Zero CORS issues (browser img loading, not fetch)
 *     - Zero flicker (new frame is fully decoded before swap)
 *     - True pipeline — the next request starts the moment the current one loads
 *     - No blob URLs / no memory management needed
 *
 * TIMING:
 *   The next frame is requested in onload (not in a setTimeout).
 *   This means frames arrive as fast as the Pi can serve them, not on a fixed
 *   interval. At Pi=10fps, RTT=100ms → ~10fps displayed.
 *
 * Props:
 *   imgRef       — React ref for the visible <img> element (driven directly)
 *   snapshotUrl  — full URL for /snapshot endpoint
 *   pauseMs      — minimum ms between frames so arm/drive posts can use the link
 *   onFrame(ts)  — called with timestamp on each displayed frame
 *   onError()    — called after MAX_FAIL consecutive failures
 */
export default function SnapshotStream({
  imgRef,
  snapshotUrl,
  retryKey = 0,
  pauseMs = 70,
  onFrame,
  onError,
}) {
  const onFrameRef = useRef(onFrame);
  const onErrorRef = useRef(onError);
  onFrameRef.current = onFrame;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!snapshotUrl || !imgRef?.current) return;

    let active    = true;
    let failCount = 0;
    const MAX_FAIL = 4;

    // Off-screen loader. No crossOrigin: that flag requires CORS and the Pi
    // often does not send it, which made every frame fail and fall back to
    // the buffered MJPEG stream.
    const loader = new Image();
    loader.decoding = 'async';
    loader.fetchPriority = 'low';

    function requestNext() {
      if (!active) return;
      // Cache-bust: append timestamp so proxy/CDN never serves a stale frame
      loader.src = `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}_r=${Date.now()}`;
    }

    loader.onload = () => {
      if (!active) return;
      failCount = 0;

      // Swap src: copy loader.src into visible img — zero-flicker because
      // loader.onload only fires after the JPEG is fully decoded.
      if (imgRef.current) {
        imgRef.current.src = loader.src;
        onFrameRef.current?.(Date.now());
      }

      // Request the next frame — after optional pause
      if (pauseMs > 0) {
        setTimeout(requestNext, pauseMs);
      } else {
        requestNext();
      }
    };

    loader.onerror = () => {
      if (!active) return;
      failCount += 1;
      if (failCount >= MAX_FAIL) {
        onErrorRef.current?.();
        return;
      }
      // Brief back-off on error (50ms * fail count, max 1s)
      setTimeout(requestNext, Math.min(50 * failCount, 1000));
    };

    // Kick off the first request
    requestNext();

    return () => {
      active = false;
      loader.onload  = null;
      loader.onerror = null;
      loader.src = ''; // cancel any in-flight load
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotUrl, pauseMs, imgRef, retryKey]);

  return null;
}
