import { usePiApi } from './usePiApi';

/** YOLO detection results — now sourced from the Pi WebSocket (/ws). */
export function useDetections() {
  const { detections } = usePiApi();
  return detections;
}
