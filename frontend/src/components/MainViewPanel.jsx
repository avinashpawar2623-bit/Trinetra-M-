import { Suspense, lazy, useState } from 'react';
import { isDetectionFresh } from '../lib/detections';
import CameraPanel from './camera/CameraPanel';
import Card from './layout/Card';
import LoadingState from './layout/LoadingState';

// Lazy so three.js is only downloaded when the 3D tab is first opened.
const Rover3DView = lazy(() => import('./rover3d/Rover3DView'));

const STORAGE_KEY = 'trinetra.mainView';
const TABS = [
  { id: 'camera', label: 'Camera' },
  { id: '3d', label: '3D rover' },
];

function readSavedTab() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return TABS.some((t) => t.id === saved) ? saved : 'camera';
  } catch {
    return 'camera';
  }
}

/**
 * Main panel toggling between the live camera and the 3D rover model.
 * Only the active view is mounted: leaving the camera tab closes the MJPEG
 * connection (freeing the ESP32-CAM's single stream slot), and leaving the
 * 3D tab releases the WebGL context.
 */
export default function MainViewPanel({ sensors, online, lastSeen, detections, now }) {
  const [tab, setTab] = useState(readSavedTab);

  function selectTab(id) {
    setTab(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage may be unavailable (private mode); the choice just won't persist.
    }
  }

  return (
    <Card className="space-y-3">
      <div role="tablist" aria-label="Main view" className="inline-flex rounded-lg border border-white/10 bg-slate-950/60 p-1 shadow-inner">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`rounded-md px-3 py-1 text-xs font-semibold transition ${
              tab === t.id
                ? 'bg-emerald-500/90 text-white shadow-[0_2px_10px_-2px] shadow-emerald-500/60'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'camera' ? (
        <CameraPanel detections={detections} now={now} />
      ) : (
        <Suspense fallback={<LoadingState label="Loading 3D view…" />}>
          <Rover3DView
            sensors={sensors}
            online={online}
            lastSeen={lastSeen}
            now={now}
            detections={detections.data}
            fresh={isDetectionFresh(detections.data, now)}
          />
        </Suspense>
      )}
    </Card>
  );
}
