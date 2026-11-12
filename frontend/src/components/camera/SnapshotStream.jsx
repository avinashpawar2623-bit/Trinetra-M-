import { useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';

/**
 * Low-latency snapshot poller.
 *
 * Instead of an MJPEG stream (which Tailscale Funnel buffers, adding 1–3 s of
 * lag), this component GETs /snapshot every `intervalMs` ms and swaps the
 * <img> src via a Blob URL.  Cuts perceived latency to ~100–200 ms.
 *
 * Props:
 *   snapshotUrl  — full URL for the snapshot endpoint (e.g. https://host/snapshot)
 *   intervalMs   — poll rate in ms (default 100 → ~10 fps)
 *   onFrame(url, ts) — called with the blob URL + timestamp on each frame
 *   onError()    — called on consecutive fetch failures (triggers fallback)
 */
export default function SnapshotStream({ snapshotUrl, intervalMs = 100, onFrame, onError }) {
  const onFrameRef  = useRef(onFrame);
  const onErrorRef  = useRef(onError);
  onFrameRef.current  = onFrame;
  onErrorRef.current  = onError;

  useEffect(() => {
    if (!snapshotUrl) return;

    let active     = true;
    let objectUrl  = null;
    let failCount  = 0;
    const MAX_FAIL = 5;

    async function fetchFrame() {
      if (!active) return;

      try {
        const headers = {};
        const user = auth?.currentUser;
        if (user) {
          try { headers.authorization = `Bearer ${await user.getIdToken()}`; } catch {}
        }

        const res = await fetch(
          `${snapshotUrl}${snapshotUrl.includes('?') ? '&' : '?'}_r=${Date.now()}`,
          { cache: 'no-store', headers },
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        if (!active) return;

        // Revoke previous blob URL to avoid memory leak
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        objectUrl = URL.createObjectURL(blob);

        onFrameRef.current?.(objectUrl, Date.now());
        failCount = 0;
      } catch {
        if (!active) return;
        failCount += 1;
        if (failCount >= MAX_FAIL) {
          onErrorRef.current?.();
          return; // stop polling — CameraPanel will handle retry/fallback
        }
      }

      if (active) setTimeout(fetchFrame, intervalMs);
    }

    fetchFrame();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [snapshotUrl, intervalMs]);

  return null;
}

