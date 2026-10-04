/**
 * Translucent hazard-striped wall at the measured front/rear obstacle
 * distance, with a distance label. Hidden for "no echo" or missing data.
 */
import * as THREE from 'three';
import { NO_ECHO } from '../../../config/constants';
import { distanceLevel } from '../../levels';
import { makeHazardTexture, makeLabelTexture } from '../textures';
import { ROVER_FRONT_Z, ROVER_REAR_Z, distanceToUnits } from '../units';

const LEVEL_HEX = { normal: '#16a34a', warning: '#d97706', danger: '#dc2626', unknown: '#475569' };

export function createObstacleWalls({ heightAt }) {
  const group = new THREE.Group();
  const stripes = makeHazardTexture([5, 2]);
  const wallGeometry = new THREE.PlaneGeometry(2.6, 1.1).translate(0, 0.55, 0);

  const walls = ['front', 'rear'].map((side) => {
    const dir = side === 'front' ? -1 : 1;
    const wall = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({
      map: stripes, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false,
    });
    wall.add(new THREE.Mesh(wallGeometry, material));
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
    label.position.y = 1.35;
    label.renderOrder = 8;
    wall.add(label);
    wall.visible = false;
    group.add(wall);
    return {
      wall, label, material, dir,
      key: side === 'front' ? 'distanceFront' : 'distanceRear',
      originZ: side === 'front' ? ROVER_FRONT_Z : ROVER_REAR_Z,
      lastText: '',
    };
  });

  return {
    object3d: group,
    update({ sensors }) {
      for (const w of walls) {
        const value = sensors?.[w.key];
        if (typeof value !== 'number' || value === NO_ECHO) {
          w.wall.visible = false;
          continue;
        }
        const z = w.originZ + w.dir * (0.08 + distanceToUnits(value));
        w.wall.visible = true;
        w.wall.position.set(0, heightAt(0, z), z);
        const level = distanceLevel(value);
        w.material.color.set(level === 'danger' ? '#ffb4b4' : '#ffffff');

        const text = `${Math.round(value)} cm`;
        if (text !== w.lastText) {
          w.lastText = text;
          w.label.material.map?.dispose();
          const { texture, aspect } = makeLabelTexture(text, LEVEL_HEX[level]);
          w.label.material.map = texture;
          w.label.material.needsUpdate = true;
          w.label.scale.set(0.3 * aspect, 0.3, 1);
        }
      }
    },
    dispose() {
      stripes.dispose();
      wallGeometry.dispose();
      for (const w of walls) {
        w.material.dispose();
        w.label.material.map?.dispose();
        w.label.material.dispose();
      }
    },
  };
}
