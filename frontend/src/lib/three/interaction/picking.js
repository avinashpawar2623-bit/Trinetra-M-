/** Raycast picking against objects tagged with userData.pick. */
import * as THREE from 'three';

export function createPicker(camera) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /**
   * @param x,y    pointer position in CSS pixels relative to the canvas
   * @param roots  objects to test (searched recursively)
   * @returns { pick, object, point } for the nearest tagged hit, or null
   */
  return function pick(x, y, width, height, roots) {
    ndc.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const hit of raycaster.intersectObjects(roots, true)) {
      let obj = hit.object;
      while (obj && !obj.userData.pick) obj = obj.parent;
      if (obj) return { pick: obj.userData.pick, object: obj, point: hit.point.clone() };
    }
    return null;
  };
}
