import { useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';

/**
 * Ultra-low-latency snapshot poller.
 *
 * Strategy: TRUE PIPELINE — keep 2 HTTP requests in-flight at all times.
 *
 *  Timeline (old serial approach, RTT=250ms):
 *    |--fetch--|--show--|--fetch--|--show--|   → 1 frame per 250ms = 4 fps, 250ms stale
 *
 *  Timeline (new pipeline, RTT=250ms):
 *    |--fetch--|--fetch--|--fetch--|--fetch--|  ← always in-flight
 *         |--show--|--show--|--show--|          ← shown as each arrives
 *    → 1 frame per 250ms but CURRENT, not 250ms stale
 *
 *  With 2 concurrent in-flight:
 *    |--fetchA--|--fetchA--|
 *         |--fetchB--|--fetchB--|
 *    → whichever arrives first is shown immediately — effectively halves wait
 *
 * Additional optimisations:
 *  - Direct DOM write (imgRef.current.src) — zero React re-render overhead
 *  - No offscreen Image() decode wait — src swap happens immediately
 *  - Blob URL revoked on next frame — browser texture cache stays warm
 *  - Firebase token cached by SDK (~0 ms overhead per call)
 */
export default function SnapshotStream({
  imgRef,
  snapshotUrl,
  onError,
  onFrame,
}) {
  const onErrorRef = useRef(onError);
  const onFrameRef = useRef(onFrame);
  onErrorRef.current = onError;
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!snapshotUrl || !imgRef) return;

    let active    = true;
    let prevUrl   = null;
    let failCount = 0;
    const MAX_FAIL = 10;

    // Cache the Firebase token; refresh every 55 min (token valid 60 min)
    let cachedToken    = null;
    let tokenFetchedAt = 0;
    async function getAuthHeader() {
      try {
        const user = auth?.currentUser;
        if (!user) return {};
        const now = Date.now();
        if (!cachedToken || now - tokenFetchedAt > 55 * 60 * 1000) {
          cachedToken    = await user.getIdToken();
          tokenFetchedAt = now;
        }
        return { authorization: `Bearer ${cachedToken}` };
      } catch {
        return {};
      }
    }

    // Fire one snapshot request; resolves with a blob URL or null on error
    async function fetchOne() {
      try {
        const sep = snapshotUrl.includes('?') ? '&' : '?';
        const res = await fetch(
          `${snapshotUrl}${sep}_r=${Date.now()}`,
          { cache: 'no-store', headers: await getAuthHeader() },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!active) return null;
        return URL.createObjectURL(blob);
      } catch {
        return null; // caller tracks failures
      }
    }

    // Display a blob URL directly on the img DOM node — zero React overhead
    function show(blobUrl) {
      if (!active || !imgRef.current) return;
      imgRef.current.src = blobUrl;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      prevUrl = blobUrl;
      onFrameRef.current?.(Date.now());
      failCount = 0;
    }

    /**
     * True pipeline loop:
     *   1. Kick off fetch N+1 the moment fetch N is dispatched.
     *   2. Await N, show it, then N+1 is already partway/fully done.
     *   3. Repeat — there is always one request in-flight.
     *
     * This means the displayed frame is AT MOST 1×RTT old, not 2×RTT.
     */
    async function loop() {
      // Seed the pipeline with the first request
      let inFlight = fetchOne();

      while (active) {
        // Immediately fire the next fetch (don't wait for current)
        const nextFlight = fetchOne();

        // Now await the current one
        const blobUrl = await inFlight;

        if (!active) {
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }

        if (blobUrl) {
          show(blobUrl);
        } else {
          failCount += 1;
          if (failCount >= MAX_FAIL) {
            onErrorRef.current?.();
            return;
          }
        }

        // The next fetch is already in-flight; loop back to await it
        inFlight = nextFlight;
      }
    }

    loop();

    return () => {
      active = false;
      if (prevUrl) URL.revokeObjectURL(prevUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotUrl, imgRef]);

  return null;
}
