/**
 * Heat haze above the chassis at warning/danger temperature: camera-facing
 * quads with animated rising wave bands (an inexpensive stand-in for true
 * refraction, which would need an extra render target).
 */
import * as THREE from 'three';
import { temperatureLevel } from '../../levels';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSeed;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float warp = sin(vUv.x * 9.0 + uTime * 2.1 + uSeed) * 1.4;
    float wave = sin(vUv.y * 20.0 - uTime * 5.5 + warp) * 0.5 + 0.5;
    float edge = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
    float fade = smoothstep(0.0, 0.15, vUv.y) * (1.0 - vUv.y);
    gl_FragColor = vec4(uColor, wave * edge * fade * uIntensity * 0.11);
  }
`;

export function createHeatShimmer({ anchor }) {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(1.5, 1.3).translate(0, 0.65, 0);
  const materials = [];

  for (let i = 0; i < 3; i++) {
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0 },
        uSeed: { value: i * 2.3 },
        uColor: { value: new THREE.Color('#ff9a4a') },
      },
    });
    const quad = new THREE.Mesh(geometry, material);
    quad.position.copy(anchor).add(new THREE.Vector3((i - 1) * 0.25, 0, (i - 1) * 0.2));
    group.add(quad);
    materials.push(material);
  }

  let intensity = 0;

  return {
    object3d: group,
    update({ sensors }) {
      const level = temperatureLevel(sensors?.temperature ?? null);
      intensity = level === 'danger' ? 1 : level === 'warning' ? 0.5 : 0;
      group.visible = intensity > 0;
    },
    tick(time, dt, { camera, reduceMotion }) {
      if (!group.visible) return;
      for (const quad of group.children) {
        // Billboard around Y only so the haze stays upright.
        quad.rotation.y = Math.atan2(camera.position.x - quad.position.x, camera.position.z - quad.position.z);
      }
      for (const m of materials) {
        m.uniforms.uTime.value = reduceMotion ? 0 : time;
        m.uniforms.uIntensity.value = intensity;
      }
    },
    dispose() {
      geometry.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
