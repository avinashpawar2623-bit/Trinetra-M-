/**
 * Clickable markers for fresh detections: pillar + ground ring + label,
 * placed on the terrain. Rebuilt only when the payload/freshness changes.
 */
import * as THREE from 'three';
import { OVERLAY_MIN_CONFIDENCE } from '../../../config/constants';
import { colorForLabel } from '../../detections';
import { makeLabelTexture } from '../textures';
import { detectionPosition } from '../units';

const PILLAR = new THREE.CylinderGeometry(0.05, 0.05, 1, 12).translate(0, 0.5, 0);
const RING = new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2);
const HIT = new THREE.CylinderGeometry(0.4, 0.4, 1, 8).translate(0, 0.5, 0);
const HIT_MATERIAL = new THREE.MeshBasicMaterial({ visible: false });

function clear(group) {
  for (const marker of [...group.children]) {
    marker.traverse((o) => {
      if (o.material && o.material !== HIT_MATERIAL) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    group.remove(marker);
  }
}

export function createDetectionMarkers({ heightAt }) {
  const group = new THREE.Group();
  let lastPayload;
  let lastFront;

  function rebuild(detections, frontDistance) {
    clear(group);
    if (!detections) return;
    for (const obj of detections.objects) {
      if (obj.confidence < OVERLAY_MIN_CONFIDENCE) continue;
      const color = colorForLabel(obj.label);
      const p = detectionPosition(obj, detections, frontDistance, heightAt);
      const height = 0.6 + Math.min(1, obj.bbox[3] / detections.frameHeight) * 1.1;

      const marker = new THREE.Group();
      marker.position.set(p.x, p.y, p.z);
      marker.userData.pick = {
        type: 'detection',
        label: obj.label,
        confidence: obj.confidence,
        timestamp: detections.timestamp,
        bearingDeg: Math.round((p.bearing * 180) / Math.PI),
      };

      const pillar = new THREE.Mesh(PILLAR, new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.55, transparent: true, opacity: 0.9,
      }));
      pillar.scale.y = height;
      const ring = new THREE.Mesh(RING, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
      ring.position.y = 0.02;
      const hit = new THREE.Mesh(HIT, HIT_MATERIAL);
      hit.scale.y = height + 0.4;

      const { texture, aspect } = makeLabelTexture(`${obj.label} ${Math.round(obj.confidence * 100)}%`, color);
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true }));
      label.scale.set(0.26 * aspect, 0.26, 1);
      label.position.y = height + 0.3;
      label.renderOrder = 10;

      marker.add(pillar, ring, hit, label);
      marker.userData.label = label;
      marker.userData.labelY = label.position.y;
      group.add(marker);
    }
  }

  return {
    object3d: group,
    pickRoot: group,
    update({ sensors, detections, fresh }) {
      const shown = fresh ? detections : null;
      const front = sensors?.distanceFront;
      if (shown === lastPayload && front === lastFront) return;
      lastPayload = shown;
      lastFront = front;
      rebuild(shown, front);
    },
    tick(time, dt, { reduceMotion }) {
      if (reduceMotion) return;
      for (const m of group.children) {
        m.userData.label.position.y = m.userData.labelY + 0.05 * Math.sin(time * 3 + m.position.x);
      }
    },
    dispose() {
      clear(group);
    },
  };
}
