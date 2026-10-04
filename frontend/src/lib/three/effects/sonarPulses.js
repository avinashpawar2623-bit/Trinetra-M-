/**
 * Ultrasonic beam for one HC-SR04: a translucent cone scaled to the reading
 * plus radar-style rings travelling out to the measured distance.
 */
import * as THREE from 'three';
import { NO_ECHO, ROVER3D } from '../../../config/constants';
import { distanceLevel } from '../../levels';
import { BEAM_SPREAD, ROVER_FRONT_Z, ROVER_REAR_Z, SONAR_HEIGHT, distanceToUnits } from '../units';

const LEVEL_COLORS = {
  normal: new THREE.Color('#22c55e'),
  warning: new THREE.Color('#f59e0b'),
  danger: new THREE.Color('#ef4444'),
  unknown: new THREE.Color('#64748b'),
};
const RINGS = 3;

export function createSonarBeam({ side }) {
  const dir = side === 'front' ? -1 : 1;
  const originZ = (side === 'front' ? ROVER_FRONT_Z : ROVER_REAR_Z) + dir * 0.08;
  const key = side === 'front' ? 'distanceFront' : 'distanceRear';

  const group = new THREE.Group();
  group.position.set(0, SONAR_HEIGHT, originZ);

  const coneGeometry = new THREE.ConeGeometry(1, 1, 32, 1, true)
    .translate(0, -0.5, 0)
    .rotateX(dir < 0 ? Math.PI / 2 : -Math.PI / 2);
  const coneMaterial = new THREE.MeshBasicMaterial({
    color: LEVEL_COLORS.normal, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  group.add(cone);

  const ringGeometry = new THREE.RingGeometry(0.86, 1, 40);
  const rings = Array.from({ length: RINGS }, () => {
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: LEVEL_COLORS.normal, transparent: true, opacity: 0, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    group.add(ring);
    return ring;
  });

  let length = 0;
  let mode = 'hidden'; // 'reading' | 'noecho' | 'hidden'

  return {
    object3d: group,
    update({ sensors }) {
      const value = sensors?.[key];
      if (value === null || value === undefined) {
        mode = 'hidden';
      } else if (value === NO_ECHO) {
        mode = 'noecho';
        length = ROVER3D.coneMaxLength;
      } else {
        mode = 'reading';
        length = Math.max(0.05, distanceToUnits(value));
      }
      group.visible = mode !== 'hidden';
      const color = LEVEL_COLORS[mode === 'reading' ? distanceLevel(value) : 'unknown'];
      coneMaterial.color.copy(color);
      coneMaterial.wireframe = mode === 'noecho';
      coneMaterial.opacity = mode === 'noecho' ? 0.08 : 0.12;
      cone.scale.set(length * BEAM_SPREAD, length * BEAM_SPREAD, length);
      for (const r of rings) r.material.color.copy(color);
    },
    tick(time, dt, { reduceMotion }) {
      if (mode === 'hidden') return;
      const speed = mode === 'noecho' ? 0.25 : 0.8;
      rings.forEach((ring, i) => {
        if (reduceMotion) {
          ring.visible = false;
          return;
        }
        ring.visible = true;
        const phase = (time * speed + i / RINGS) % 1;
        const d = Math.max(0.02, phase * length);
        ring.position.z = dir * d;
        ring.scale.setScalar(Math.max(0.02, d * BEAM_SPREAD));
        ring.material.opacity = (1 - phase) * (mode === 'noecho' ? 0.18 : 0.65);
      });
    },
    dispose() {
      coneGeometry.dispose();
      coneMaterial.dispose();
      ringGeometry.dispose();
      for (const r of rings) r.material.dispose();
    },
  };
}
