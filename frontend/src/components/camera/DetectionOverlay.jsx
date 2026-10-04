import { useEffect, useRef, useState } from 'react';
import { colorForLabel } from '../../lib/detections';

/**
 * Canvas overlay that draws bounding boxes on top of the stream.
 *
 * bbox = [x, y, w, h] in source-frame pixels (frameWidth x frameHeight).
 * The <img> uses object-contain, so the frame may be letterboxed inside the
 * container. We compute the same contained rect here and map coordinates:
 *   displayX = offsetX + x * scale,  scale = min(cw / fw, ch / fh)
 */
export default function DetectionOverlay({ objects, frameWidth, frameHeight }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  // Track the container's displayed size so we redraw on resize / fullscreen.
  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.width || !size.height) return;

    // Match backing store to device pixels for crisp lines on HiDPI screens.
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.width * dpr);
    canvas.height = Math.round(size.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.width, size.height);

    if (!objects?.length || !frameWidth || !frameHeight) return;

    const scale = Math.min(size.width / frameWidth, size.height / frameHeight);
    const offsetX = (size.width - frameWidth * scale) / 2;
    const offsetY = (size.height - frameHeight * scale) / 2;
    const fontSize = Math.max(11, Math.min(16, size.width / 45));

    ctx.lineWidth = 2;
    ctx.font = `600 ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
    ctx.textBaseline = 'top';

    for (const { label, confidence, bbox } of objects) {
      const [x, y, w, h] = bbox;
      const dx = offsetX + x * scale;
      const dy = offsetY + y * scale;
      const dw = w * scale;
      const dh = h * scale;
      const color = colorForLabel(label);

      ctx.strokeStyle = color;
      ctx.strokeRect(dx, dy, dw, dh);

      const text = `${label} ${Math.round(confidence * 100)}%`;
      const padX = 4;
      const tagH = fontSize + 6;
      const tagW = ctx.measureText(text).width + padX * 2;
      // Put the tag above the box, or inside it if the box touches the top edge.
      const tagY = dy - tagH >= offsetY ? dy - tagH : dy;

      ctx.fillStyle = color;
      ctx.fillRect(dx - 1, tagY, tagW, tagH);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, dx - 1 + padX, tagY + 3);
    }
  }, [objects, frameWidth, frameHeight, size]);

  return <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true" />;
}
