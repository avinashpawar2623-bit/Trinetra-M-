/** Drifting amber/grey smoke around the rover while MQ-2/MQ-6 detect gas. */
import { createParticlePool } from './particles';

export function createGasSmokeEffect({ texture, quality }) {
  const count = quality.particles;
  const pool = createParticlePool({
    count,
    texture,
    colors: ['#d8a640', '#8d8676', '#3f3f3f'],
    sizeStart: 0.5,
    sizeEnd: 1.8,
    opacity: 0.18,
  });

  /** 0 = no gas, 0.5 = one sensor, 1 = both sensors. */
  let density = 0;
  const avgLife = 4;

  const spawn = (i, p, v) => {
    const k = i * 3;
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1.0;
    p[k] = Math.cos(a) * r;
    p[k + 1] = 0.25 + Math.random() * 0.8;
    p[k + 2] = Math.sin(a) * r * 1.2;
    const out = 0.08 + Math.random() * 0.18;
    v[k] = Math.cos(a) * out;
    v[k + 1] = 0.04 + Math.random() * 0.1;
    v[k + 2] = Math.sin(a) * out;
    return { life: avgLife * (0.75 + Math.random() * 0.5), size: 0.5 + Math.random() * 0.6 };
  };
  const force = (i, p, v, dt) => {
    const k = i * 3;
    v[k] += (Math.random() - 0.5) * 0.15 * dt; // slow lateral drift
    v[k + 2] += (Math.random() - 0.5) * 0.15 * dt;
  };

  return {
    object3d: pool.points,
    update({ sensors }) {
      const s = sensors || {};
      density = ((s.mq2 === true) + (s.mq6 === true)) / 2;
    },
    tick(time, dt) {
      pool.step(dt, density * (count / avgLife), spawn, force);
      pool.points.visible = density > 0 || pool.alive > 0;
    },
    resize: pool.resize,
    dispose: pool.dispose,
  };
}
