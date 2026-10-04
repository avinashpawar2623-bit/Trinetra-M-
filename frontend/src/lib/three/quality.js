import { ROVER3D } from '../../config/constants';

export const QUALITY_OPTIONS = ['auto', 'high', 'low'];

export const QUALITY_PRESETS = {
  high: {
    name: 'high',
    shadows: true,
    bloom: true,
    heatShader: true,
    particles: ROVER3D.particleCount.high,
    rubbleScale: 1,
    terrainSegments: 160,
    maxPixelRatio: ROVER3D.maxPixelRatio,
  },
  low: {
    name: 'low',
    shadows: false,
    bloom: false,
    heatShader: false,
    particles: ROVER3D.particleCount.low,
    rubbleScale: 0.35,
    terrainSegments: 64,
    maxPixelRatio: 1,
  },
};

/** Heuristic for 'auto': low on touch-only, low-memory, or reduced-motion devices. */
export function detectAutoQuality(reduceMotion) {
  if (reduceMotion) return 'low';
  if (typeof window === 'undefined') return 'high';
  const touchOnly = window.matchMedia?.('(hover: none)').matches;
  const lowMemory = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4;
  return touchOnly || lowMemory ? 'low' : 'high';
}

/** Map a user setting ('auto' | 'high' | 'low') to a preset. */
export function resolveQuality(setting, reduceMotion) {
  const name = setting === 'high' || setting === 'low' ? setting : detectAutoQuality(reduceMotion);
  return QUALITY_PRESETS[name];
}
