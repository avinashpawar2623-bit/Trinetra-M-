/**
 * Fading dots at each class's recent positions (one frame per detection
 * payload, up to ROVER3D.trailLength). Cleared when detections go stale.
 */
import * as THREE from 'three';
import { OVERLAY_MIN_CONFIDENCE, ROVER3D } from '../../../config/constants';
import { colorForLabel } from '../../detections';
import { detectionPosition } from '../units';

const MAX_POINTS = 1024;

const vertexShader = /* glsl */ `
  attribute float aAlpha;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = 0.13 * uScale / -mv.z;
  }
`;
const fragmentShader = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.3, 0.5, d)));
    #include <colorspace_fragment>
  }
`;

export function createDetectionTrails({ heightAt }) {
  const positions = new Float32Array(MAX_POINTS * 3);
  const colors = new Float32Array(MAX_POINTS * 3);
  const alphas = new Float32Array(MAX_POINTS);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, transparent: true, depthWrite: false, uniforms: { uScale: { value: 400 } },
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  /** label -> array of frames; each frame is an array of {x, y, z}. */
  const history = new Map();
  let lastTimestamp = null;
  const color = new THREE.Color();

  function rebuild() {
    let n = 0;
    for (const [label, frames] of history) {
      color.set(colorForLabel(label));
      // Skip the newest frame: the live marker already sits there.
      for (let f = 0; f < frames.length - 1 && n < MAX_POINTS; f++) {
        const age = (frames.length - 1 - f) / ROVER3D.trailLength;
        for (const p of frames[f]) {
          if (n >= MAX_POINTS) break;
          positions.set([p.x, p.y + 0.06, p.z], n * 3);
          colors.set([color.r, color.g, color.b], n * 3);
          alphas[n] = Math.max(0, 0.8 * (1 - age));
          n++;
        }
      }
    }
    geometry.setDrawRange(0, n);
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.aColor.needsUpdate = true;
    geometry.attributes.aAlpha.needsUpdate = true;
  }

  return {
    object3d: points,
    update({ sensors, detections, fresh }) {
      if (!fresh || !detections) {
        if (history.size) {
          history.clear();
          lastTimestamp = null;
          rebuild();
        }
        return;
      }
      if (detections.timestamp === lastTimestamp) return;
      lastTimestamp = detections.timestamp;

      const frame = new Map();
      for (const obj of detections.objects) {
        if (obj.confidence < OVERLAY_MIN_CONFIDENCE) continue;
        const p = detectionPosition(obj, detections, sensors?.distanceFront, heightAt);
        if (!frame.has(obj.label)) frame.set(obj.label, []);
        frame.get(obj.label).push(p);
      }
      for (const label of new Set([...history.keys(), ...frame.keys()])) {
        const frames = history.get(label) || [];
        frames.push(frame.get(label) || []);
        while (frames.length > ROVER3D.trailLength) frames.shift();
        if (frames.every((f) => f.length === 0)) history.delete(label);
        else history.set(label, frames);
      }
      rebuild();
    },
    resize({ height, pixelRatio, fov }) {
      material.uniforms.uScale.value = (height * pixelRatio) / (2 * Math.tan((fov * Math.PI) / 360));
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
