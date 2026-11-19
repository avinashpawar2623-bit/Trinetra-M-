import { useEffect, useMemo, useRef, useState } from 'react';
import { CAMERA_ASPECT_RATIO, OVERLAY_MIN_CONFIDENCE, PI_SNAPSHOT_URL } from '../../config/constants';
import { useCameraConfig } from '../../hooks/useCameraConfig';
import { useFullscreen } from '../../hooks/useFullscreen';
import { usePiApi } from '../../hooks/usePiApi';
import { isDetectionFresh } from '../../lib/detections';
import { frameFreshness } from '../../lib/telemetry';
import CameraStream from './CameraStream';
import LatestFrameStream from './LatestFrameStream';
import SnapshotStream from './SnapshotStream';
import DetectionOverlay from './DetectionOverlay';
import DetectionSummary from './DetectionSummary';
import CameraOffline from './CameraOffline';
import LoadingState from '../layout/LoadingState';

const EMPTY = [];

function sameOrigin(url) {
  if (!url) return false;
  if (url.startsWith('/')) return true;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Live camera, detection overlay, and stream health.
 *
 * Camera mode selection (in priority order):
 *  1. Snapshot polling  — cross-origin URL + PI_SNAPSHOT_URL available
 *                         Direct DOM img swap, pipelined fetches. Best for Tailscale Funnel.
 *  2. LatestFrameStream — same-origin MJPEG, deframed in JS, keeps only newest frame.
 *  3. CameraStream      — plain <img src={mjpegUrl}>, browser native decode.
 */
export default function CameraPanel({ detections, now, onStreamStatus }) {
  const camera = useCameraConfig();
  const containerRef   = useRef(null);
  const snapshotImgRef = useRef(null); // used by SnapshotStream for direct DOM writes

  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(containerRef);
  const { sensors: piSensors } = usePiApi();
  const fps = piSensors?.data?.fps ?? null;

  const [showOverlay, setShowOverlay] = useState(true);
  const [retryKey, setRetryKey]       = useState(0);
  const [failedKey, setFailedKey]     = useState(null);
  const [reconnects, setReconnects]   = useState(0);
  const [mode, setMode]               = useState('img');

  // LatestFrameStream / fallback img state (not used in snapshot mode)
  const [frameUrl, setFrameUrl] = useState(null);
  const [frameAt, setFrameAt]   = useState(null);

  // Snapshot frame timestamp — updated via callback (no src state needed)
  const [snapFrameAt, setSnapFrameAt] = useState(null);

  const attemptKey = `${camera.streamUrl}|${retryKey}`;
  const offline    = failedKey === attemptKey;

  // Pick the stream strategy
  const crossOrigin  = !sameOrigin(camera.streamUrl);
  const useSnapshot  = crossOrigin && Boolean(PI_SNAPSHOT_URL) && !offline;
  const useLatest    = !useSnapshot && mode === 'fetch' && sameOrigin(camera.streamUrl) && !offline;

  useEffect(() => {
    setMode(sameOrigin(camera.streamUrl) ? 'fetch' : 'img');
    setFrameUrl(null);
    setFrameAt(null);
    setSnapFrameAt(null);
  }, [camera.streamUrl]);

  // Auto-retry after offline
  useEffect(() => {
    if (!offline) return undefined;
    const delay = Math.min(15_000, 1000 * (2 ** Math.min(reconnects, 4)));
    const timer = setTimeout(() => {
      setReconnects((c) => c + 1);
      setRetryKey((k) => k + 1);
      setFailedKey(null);
    }, delay);
    return () => clearTimeout(timer);
  }, [offline, reconnects]);

  const payload        = detections.data;
  const fresh          = isDetectionFresh(payload, now);
  const visibleObjects = useMemo(
    () => (fresh && payload ? payload.objects.filter((o) => o.confidence >= OVERLAY_MIN_CONFIDENCE) : EMPTY),
    [fresh, payload],
  );

  const activeFreshAt = useSnapshot ? snapFrameAt : frameAt;
  const freshness     = frameFreshness(activeFreshAt, now);
  const streamLabel   = offline
    ? `offline · ${reconnects} reconnects`
    : useSnapshot
      ? `snapshot · ${freshness}`
      : useLatest
        ? `latest frame · ${freshness}`
        : `direct stream · ${reconnects} reconnects`;

  useEffect(() => {
    onStreamStatus?.({
      label: streamLabel,
      reconnects,
      freshness: (useLatest || useSnapshot) ? freshness : 'unknown',
    });
  }, [onStreamStatus, streamLabel, reconnects, freshness, useLatest, useSnapshot]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Live camera
          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">
            via {camera.source}
          </span>
          {fps !== null && (
            <span className="ml-2 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-400">
              {fps.toFixed(1)} fps
            </span>
          )}
          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-400">
            {streamLabel}
          </span>
        </h2>
        <div className="flex gap-2">
          <ToolbarButton onClick={() => setShowOverlay((v) => !v)} pressed={showOverlay}>
            {showOverlay ? 'Hide boxes' : 'Show boxes'}
          </ToolbarButton>
          {fullscreenSupported && (
            <ToolbarButton onClick={toggleFullscreen}>
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </ToolbarButton>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={`relative w-full overflow-hidden bg-black ${isFullscreen ? 'h-full' : 'rounded-lg'}`}
        style={isFullscreen ? undefined : { aspectRatio: CAMERA_ASPECT_RATIO }}
      >
        {camera.loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingState label="Resolving camera URL…" />
          </div>
        ) : offline ? (
          <CameraOffline
            url={camera.streamUrl}
            onRetry={() => { setRetryKey((k) => k + 1); setFailedKey(null); }}
          />
        ) : (
          <>
            {useSnapshot ? (
              <>
                {/*
                  The <img> is rendered once and never re-mounted.
                  SnapshotStream writes directly to snapshotImgRef.current.src,
                  bypassing React state so there is zero re-render overhead per frame.
                */}
                <SnapshotStream
                  imgRef={snapshotImgRef}
                  snapshotUrl={PI_SNAPSHOT_URL}
                  intervalMs={80}
                  onFrame={(ts) => setSnapFrameAt(ts)}
                  onError={() => setFailedKey(attemptKey)}
                />
                <img
                  ref={snapshotImgRef}
                  alt="Live rover camera stream"
                  className="absolute inset-0 h-full w-full object-contain"
                  draggable={false}
                />
              </>
            ) : useLatest ? (
              <>
                <LatestFrameStream
                  url={camera.streamUrl}
                  retryKey={retryKey}
                  onFrame={(url, at) => { setFrameUrl(url); setFrameAt(at); }}
                  onFallback={() => setMode('img')}
                  onError={() => setFailedKey(attemptKey)}
                />
                {frameUrl && (
                  <img
                    src={frameUrl}
                    alt="Live rover camera stream"
                    className="absolute inset-0 h-full w-full object-contain"
                    draggable={false}
                  />
                )}
              </>
            ) : (
              <CameraStream
                url={camera.streamUrl}
                retryKey={retryKey}
                onError={() => setFailedKey(attemptKey)}
                onLoad={() => setFrameAt(Date.now())}
              />
            )}

            {showOverlay && (
              <DetectionOverlay
                objects={visibleObjects}
                frameWidth={payload?.frameWidth}
                frameHeight={payload?.frameHeight}
              />
            )}
          </>
        )}
      </div>

      <DetectionSummary
        objects={visibleObjects}
        fresh={fresh}
        hasPayload={Boolean(payload)}
        error={detections.error}
      />
    </div>
  );
}

function ToolbarButton({ children, onClick, pressed }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
    >
      {children}
    </button>
  );
}
