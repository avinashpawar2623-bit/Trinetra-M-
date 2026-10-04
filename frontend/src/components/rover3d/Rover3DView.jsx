import { useEffect, useRef, useState } from 'react';
import { CAMERA_ASPECT_RATIO, ROVER3D } from '../../config/constants';
import { RoverScene } from '../../lib/three/RoverScene';
import { resolveQuality } from '../../lib/three/quality';
import { usePrefersReducedMotion } from '../../hooks/useMediaQuery';
import Rover3DLegend from './Rover3DLegend';
import Rover3DToolbar from './Rover3DToolbar';
import SensorDetailPopover from './SensorDetailPopover';

const QUALITY_KEY = 'trinetra.3dQuality';
const CLICK_SLOP_PX = 5;

function readQuality() {
  try {
    return localStorage.getItem(QUALITY_KEY) || ROVER3D.defaultQuality;
  } catch {
    return ROVER3D.defaultQuality;
  }
}

/**
 * React wrapper around RoverScene. The scene is created on mount (and
 * recreated when the resolved quality changes); data changes only call
 * scene.setData(). Default export so it can be React.lazy-loaded.
 */
export default function Rover3DView({ sensors, online, detections, fresh, lastSeen, now }) {
  const frameRef = useRef(null);
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const pointerRef = useRef(null);
  const reduceMotion = usePrefersReducedMotion();

  const [qualitySetting, setQualitySetting] = useState(readQuality);
  const [preset, setPreset] = useState('orbit');
  const [autoRotate, setAutoRotate] = useState(ROVER3D.autoRotate);
  const [selection, setSelection] = useState(null);
  const [unsupported, setUnsupported] = useState(false);

  const quality = resolveQuality(qualitySetting, reduceMotion);
  const data = { sensors, online, detections, fresh, lastSeen, now };
  const latest = useRef({ data, preset, autoRotate, reduceMotion });
  latest.current = { data, preset, autoRotate, reduceMotion };

  // ---- Scene lifecycle ----
  useEffect(() => {
    let scene;
    try {
      scene = new RoverScene(mountRef.current, { quality, reduceMotion: latest.current.reduceMotion });
    } catch (err) {
      console.warn('3D view unavailable:', err);
      setUnsupported(true);
      return undefined;
    }
    const l = latest.current;
    scene.setData(l.data);
    scene.setAutoRotate(l.autoRotate);
    scene.setPreset(l.preset, { instant: true });
    sceneRef.current = scene;
    setSelection(null);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
    // Rebuild only when the quality tier changes; other inputs are read from `latest`.
  }, [quality.name]);

  useEffect(() => {
    sceneRef.current?.setData({ sensors, online, detections, fresh, lastSeen, now });
  }, [sensors, online, detections, fresh, lastSeen, now]);

  useEffect(() => sceneRef.current?.setReduceMotion(reduceMotion), [reduceMotion]);
  useEffect(() => sceneRef.current?.setAutoRotate(autoRotate), [autoRotate]);

  // ---- Pause when off-screen or the tab is hidden ----
  useEffect(() => {
    const el = frameRef.current;
    let onScreen = true;
    const apply = () => sceneRef.current?.setActive(onScreen && !document.hidden);
    const io = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      apply();
    });
    io.observe(el);
    document.addEventListener('visibilitychange', apply);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', apply);
    };
  }, [quality.name]);

  // ---- Escape closes the popover ----
  useEffect(() => {
    if (!selection) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closeSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection]);

  function closeSelection() {
    sceneRef.current?.clearSelection();
    setSelection(null);
  }

  function handlePointerDown(e) {
    pointerRef.current = { x: e.clientX, y: e.clientY };
  }

  // Treat as a click only if the pointer barely moved (otherwise it was an orbit drag).
  function handlePointerUp(e) {
    const start = pointerRef.current;
    pointerRef.current = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_SLOP_PX) return;
    const scene = sceneRef.current;
    if (!scene) return;
    const pick = scene.pickAt(e.clientX, e.clientY);
    if (!pick) {
      setSelection(null);
      return;
    }
    if (pick.type === 'detection') setPreset('custom');
    const rect = frameRef.current.getBoundingClientRect();
    setSelection({ pick, x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width, height: rect.height });
  }

  function handlePreset(id) {
    setPreset(id);
    setSelection(null);
    sceneRef.current?.setPreset(id);
  }

  function handleQuality(value) {
    setQualitySetting(value);
    try {
      localStorage.setItem(QUALITY_KEY, value);
    } catch {
      // Not persisted when storage is unavailable.
    }
  }

  function handleScreenshot() {
    const url = sceneRef.current?.screenshot();
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `trinetra-3d-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    a.click();
  }

  if (unsupported) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-slate-900 p-6 text-center text-sm text-slate-400" style={{ aspectRatio: CAMERA_ASPECT_RATIO }}>
        3D view needs WebGL, which is unavailable in this browser or disabled by hardware acceleration settings.
      </div>
    );
  }

  return (
    <div ref={frameRef} className="relative min-h-[22rem] w-full overflow-hidden rounded-lg bg-[#05080f] sm:min-h-0" style={{ aspectRatio: CAMERA_ASPECT_RATIO }}>
      <div ref={mountRef} className="absolute inset-0" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp} />
      <Rover3DToolbar
        preset={preset}
        onPreset={handlePreset}
        autoRotate={autoRotate}
        autoRotateAvailable={!reduceMotion && Boolean(online)}
        onToggleAutoRotate={() => setAutoRotate((v) => !v)}
        quality={qualitySetting}
        resolvedQuality={quality.name}
        onQuality={handleQuality}
        onScreenshot={handleScreenshot}
      />
      <Rover3DLegend sensors={sensors} online={online} detectionCount={fresh && detections ? detections.objects.length : null} />
      {selection && <SensorDetailPopover selection={selection} sensors={sensors} now={now} onClose={closeSelection} />}
    </div>
  );
}
