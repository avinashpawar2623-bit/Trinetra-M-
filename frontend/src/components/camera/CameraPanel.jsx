import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OVERLAY_MIN_CONFIDENCE } from '../../config/constants';
import { useCameraConfig } from '../../hooks/useCameraConfig';
import { useFullscreen } from '../../hooks/useFullscreen';
import { usePiApi } from '../../hooks/usePiApi';
import { isDetectionFresh } from '../../lib/detections';
import CameraStream from './CameraStream';
import DetectionOverlay from './DetectionOverlay';
import DetectionSummary from './DetectionSummary';
import CameraOffline from './CameraOffline';
import LoadingState from '../layout/LoadingState';

const EMPTY = [];

/**
 * Isolated fps badge — subscribes to WebSocket on its own.
 * Sensor updates re-render ONLY this tiny component, never CameraStream.
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
 * Live camera panel — always uses native MJPEG <img> (CameraStream).
 *
 * No snapshot polling, no JS fetch loop, no transport switching.
 * The browser handles MJPEG in its C++ network stack — zero JS per frame.
 *
 * CameraStream is memo()'d so the WebSocket sensor updates (every 200ms)
 * never reach it — the TCP connection stays open and uninterrupted.
 */
export default function CameraPanel({ detections, now, onStreamStatus }) {
  const camera       = useCameraConfig();
  const containerRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(containerRef);

  const [showOverlay, setShowOverlay] = useState(true);
  const [offline,     setOffline]     = useState(false);
  const [reconnects,  setReconnects]  = useState(0);

  // Auto-retry after offline with exponential back-off (1s → 2s → 4s … 15s)
  useEffect(() => {
    if (!offline) return undefined;
    const delay = Math.min(15_000, 1_000 * (2 ** Math.min(reconnects, 4)));
    const timer = setTimeout(() => {
      setReconnects((c) => c + 1);
      setOffline(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [offline, reconnects]);

  // Stable callbacks — same reference across renders so CameraStream memo works
  const handleError = useCallback(() => setOffline(true),  []);
  const handleLoad  = useCallback(() => setOffline(false), []);
  const handleRetry = useCallback(() => {
    setOffline(false);
    setReconnects(0);
  }, []);

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
    : reconnects > 0 ? `live · ${reconnects} reconnects` : 'live';

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
      {/* @keyframes for LIVE dot */}
      <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
      <div
        ref={containerRef}
        style={isFullscreen
          ? { width: '100%', height: '100%', background: '#000', position: 'relative' }
          : {
            width: '100%',
            aspectRatio: '4/3',
            backgroundColor: '#000',
            borderRadius: 8,
            overflow: 'hidden',
            position: 'relative',
            boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 4px 24px rgba(0,0,0,0.5)',
          }
        }
      >
        {/* LIVE badge */}
        {!offline && (
          <div style={{
            position: 'absolute', top: 8, left: 8, zIndex: 10,
            background: 'rgba(0,0,0,0.65)', color: '#fff',
            padding: '3px 9px', borderRadius: 5, fontSize: 11,
            fontWeight: 700, letterSpacing: '0.08em',
            display: 'flex', alignItems: 'center', gap: 5,
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
              CameraStream is memo()'d. It NEVER re-renders from sensor WebSocket
              updates. The MJPEG TCP connection stays open the entire session.
              handleError / handleLoad are useCallback — stable refs keep memo valid.
            */}
            <CameraStream
              url={camera.streamUrl}
              onError={handleError}
              onLoad={handleLoad}
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
