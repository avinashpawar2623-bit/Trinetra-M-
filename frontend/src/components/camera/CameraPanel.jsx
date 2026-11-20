import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CAMERA_ASPECT_RATIO, OVERLAY_MIN_CONFIDENCE } from '../../config/constants';
import { useCameraConfig } from '../../hooks/useCameraConfig';
import { useFullscreen } from '../../hooks/useFullscreen';
import { usePiApi } from '../../hooks/usePiApi';
import { isDetectionFresh } from '../../lib/detections';
import CameraStream from './CameraStream';
import SnapshotStream from './SnapshotStream';
import DetectionOverlay from './DetectionOverlay';
import DetectionSummary from './DetectionSummary';
import CameraOffline from './CameraOffline';
import LoadingState from '../layout/LoadingState';

const EMPTY = [];

/** One JPEG per request. A long-lived /stream buffers in the browser and holds the Pi. */
function toSnapshotUrl(streamUrl) {
  if (typeof streamUrl !== 'string' || !/\/stream(?=$|\?)/.test(streamUrl)) return '';
  return streamUrl.replace(/\/stream(?=$|\?)/, '/snapshot');
}

/**
 * Isolated fps badge — subscribes to WebSocket on its own.
 * Sensor updates re-render ONLY this tiny component, not CameraPanel or CameraStream.
 */
const FpsDisplay = memo(function FpsDisplay() {
  const { sensors } = usePiApi();
  const fps = sensors?.data?.fps ?? null;
  if (fps === null) return null;
  return (
    <span className="ml-2 rounded bg-emerald-900/60 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-emerald-400">
      {fps.toFixed(1)} fps
    </span>
  );
});

/**
 * Live camera. Prefer single-JPEG snapshots so the picture stays on the newest
 * frame and the Pi is free between frames to accept arm and drive commands.
 * MJPEG is only the fallback when /snapshot cannot be reached.
 */
export default function CameraPanel({ detections, now, onStreamStatus }) {
  const camera       = useCameraConfig();
  const containerRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(containerRef);

  const [showOverlay, setShowOverlay] = useState(true);
  const [retryKey,    setRetryKey]    = useState(0);
  const [failedKey,   setFailedKey]   = useState(null);
  const [reconnects,  setReconnects]  = useState(0);
  const [transport,   setTransport]   = useState('snapshot');
  const frameRef = useRef(null);
  const snapshotUrl = toSnapshotUrl(camera.streamUrl);
  const useSnapshot = transport === 'snapshot' && Boolean(snapshotUrl);

  const attemptKey = `${camera.streamUrl}|${retryKey}`;
  const offline    = failedKey === attemptKey;

  useEffect(() => {
    setTransport(snapshotUrl ? 'snapshot' : 'mjpeg');
  }, [snapshotUrl]);

  // Auto-retry after offline with exponential back-off (1s → 2s → 4s … 15s)
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

  // Stable callbacks — same reference across renders so CameraStream memo works
  const handleError = useCallback(() => {
    setFailedKey((prev) => prev ?? attemptKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey, camera.streamUrl]);

  const handleLoad = useCallback(() => {
    // Stream connected — clear any previous failed state
    setFailedKey(null);
  }, []);

  const handleSnapFail = useCallback(() => {
    setTransport('mjpeg');
  }, []);

  const handleRetry = useCallback(() => {
    setRetryKey((k) => k + 1);
    setFailedKey(null);
    setTransport(snapshotUrl ? 'snapshot' : 'mjpeg');
  }, [snapshotUrl]);

  // Detection overlay — isolated from sensor WebSocket
  const payload        = detections.data;
  const fresh          = isDetectionFresh(payload, now);
  const visibleObjects = useMemo(
    () => (fresh && payload
      ? payload.objects.filter((o) => o.confidence >= OVERLAY_MIN_CONFIDENCE)
      : EMPTY),
    [fresh, payload],
  );

  const streamLabel = offline
    ? `offline · retry ${reconnects}`
    : `${useSnapshot ? 'snapshot' : 'mjpeg'}${reconnects > 0 ? ` · ${reconnects} reconnects` : ''}`;

  useEffect(() => {
    onStreamStatus?.({ label: streamLabel, reconnects, freshness: 'unknown' });
  }, [onStreamStatus, streamLabel, reconnects]);

  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Live camera
          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-500">
            via {camera.source}
          </span>
          {/* FpsDisplay has its own usePiApi subscription — sensor updates only re-render this */}
          <FpsDisplay />
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

      {/* ── Camera frame ── */}
      <div
        ref={containerRef}
        style={isFullscreen ? { width: '100%', height: '100%', background: '#000', position: 'relative' } : {
          width: '100%',
          aspectRatio: CAMERA_ASPECT_RATIO,
          maxHeight: '52vh',
          marginInline: 'auto',
          backgroundColor: '#000',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.6)',
        }}
      >
        {/* Keyframes for LIVE dot pulse */}
        <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>

        {/* LIVE badge — top-left overlay */}
        {!offline && (
          <div style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            background: 'rgba(0,0,0,0.65)', color: '#fff',
            padding: '3px 9px', borderRadius: 5, fontSize: 11,
            fontWeight: 700, letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 5,
            backdropFilter: 'blur(4px)',
            pointerEvents: 'none',
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#e74c3c', display: 'inline-block',
              animation: 'livePulse 1.2s ease-in-out infinite',
            }} />
            LIVE
          </div>
        )}
        {camera.loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <LoadingState label="Resolving camera URL…" />
          </div>
        ) : offline ? (
          <CameraOffline url={camera.streamUrl} onRetry={handleRetry} />
        ) : (
          <>
            {/*
              CameraStream is memo'd — will NOT re-render on sensor WebSocket
              updates (every 200ms). The MJPEG TCP connection stays open and
              uninterrupted for the full session.
              handleError / handleLoad are useCallback — stable refs = memo works.
            */}
            {useSnapshot ? (
              <>
                <img
                  ref={frameRef}
                  alt="TRINETRA Camera"
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
                <SnapshotStream
                  imgRef={frameRef}
                  snapshotUrl={snapshotUrl}
                  retryKey={retryKey}
                  pauseMs={70}
                  onFrame={handleLoad}
                  onError={handleSnapFail}
                />
              </>
            ) : (
              <CameraStream
                url={camera.streamUrl}
                retryKey={retryKey}
                onError={handleError}
                onLoad={handleLoad}
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
