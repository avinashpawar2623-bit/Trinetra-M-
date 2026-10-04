import { usePiApi } from './usePiApi';

/** Rover connection status — now sourced from the Pi WebSocket (/ws). */
export function useRoverStatus() {
  const { status } = usePiApi();
  return status;
}
