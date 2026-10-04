/** Additive particle fire rising from the flame sensor, with flickering light. */
import * as THREE from 'three';
import { createParticlePool } from './particles';

export function createFlameEffect({ anchor, texture, quality }) {
  const count = quality.particles;
  const pool = createParticlePool({
    count,
    texture,
    colors: ['#fff4b8', '#ff7a1a', '#7a1200'],
    sizeStart: 1,
    sizeEnd: 0.3,
    opacity: 0.5,
    additive: true,
  });

  const group = new THREE.Group();
  group.add(pool.points);
  const light = new THREE.PointLight('#ff6a1f', 0, 6, 1.5);
  light.position.copy(anchor).add(new THREE.Vector3(0, 0.35, 0));
  group.add(light);

  let active = false;
  const avgLife = 0.85;

  const spawn = (i, p, v) => {
    const k = i * 3;
    p[k] = anchor.x + (Math.random() - 0.5) * 0.12;
    p[k + 1] = anchor.y + Math.random() * 0.04;
    p[k + 2] = anchor.z + (Math.random() - 0.5) * 0.12;
    v[k] = (Math.random() - 0.5) * 0.18;
    v[k + 1] = 0.7 + Math.random() * 0.6;
    v[k + 2] = (Math.random() - 0.5) * 0.18;
    return { life: avgLife * (0.6 + Math.random() * 0.8), size: 0.12 + Math.random() * 0.1 };
  };
  // Turbulence + pull toward the flame axis for a tapered tongue shape.
  const force = (i, p, v, dt) => {
    const k = i * 3;
    v[k] += ((anchor.x - p[k]) * 2.2 + (Math.random() - 0.5) * 1.6) * dt;
    v[k + 2] += ((anchor.z - p[k + 2]) * 2.2 + (Math.random() - 0.5) * 1.6) * dt;
  };

  return {
    object3d: group,
    update({ sensors }) {
      active = sensors?.flame === true;
      if (!active) light.intensity = 0;
    },
    tick(time, dt, { reduceMotion }) {
      pool.step(dt, active ? count / avgLife : 0, spawn, force);
      pool.points.visible = active || pool.alive > 0;
      if (active) {
        const flicker = reduceMotion ? 0.8 : 0.6 + Math.random() * 0.4 + Math.sin(time * 23) * 0.1;
        light.intensity = 3.5 * flicker;
      }
    },
    resize: pool.resize,
    dispose: pool.dispose,
  };
}
