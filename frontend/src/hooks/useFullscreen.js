import { useCallback, useEffect, useState } from 'react';

/** Fullscreen API wrapper for an element ref (with WebKit fallback for Safari). */
export function useFullscreen(ref) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const supported =
    typeof document !== 'undefined' &&
    Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  useEffect(() => {
    const onChange = () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(Boolean(el) && el === ref.current);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, [ref]);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      } else {
        await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  }, [ref]);

  return { isFullscreen, toggle, supported };
}
