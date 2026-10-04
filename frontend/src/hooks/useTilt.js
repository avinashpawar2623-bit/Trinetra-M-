import { useCallback, useEffect, useRef } from 'react';
import { useMediaQuery, usePrefersReducedMotion } from './useMediaQuery';

const MAX_DEG = 6;

/**
 * Pointer-driven 3D tilt. Writes CSS variables directly on the element
 * (no React re-renders) and throttles updates to one per animation frame.
 * Disabled on touch-only devices and when the user prefers reduced motion.
 */
export function useTilt(enabled = true) {
  const ref = useRef(null);
  const frameRef = useRef(0);
  const reduceMotion = usePrefersReducedMotion();
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const active = enabled && canHover && !reduceMotion;

  const reset = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  }, []);

  const onPointerMove = useCallback(
    (e) => {
      if (!active) return;
      const { clientX, clientY } = e;
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (clientX - rect.left) / rect.width; // 0..1
        const py = (clientY - rect.top) / rect.height;
        el.style.setProperty('--ry', `${(px - 0.5) * 2 * MAX_DEG}deg`);
        el.style.setProperty('--rx', `${(0.5 - py) * 2 * MAX_DEG}deg`);
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
        el.style.setProperty('--glare', '1');
      });
    },
    [active],
  );

  useEffect(() => {
    if (!active) reset();
    return () => cancelAnimationFrame(frameRef.current);
  }, [active, reset]);

  return {
    ref,
    active,
    handlers: active ? { onPointerMove, onPointerLeave: reset } : {},
  };
}
