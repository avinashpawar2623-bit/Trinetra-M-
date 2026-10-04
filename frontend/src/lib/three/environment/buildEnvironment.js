/**
 * Night-time disaster site: noise-displaced terrain (flattened under the rover),
 * instanced rubble, moonlight + hemisphere lighting, fog, environment
 * reflections, and drifting dust.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ROVER3D } from '../../../config/constants';
import { createNoise2D, fbm, mulberry32, smoothstep } from '../noise';
import { makeGroundTexture, makeHazardTexture, makeParticleTexture } from '../textures';
import { disposeObject } from '../units';

const SKY = new THREE.Color('#05080f');
const TERRAIN_SIZE = 44;

export function buildEnvironment({ renderer, scene, quality }) {
  const root = new THREE.Group();
  root.name = 'environment';
  const noise = createNoise2D(42);
  const tint = createNoise2D(1337);
  const clear = ROVER3D.clearRadius;

  /** Terrain height; flat inside the clear radius so the rover sits level. */
  function heightAt(x, z) {
    const r = Math.hypot(x, z);
    const flatten = smoothstep(clear * 0.55, clear * 1.4, r);
    const h = fbm(noise, x * 0.12, z * 0.12, 4) * 1.1 + fbm(noise, x * 0.7 + 50, z * 0.7, 2) * 0.08;
    return h * flatten;
  }

  // ---- Scene atmosphere ----
  scene.background = SKY;
  scene.fog = new THREE.Fog(SKY, 10, 30);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTexture = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envTexture;
  scene.environmentIntensity = 0.18;
  room.dispose?.();
  pmrem.dispose();

  // ---- Lighting ----
  root.add(new THREE.HemisphereLight('#7f93b8', '#1a1510', 0.45));
  const moon = new THREE.DirectionalLight('#aebfe0', 0.9);
  moon.position.set(-6, 10, 4);
  moon.castShadow = quality.shadows;
  moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
  moon.shadow.bias = -0.0005;
  moon.shadow.normalBias = 0.02;
  root.add(moon);

  // ---- Terrain ----
  const segments = quality.terrainSegments;
  const terrainGeometry = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, segments, segments).rotateX(-Math.PI / 2);
  const pos = terrainGeometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dirt = new THREE.Color('#5a4a3a');
  const concrete = new THREE.Color('#6d6d6a');
  const ash = new THREE.Color('#2e2b28');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
    const t = tint(x * 0.18, z * 0.18) * 0.5 + 0.5;
    c.copy(dirt).lerp(concrete, smoothstep(0.35, 0.75, t)).lerp(ash, smoothstep(0.75, 1, 1 - t) * 0.6);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeometry.computeVertexNormals();
  const terrain = new THREE.Mesh(
    terrainGeometry,
    new THREE.MeshStandardMaterial({ vertexColors: true, map: makeGroundTexture(), roughness: 0.97, metalness: 0 }),
  );
  terrain.receiveShadow = true;
  root.add(terrain);

  // ---- Rubble ----
  const rand = mulberry32(99);
  const scatter = (minR, maxR) => {
    const a = rand() * Math.PI * 2;
    const r = minR + Math.sqrt(rand()) * (maxR - minR);
    return [Math.cos(a) * r, Math.sin(a) * r];
  };
  const dummy = new THREE.Object3D();

  const chunkCount = Math.round(160 * quality.rubbleScale);
  const chunks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(0.3, 0),
    new THREE.MeshStandardMaterial({ color: '#8a8780', roughness: 0.95, flatShading: true }),
    chunkCount,
  );
  for (let i = 0; i < chunkCount; i++) {
    const [x, z] = scatter(clear + 0.3, 17);
    const s = 0.3 + rand() ** 2 * 1.6;
    dummy.position.set(x, heightAt(x, z) + 0.05 * s, z);
    dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI);
    dummy.scale.set(s * (0.7 + rand() * 0.8), s * (0.4 + rand() * 0.5), s * (0.7 + rand() * 0.8));
    dummy.updateMatrix();
    chunks.setMatrixAt(i, dummy.matrix);
  }
  chunks.castShadow = quality.shadows;
  chunks.receiveShadow = true;
  root.add(chunks);

  const rebarCount = Math.round(36 * quality.rubbleScale);
  const rebar = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
    new THREE.MeshStandardMaterial({ color: '#6b3d24', roughness: 0.8, metalness: 0.6 }),
    rebarCount,
  );
  for (let i = 0; i < rebarCount; i++) {
    const [x, z] = scatter(clear + 0.5, 15);
    const len = 0.8 + rand() * 2;
    dummy.position.set(x, heightAt(x, z) + 0.15, z);
    dummy.rotation.set(Math.PI / 2 - 0.3 + rand() * 0.6, rand() * Math.PI, (rand() - 0.5) * 0.8);
    dummy.scale.set(1, len, 1);
    dummy.updateMatrix();
    rebar.setMatrixAt(i, dummy.matrix);
  }
  rebar.castShadow = quality.shadows;
  root.add(rebar);

  // Collapsed wall slabs + hazard barriers (a few large set pieces).
  const slabMaterial = new THREE.MeshStandardMaterial({ color: '#7c7b76', roughness: 0.92 });
  const slabs = [
    { x: -5.5, z: -4.5, w: 3.4, h: 0.25, d: 2.2, rx: 0.35, ry: 0.5, rz: 0.1 },
    { x: 6, z: 2.5, w: 2.6, h: 0.22, d: 1.8, rx: -0.25, ry: -0.8, rz: 0.2 },
    { x: 2.5, z: 7, w: 3, h: 1.6, d: 0.25, rx: 0.15, ry: 0.3, rz: -0.25 },
  ];
  for (const s of slabs) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(s.w, s.h, s.d), slabMaterial);
    slab.position.set(s.x, heightAt(s.x, s.z) + s.h / 2, s.z);
    slab.rotation.set(s.rx, s.ry, s.rz);
    slab.castShadow = quality.shadows;
    slab.receiveShadow = true;
    root.add(slab);
  }
  const hazardMaterial = new THREE.MeshStandardMaterial({ map: makeHazardTexture([3, 1]), roughness: 0.6 });
  for (const [x, z, ry] of [[-3.6, -2.2, 0.8], [3.8, -3.2, -0.6]]) {
    const barrier = new THREE.Group();
    barrier.position.set(x, heightAt(x, z), z);
    barrier.rotation.y = ry;
    barrier.add(new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.18, 0.05), hazardMaterial).translateY(0.55));
    for (const lx of [-0.6, 0.6]) {
      barrier.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.6, 0.05), slabMaterial).translateX(lx).translateY(0.3));
    }
    barrier.traverse((o) => { o.castShadow = quality.shadows; });
    root.add(barrier);
  }

  // ---- Dust ----
  const dustCount = Math.round(quality.particles * 1.4);
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPositions.set([(rand() - 0.5) * 16, 0.1 + rand() * 3.5, (rand() - 0.5) * 16], i * 3);
    dustSeeds[i] = rand() * 100;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({
    color: '#c9b79a',
    map: makeParticleTexture(),
    size: 0.05,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
    sizeAttenuation: true,
  }));
  dust.frustumCulled = false;
  root.add(dust);

  function tick(time, dt, { reduceMotion }) {
    if (reduceMotion) return;
    const p = dustGeometry.attributes.position;
    for (let i = 0; i < dustCount; i++) {
      const seed = dustSeeds[i];
      let x = p.getX(i) + (0.12 + Math.sin(time * 0.3 + seed) * 0.08) * dt;
      let y = p.getY(i) + Math.sin(time * 0.7 + seed) * 0.05 * dt;
      const z = p.getZ(i) + Math.cos(time * 0.25 + seed) * 0.06 * dt;
      if (x > 8) x = -8;
      if (y < 0.05) y = 3.5;
      p.setXYZ(i, x, y, z);
    }
    p.needsUpdate = true;
  }

  return {
    object3d: root,
    heightAt,
    tick,
    dispose() {
      disposeObject(root);
      envTexture.dispose();
      scene.environment = null;
    },
  };
}
