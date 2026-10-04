/**
 * Pure helpers that map sensor values to severity levels and Tailwind tones.
 * Levels: 'normal' | 'warning' | 'danger' | 'unknown'
 */
import {
  BATTERY_THRESHOLDS,
  DISTANCE_THRESHOLDS,
  HUMIDITY_THRESHOLDS,
  NO_ECHO,
  STALE_STATUS_MS,
  TEMP_THRESHOLDS,
} from '../config/constants';

export const TONES = {
  normal: {
    text: 'text-emerald-400',
    bg: 'bg-emerald-500',
    soft: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300',
    glow: 'rgb(52 211 153 / 0.45)',
  },
  warning: {
    text: 'text-amber-400',
    bg: 'bg-amber-500',
    soft: 'bg-amber-500/10 border-amber-500/40 text-amber-300',
    glow: 'rgb(251 191 36 / 0.5)',
  },
  danger: {
    text: 'text-red-400',
    bg: 'bg-red-500',
    soft: 'bg-red-500/10 border-red-500/40 text-red-300',
    glow: 'rgb(248 113 113 / 0.6)',
  },
  unknown: {
    text: 'text-slate-400',
    bg: 'bg-slate-500',
    soft: 'bg-slate-500/10 border-slate-600 text-slate-400',
    glow: 'transparent',
  },
};

export function temperatureLevel(t) {
  if (t === null || t === undefined) return 'unknown';
  if (t >= TEMP_THRESHOLDS.danger) return 'danger';
  if (t >= TEMP_THRESHOLDS.warning) return 'warning';
  return 'normal';
}

export function humidityLevel(h) {
  if (h === null || h === undefined) return 'unknown';
  const { criticalLow, low, high, criticalHigh } = HUMIDITY_THRESHOLDS;
  if (h < criticalLow || h > criticalHigh) return 'danger';
  if (h < low || h > high) return 'warning';
  return 'normal';
}

export function distanceLevel(d) {
  if (d === null || d === undefined || d === NO_ECHO) return 'unknown';
  if (d < DISTANCE_THRESHOLDS.danger) return 'danger';
  if (d < DISTANCE_THRESHOLDS.warning) return 'warning';
  return 'normal';
}

export function batteryLevel(b) {
  if (b === null || b === undefined) return 'unknown';
  if (b <= BATTERY_THRESHOLDS.danger) return 'danger';
  if (b <= BATTERY_THRESHOLDS.warning) return 'warning';
  return 'normal';
}

/**
 * Whether the rover is online, based on lastSeen vs. the CLIENT clock.
 *
 * Clock-skew caveat: lastSeen is produced by the ESP32 (typically NTP-synced)
 * while `now` is the browser's clock. If either clock drifts, the computed age
 * is wrong: a fast client clock causes false "connection lost" banners, a slow
 * one hides real outages. Keep both devices NTP-synced, or have the ESP32 write
 * RTDB's server timestamp ({".sv": "timestamp"}) and compare against
 * `serverTimeOffset` from /.info/serverTimeOffset for higher accuracy.
 */
export function isRoverOnline(status, now) {
  if (!status || status.lastSeen === null) return false;
  if (status.connected === false) return false;
  return now - status.lastSeen <= STALE_STATUS_MS;
}

export function formatAge(ms) {
  if (ms === null || ms === undefined || ms < 0) return 'unknown';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
