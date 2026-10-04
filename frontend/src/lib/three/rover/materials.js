/** Shared PBR materials for the rover. Pods/LEDs get their own instances (see model). */
import * as THREE from 'three';
import { makeDecalTexture, makeGrilleTexture, makeSolarTexture, makeTreadTexture } from '../textures';

export function createRoverMaterials() {
  const tread = makeTreadTexture();
  const solar = makeSolarTexture();
  const grille = makeGrilleTexture('#93c5fd', '#1e3a8a');
  const mesh = makeGrilleTexture('#9ca3af', '#111827');
  const decal = makeDecalTexture('TRINETRA');

  return {
    // Safety-orange powder-coated body.
    paint: new THREE.MeshStandardMaterial({ color: '#e8641b', roughness: 0.42, metalness: 0.25 }),
    panel: new THREE.MeshStandardMaterial({ color: '#4b5563', roughness: 0.55, metalness: 0.5 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: '#1f2328', roughness: 0.6, metalness: 0.7 }),
    aluminum: new THREE.MeshStandardMaterial({ color: '#c7ccd3', roughness: 0.28, metalness: 0.95 }),
    rubber: new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: tread,
      bumpMap: tread,
      bumpScale: 2.5,
      roughness: 0.95,
      metalness: 0,
    }),
    glass: new THREE.MeshStandardMaterial({ color: '#0b1220', roughness: 0.05, metalness: 1 }),
    solar: new THREE.MeshStandardMaterial({ map: solar, roughness: 0.2, metalness: 0.6 }),
    pcb: new THREE.MeshStandardMaterial({ color: '#1d4ed8', roughness: 0.6, metalness: 0.1 }),
    grille: new THREE.MeshStandardMaterial({ map: grille, roughness: 0.7 }),
    mesh: new THREE.MeshStandardMaterial({ map: mesh, roughness: 0.5, metalness: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.4 }),
    decal: new THREE.MeshStandardMaterial({ map: decal, transparent: true, roughness: 0.6, depthWrite: false }),
  };
}

/** Emissive material for LEDs / indicator lenses (intensity > 1 feeds bloom). */
export function makeEmissive(color, intensity = 0.1) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.3,
    metalness: 0.1,
  });
}
