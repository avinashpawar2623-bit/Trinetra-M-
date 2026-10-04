import { useMemo, useRef, useState } from 'react';
import { CAMERA_ASPECT_RATIO, OVERLAY_MIN_CONFIDENCE } from '../../config/constants';
import { useCameraConfig } from '../../hooks/useCameraConfig';
import { useFullscreen } from '../../hooks/useFullscreen';
import { usePiApi } from '../../hooks/usePiApi';
import { isDetectionFresh } from '../../lib/detections';
import CameraStream from './CameraStream';
import DetectionOverlay from './DetectionOverlay';
import DetectionSummary from './DetectionSummary';
import CameraOffline from './CameraOffline';
import RoverControlPanel from './RoverControlPanel';
import LoadingState from '../layout/LoadingState';

const EMPTY = [];

/**
 * Live camera panel: MJPEG stream + canvas detection overlay + summary + drive pad.
 * `detections` is the { data, loading, error } result of useDetections(),
 * passed in so the Dashboard can share one subscription with the logger.
 *
 * Changes vs. original:
 *  - Imports usePiApi to show FPS badge and pass Pi online state to DriveControl.
 *  - Renders <DriveControl> below DetectionSummary.
 *  - FPS badge in the header (shows Pi camera inference rate from /ws fps field).
 */
export default function CameraPanel({ detections, now }) {
  const camera = useCameraConfig();
  const containerRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(containerRef);

  // Pull FPS + Pi connection state from the shared WebSocket hook (singleton).
  const { sensors: piSensors } = usePiApi();
  const fps = piSensors?.data?.fps ?? null;
  const piOnline = !piSensors.error && !piSensors.loading;

  const [showOverlay, setShowOverlay] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  // Key of the stream attempt that failed; a new URL or Retry clears the offline state.
  const [failedKey, setFailedKey] = useState(null);

  const attemptKey = `${camera.streamUrl}|${retryKey}`;
  const offline = failedKey === attemptKey;

  const payload = detections.data;
  const fresh = isDetectionFresh(payload, now);

  // Memoized so the canvas only redraws when the payload or freshness changes.
  const visibleObjects = useMemo(
    () => (fresh && payload ? payload.objects.filter((o) => o.confidence >= OVERLAY_MIN_CONFIDENCE) : EMPTY),
    [fresh, payload],
  );

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
        </h2>
        <div className="flex gap-2">
          <ToolbarButton onClick={() => setShowOverlay((v) => !v)} pressed={showOverlay}>
            {showOverlay ? 'Hide boxes' : 'Show boxes'}
          </ToolbarButton>
          {fullscreenSupported && (
            <ToolbarButton onClick={toggleFullscreen}>{isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}</ToolbarButton>
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
          <CameraOffline url={camera.streamUrl} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : (
          <>
            <CameraStream
              url={camera.streamUrl}
              retryKey={retryKey}
              onError={() => setFailedKey(attemptKey)}
            />
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

      {/* ── Rover Control Panel — Drive + Arm + Mode Toggle ── */}
      <RoverControlPanel disabled={!piOnline} />
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
