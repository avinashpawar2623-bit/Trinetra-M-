/**
 * Shared scene geometry helpers. Scene units are ~meters; the rover faces -Z.
 */
import { DISTANCE_MAX_CM, ROVER3D } from '../../config/constants';

export const ROVER_FRONT_Z = -1.12;
export const ROVER_REAR_Z = 1.12;
export const SONAR_HEIGHT = 0.62;
/** HC-SR04 beam is roughly a 15° half-angle cone. */
export const BEAM_SPREAD = Math.tan((15 * Math.PI) / 180);

/** Distance reading (cm) to scene length, capped at DISTANCE_MAX_CM. */
export function distanceToUnits(cm) {
  return (Math.min(Math.max(cm, 0), DISTANCE_MAX_CM) / DISTANCE_MAX_CM) * ROVER3D.coneMaxLength;
}

/**
 * Ground position for a detected object.
 * Bearing comes from the bbox center across the camera FOV; range from the
 * front ultrasonic reading when valid (the camera alone gives no depth).
 */
export function detectionPosition(obj, detections, frontDistance, heightAt) {
  const [x, , w] = obj.bbox;
  const fovRad = (ROVER3D.cameraFovDeg * Math.PI) / 180;
  const bearing = ((x + w / 2) / detections.frameWidth - 0.5) * fovRad;
  const range = typeof frontDistance === 'number'
    ? Math.max(0.6, distanceToUnits(frontDistance))
    : ROVER3D.defaultMarkerRange;
  const px = Math.sin(bearing) * range;
  const pz = ROVER_FRONT_Z - Math.cos(bearing) * range;
  return { x: px, y: heightAt(px, pz), z: pz, bearing };
}

/** Free geometry/material/texture of every mesh under `root`, skipping shared resources. */
export function disposeObject(root, shared = new Set()) {
  root.traverse((obj) => {
    if (obj.geometry && !shared.has(obj.geometry)) obj.geometry.dispose();
    const materials = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of materials) {
      if (shared.has(m)) continue;
      for (const key of ['map', 'bumpMap', 'emissiveMap', 'alphaMap', 'roughnessMap']) {
        if (m[key] && !shared.has(m[key])) m[key].dispose();
      }
      m.uniforms?.uMap?.value?.dispose?.();
      m.dispose();
    }
  });
}
