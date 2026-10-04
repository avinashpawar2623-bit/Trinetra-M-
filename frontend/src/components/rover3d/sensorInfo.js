import { DISTANCE_THRESHOLDS, NO_ECHO, TEMP_THRESHOLDS } from '../../config/constants';
import { distanceLevel, humidityLevel, temperatureLevel } from '../../lib/levels';

const flag = (v, on) => ({
  value: v === true ? on : v === false ? 'Clear' : 'No data',
  level: v === true ? 'danger' : v === false ? 'normal' : 'unknown',
});

const distance = (v) => ({
  value: v === NO_ECHO ? 'No echo' : typeof v === 'number' ? `${v.toFixed(1)} cm` : 'No data',
  level: distanceLevel(v ?? null),
});

const distanceThreshold = `Danger < ${DISTANCE_THRESHOLDS.danger} cm · Warning < ${DISTANCE_THRESHOLDS.warning} cm`;

/** Static description + live reading for each clickable sensor housing. */
export const SENSOR_INFO = {
  flame: {
    name: 'Flame sensor (IR)',
    description: 'Detects infrared light from open flame, roughly 1 m range in a 60° cone. Digital output.',
    threshold: 'Triggered / clear',
    read: (s) => flag(s.flame, 'FIRE'),
  },
  mq2: {
    name: 'MQ-2 gas sensor',
    description: 'Combustible gas and smoke: LPG, propane, methane, hydrogen. Digital alarm output.',
    threshold: 'Triggered / clear (set by module potentiometer)',
    read: (s) => flag(s.mq2, 'GAS'),
  },
  mq6: {
    name: 'MQ-6 gas sensor',
    description: 'High sensitivity to LPG, butane and propane. Digital alarm output.',
    threshold: 'Triggered / clear (set by module potentiometer)',
    read: (s) => flag(s.mq6, 'GAS'),
  },
  sonarFront: {
    name: 'HC-SR04 ultrasonic (front)',
    description: 'Measures obstacle distance (2–400 cm) by timing a 40 kHz echo. Beam is about 15° wide.',
    threshold: distanceThreshold,
    read: (s) => distance(s.distanceFront),
  },
  sonarRear: {
    name: 'HC-SR04 ultrasonic (rear)',
    description: 'Measures obstacle distance (2–400 cm) by timing a 40 kHz echo. Beam is about 15° wide.',
    threshold: distanceThreshold,
    read: (s) => distance(s.distanceRear),
  },
  dht: {
    name: 'DHT11 temperature & humidity',
    description: 'Ambient temperature (0–50 °C, ±2 °C) and relative humidity (20–90 %, ±5 %).',
    threshold: `Temp warning ≥ ${TEMP_THRESHOLDS.warning} °C · danger ≥ ${TEMP_THRESHOLDS.danger} °C`,
    read: (s) => {
      const t = s.temperature ?? null;
      const h = s.humidity ?? null;
      const tl = temperatureLevel(t);
      const hl = humidityLevel(h);
      const order = ['unknown', 'normal', 'warning', 'danger'];
      return {
        value: `${t === null ? '--' : `${t.toFixed(1)} °C`} · ${h === null ? '--' : `${Math.round(h)} %`}`,
        level: order.indexOf(tl) >= order.indexOf(hl) ? tl : hl,
      };
    },
  },
};
