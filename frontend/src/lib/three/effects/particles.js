/**
 * Minimal GPU point-particle pool with per-particle life and size.
 * Color runs start -> mid -> end over each particle's life; size scales
 * from sizeStart to sizeEnd. Used by the flame and gas-smoke effects.
 */
import * as THREE from 'three';

const vertexShader = /* glsl */ `
  attribute float aLife;
  attribute float aSize;
  uniform float uScale;
  uniform float uSizeStart;
  uniform float uSizeEnd;
  varying float vLife;
  void main() {
    vLife = aLife;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float size = aSize * mix(uSizeStart, uSizeEnd, aLife);
    gl_PointSize = aLife >= 1.0 ? 0.0 : size * uScale / -mv.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uMap;
  uniform vec3 uColorStart;
  uniform vec3 uColorMid;
  uniform vec3 uColorEnd;
  uniform float uOpacity;
  varying float vLife;
  void main() {
    if (vLife >= 1.0) discard;
    vec4 tex = texture2D(uMap, gl_PointCoord);
    vec3 col = vLife < 0.5
      ? mix(uColorStart, uColorMid, vLife * 2.0)
      : mix(uColorMid, uColorEnd, (vLife - 0.5) * 2.0);
    float alpha = tex.a * uOpacity * smoothstep(0.0, 0.08, vLife) * (1.0 - vLife);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createParticlePool({
  count,
  texture,
  colors: [start, mid, end],
  sizeStart = 1,
  sizeEnd = 1,
  opacity = 1,
  additive = false,
}) {
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const life = new Float32Array(count).fill(1); // 1 = dead
  const lifespan = new Float32Array(count).fill(1);
  const sizes = new Float32Array(count);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aLife', new THREE.BufferAttribute(life, 1).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uMap: { value: texture },
      uScale: { value: 400 },
      uSizeStart: { value: sizeStart },
      uSizeEnd: { value: sizeEnd },
      uOpacity: { value: opacity },
      uColorStart: { value: new THREE.Color(start) },
      uColorMid: { value: new THREE.Color(mid) },
      uColorEnd: { value: new THREE.Color(end) },
    },
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  let spawnAccumulator = 0;
  let cursor = 0;
  let alive = 0;

  /**
   * Advance the simulation.
   * @param rate    particles per second to spawn (0 = stop emitting)
   * @param spawn   (i, positions, velocities) => { life: seconds, size }
   * @param force   optional (i, positions, velocities, dt, age01) => void
   */
  function step(dt, rate, spawn, force) {
    spawnAccumulator += rate * dt;
    while (spawnAccumulator >= 1) {
      spawnAccumulator -= 1;
      const i = cursor;
      cursor = (cursor + 1) % count;
      const { life: seconds, size } = spawn(i, positions, velocities);
      lifespan[i] = seconds;
      sizes[i] = size;
      life[i] = 0;
    }

    alive = 0;
    for (let i = 0; i < count; i++) {
      if (life[i] >= 1) continue;
      alive++;
      life[i] = Math.min(1, life[i] + dt / lifespan[i]);
      force?.(i, positions, velocities, dt, life[i]);
      const k = i * 3;
      positions[k] += velocities[k] * dt;
      positions[k + 1] += velocities[k + 1] * dt;
      positions[k + 2] += velocities[k + 2] * dt;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aLife.needsUpdate = true;
    geometry.attributes.aSize.needsUpdate = true;
  }

  return {
    points,
    step,
    get alive() { return alive; },
    /** Keep point sizes in world units regardless of viewport / pixel ratio. */
    resize({ height, pixelRatio, fov }) {
      material.uniforms.uScale.value = (height * pixelRatio) / (2 * Math.tan((fov * Math.PI) / 360));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
