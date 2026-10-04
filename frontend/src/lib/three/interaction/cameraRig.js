/**
 * Camera presets with smooth eased transitions. OrbitControls are disabled
 * while tweening and handed back afterwards.
 */
import * as THREE from 'three';

export const CAMERA_PRESETS = {
  orbit: { label: 'Orbit', position: [6.2, 4.2, 2.2], target: [0, 0.5, -1.2] },
  front: { label: 'Front', position: [2.2, 4.8, -7.6], target: [0, 0.6, -0.8] },
  top: { label: 'Top', position: [0, 10, 0.4], target: [0, 0, -0.6] },
  chase: { label: 'Chase', position: [0, 2.6, 5.4], target: [0, 0.9, -2.6] },
};

const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export function createCameraRig(camera, controls) {
  const from = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  const to = { position: new THREE.Vector3(), target: new THREE.Vector3() };
  let tween = null; // { start, duration }
  let preset = 'orbit';

  function goTo(position, target, durationMs) {
    if (durationMs <= 0) {
      camera.position.copy(position);
      controls.target.copy(target);
      camera.lookAt(target);
      controls.update();
      tween = null;
      controls.enabled = true;
      return;
    }
    from.position.copy(camera.position);
    from.target.copy(controls.target);
    to.position.copy(position);
    to.target.copy(target);
    tween = { start: performance.now(), duration: durationMs };
    controls.enabled = false;
  }

  return {
    get preset() { return preset; },
    get tweening() { return tween !== null; },

    setPreset(name, durationMs) {
      const p = CAMERA_PRESETS[name] || CAMERA_PRESETS.orbit;
      preset = CAMERA_PRESETS[name] ? name : 'orbit';
      goTo(new THREE.Vector3(...p.position), new THREE.Vector3(...p.target), durationMs);
    },

    /** Move the camera to look at `point`, keeping the current viewing direction. */
    focusOn(point, durationMs) {
      preset = 'custom';
      const target = point.clone().add(new THREE.Vector3(0, 0.6, 0));
      const dir = camera.position.clone().sub(controls.target).normalize();
      const position = target.clone().addScaledVector(dir, 3.2);
      position.y = Math.max(position.y, target.y + 0.8);
      goTo(position, target, durationMs);
    },

    /** Advance the tween; returns true while animating. */
    update(nowMs) {
      if (!tween) return false;
      const t = Math.min(1, (nowMs - tween.start) / tween.duration);
      const e = easeInOutCubic(t);
      camera.position.lerpVectors(from.position, to.position, e);
      controls.target.lerpVectors(from.target, to.target, e);
      camera.lookAt(controls.target);
      if (t >= 1) {
        tween = null;
        controls.enabled = true;
        controls.update();
      }
      return true;
    },
  };
}
