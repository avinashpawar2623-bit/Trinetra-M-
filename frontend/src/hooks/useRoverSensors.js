import { usePiApi } from './usePiApi';

/** Live sensor readings — now sourced from the Pi WebSocket (/ws). */
export function useRoverSensors() {
  const { sensors } = usePiApi();
  return sensors;
}
