import { memo, useState, useRef, useCallback, useMemo } from 'react';
import { OVERLAY_MIN_CONFIDENCE } from '../../config/constants';
import { usePiApi } from '../../hooks/usePiApi';
import { useFullscreen } from '../../hooks/useFullscreen';
import { isDetectionFresh } from '../../lib/detections';
import CameraStream, { STREAM_URL } from './CameraStream';
import DetectionOverlay from './DetectionOverlay';
import DetectionSummary from './DetectionSummary';
import CameraOffline from './CameraOffline';

const EMPTY = [];

// ── FpsDisplay — isolated WebSocket subscriber ────────────────────────────────
// THIS is the key fix: sensor state lives here, NOT in CameraPanel.
// WebSocket updates (every 200ms) only re-render this tiny span —
// never CameraPanel, never CameraStream.
const FpsDisplay = memo(function FpsDisplay() {
  const { sensors } = usePiApi();
  const fps = sensors?.data?.fps ?? null;
  if (fps === null) return null;
  return (
    <span style={{ fontSize: 11, opacity: 0.75, fontFamily: 'monospace', color: '#86efac' }}>
      {fps.toFixed(1)} fps
    </span>
  );
});

// ── CameraPanel ───────────────────────────────────────────────────────────────
// Does NOT call usePiApi() — never re-renders from sensor WebSocket updates.
// Receives detections + now from Dashboard (passed once per detection cycle,
// not every 200ms sensor tick).
export default memo(function CameraPanel({ detections, now, onStreamStatus }) {
  const containerRef = useRef(null);
  const { isFullscreen, toggle: toggleFullscreen, supported: fullscreenSupported } = useFullscreen(containerRef);

  const [showOverlay, setShowOverlay] = useState(true);
  const [offline,     setOffline]     = useState(false);
  const [reconnects,  setReconnects]  = useState(0);

  // Detection overlay — computed from props, not from usePiApi
  const payload        = detections?.data;
  const fresh          = isDetectionFresh(payload, now);
  const visibleObjects = useMemo(
    () => (fresh && payload
      ? payload.objects.filter((o) => o.confidence >= OVERLAY_MIN_CONFIDENCE)
      : EMPTY),
    [fresh, payload],
  );

  // Stable callbacks — useCallback so memo() on CameraStream keeps working
  // (not that CameraStream uses these — just keeping parent stable)
  const handleOffline = useCallback(() => {
    setOffline(true);
    setReconnects((c) => c + 1);
  }, []);

  const handleRetry = useCallback(() => setOffline(false), []);

  const toggleOverlay = useCallback(() => setShowOverlay((v) => !v), []);

  const streamLabel = offline
    ? `offline · retry ${reconnects}`
    : reconnects > 0 ? `live · ${reconnects} reconnects` : 'live';

  // Notify parent of stream status (Dashboard shows it in SystemHealth)
  // useCallback-stable so parent memo is not broken
  const stableStatus = useMemo(
    () => ({ label: streamLabel, reconnects, freshness: 'unknown' }),
    [streamLabel, reconnects],
  );
  // Fire parent callback only when stableStatus changes (not every render)
  const prevLabelRef = useRef('');
  if (prevLabelRef.current !== streamLabel) {
    prevLabelRef.current = streamLabel;
    onStreamStatus?.(stableStatus);
  }

  return (
    <div className="space-y-3">
      {/* Keyframe for LIVE dot */}
      <style>{`@keyframes livePulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Live camera
          {/* FpsDisplay: isolated — only it re-renders on sensor updates */}
          <FpsDisplay />
          <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-400">
            {streamLabel}
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleOverlay}
            aria-pressed={showOverlay}
            className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            {showOverlay ? 'Hide boxes' : 'Show boxes'}
          </button>
          {fullscreenSupported && (
            <button
              type="button"
              onClick={toggleFullscreen}
              className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700"
            >
              {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            </button>
          )}
        </div>
      </div>

      {/* ── Camera frame ── */}
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

        {offline ? (
          <CameraOffline url={STREAM_URL} onRetry={handleRetry} />
        ) : (
          <>
            {/*
              CameraStream:
              - memo()'d → never re-renders (url is module constant, never changes)
              - No key prop → no DOM remount ever
              - Browser holds MJPEG TCP connection open in C++ network stack
            */}
            <CameraStream url={STREAM_URL} />

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
        error={detections?.error}
      />
    </div>
  );
});
