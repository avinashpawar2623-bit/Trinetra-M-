/**
 * Detailed procedural rover (realistic field robot): rounded chassis,
 * rocker-bogie suspension, treaded wheels, pan-tilt camera mast, solar deck,
 * antenna, beacon, headlights, and clickable sensor housings.
 *
 * Exposed as a scene "system": { object3d, pickables, anchors, update, tick, dispose }.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { temperatureLevel } from '../../levels';
import { ROVER_FRONT_Z, ROVER_REAR_Z, SONAR_HEIGHT, disposeObject } from '../units';
import { createRoverMaterials, makeEmissive } from './materials';

const COLORS = {
  ok: new THREE.Color('#22c55e'),
  alert: new THREE.Color('#ef4444'),
  amber: new THREE.Color('#f59e0b'),
  off: new THREE.Color('#1f2937'),
  paint: new THREE.Color('#e8641b'),
  paintOffline: new THREE.Color('#5b4a42'),
  black: new THREE.Color('#000000'),
};
const TEMP_TINT = {
  warning: { color: new THREE.Color('#f59e0b'), intensity: 0.18 },
  danger: { color: new THREE.Color('#ef4444'), intensity: 0.35 },
};

function mesh(geometry, material, { x = 0, y = 0, z = 0, shadow = true } = {}) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = shadow;
  return m;
}

/** Box beam spanning two points (for suspension arms). */
function beam(a, b, thickness, material) {
  const len = a.distanceTo(b);
  const m = mesh(new THREE.BoxGeometry(thickness, thickness * 1.4, len), material);
  m.position.copy(a).lerp(b, 0.5);
  m.lookAt(b);
  return m;
}

function tag(object, key) {
  object.userData.pick = { type: 'sensor', key };
  return object;
}

export function buildRoverModel() {
  const mat = createRoverMaterials();
  const rover = new THREE.Group();
  rover.name = 'rover';

  // ---- Chassis ----
  const chassis = mesh(new RoundedBoxGeometry(1.4, 0.42, 2.0, 4, 0.09), mat.paint, { y: 0.78 });
  rover.add(chassis);
  rover.add(mesh(new THREE.BoxGeometry(1.2, 0.06, 1.8), mat.darkMetal, { y: 0.54 })); // skid plate
  for (const side of [-1, 1]) {
    // Grey side panel + vents + decal.
    rover.add(mesh(new THREE.BoxGeometry(0.02, 0.24, 1.3), mat.panel, { x: side * 0.705, y: 0.8 }));
    for (let i = 0; i < 4; i++) {
      rover.add(mesh(new THREE.BoxGeometry(0.025, 0.025, 0.28), mat.darkMetal, { x: side * 0.712, y: 0.74 + i * 0.04, z: 0.42 }));
    }
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), mat.decal);
    decal.position.set(side * 0.717, 0.84, -0.2);
    decal.rotation.y = side * Math.PI / 2;
    rover.add(decal);
  }

  // Bumper rails with bolts.
  const boltGeometry = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 8).rotateX(Math.PI / 2);
  for (const [z, dir] of [[ROVER_FRONT_Z + 0.06, -1], [ROVER_REAR_Z - 0.06, 1]]) {
    rover.add(mesh(new THREE.BoxGeometry(1.5, 0.14, 0.1), mat.darkMetal, { y: SONAR_HEIGHT, z }));
    for (const x of [-0.62, -0.4, 0.4, 0.62]) {
      rover.add(mesh(boltGeometry, mat.aluminum, { x, y: SONAR_HEIGHT, z: z + dir * 0.055, shadow: false }));
    }
  }

  // ---- Rocker-bogie suspension + wheels ----
  const wheelRadius = 0.26;
  const tireGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, 0.22, 40, 1).rotateZ(Math.PI / 2);
  const hubGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.24, 20).rotateZ(Math.PI / 2);
  const capGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.26, 12).rotateZ(Math.PI / 2);
  const wheels = [];
  for (const side of [-1, 1]) {
    const x = side * 0.9;
    const hubs = [-0.8, 0, 0.8].map((z) => new THREE.Vector3(x, wheelRadius, z));
    const rockerPivot = new THREE.Vector3(side * 0.8, 0.72, 0.05);
    const bogiePivot = new THREE.Vector3(x, 0.5, 0.42);
    const armX = (p) => p.clone().setX(x);

    rover.add(beam(armX(rockerPivot), armX(hubs[0]).setY(wheelRadius + 0.02), 0.07, mat.aluminum));
    rover.add(beam(armX(rockerPivot), bogiePivot, 0.07, mat.aluminum));
    rover.add(beam(bogiePivot, armX(hubs[1]).setY(wheelRadius + 0.02), 0.06, mat.aluminum));
    rover.add(beam(bogiePivot, armX(hubs[2]).setY(wheelRadius + 0.02), 0.06, mat.aluminum));
    for (const p of [rockerPivot.clone().setX(side * 0.82), bogiePivot]) {
      rover.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 16).rotateZ(Math.PI / 2), mat.darkMetal, { x: p.x, y: p.y, z: p.z }));
    }

    for (const hub of hubs) {
      const wheel = new THREE.Group();
      wheel.position.copy(hub).setX(side * 1.02);
      wheel.add(mesh(tireGeometry, mat.rubber), mesh(hubGeometry, mat.aluminum), mesh(capGeometry, mat.darkMetal));
      rover.add(wheel);
      wheels.push(wheel);
    }
  }

  // ---- Top deck ----
  const solar = new THREE.Group();
  solar.position.set(0, 1.02, 0.38);
  solar.rotation.x = -0.08;
  solar.add(mesh(new THREE.BoxGeometry(0.95, 0.035, 0.75), mat.darkMetal));
  const cells = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), mat.solar);
  cells.rotation.x = -Math.PI / 2;
  cells.position.y = 0.019;
  solar.add(cells);
  rover.add(solar);

  const antenna = new THREE.Group();
  antenna.position.set(0.55, 1.0, 0.85);
  antenna.add(mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 12), mat.darkMetal, { y: 0.03 }));
  antenna.add(mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.95, 6), mat.darkMetal, { y: 0.5 }));
  antenna.add(mesh(new THREE.SphereGeometry(0.02, 10, 8), mat.aluminum, { y: 0.98 }));
  rover.add(antenna);

  rover.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.04, 24), mat.white, { x: -0.45, y: 1.01, z: 0.88 })); // GPS puck

  // Rotating amber beacon.
  const beacon = new THREE.Group();
  beacon.position.set(-0.52, 1.0, -0.25);
  beacon.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.05, 20), mat.darkMetal, { y: 0.025 }));
  const beaconDomeMaterial = new THREE.MeshStandardMaterial({
    color: '#f59e0b', emissive: '#f59e0b', emissiveIntensity: 0.05, transparent: true, opacity: 0.75, roughness: 0.15,
  });
  beacon.add(mesh(new THREE.SphereGeometry(0.065, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), beaconDomeMaterial, { y: 0.05, shadow: false }));
  const reflector = mesh(new THREE.BoxGeometry(0.08, 0.04, 0.008), makeEmissive('#fff7d6', 0.05), { y: 0.08, shadow: false });
  beacon.add(reflector);
  const beaconLight = new THREE.PointLight('#ffb020', 0, 5, 1.6);
  beaconLight.position.y = 0.1;
  beacon.add(beaconLight);
  rover.add(beacon);

  // ---- Mast + pan-tilt camera head ----
  rover.add(mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.62, 14), mat.aluminum, { y: 1.3, z: -0.62 }));
  const head = new THREE.Group();
  head.position.set(0, 1.66, -0.62);
  head.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 16), mat.darkMetal, { y: -0.08 }));
  head.add(mesh(new RoundedBoxGeometry(0.4, 0.2, 0.26, 3, 0.04), mat.panel));
  head.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 24).rotateX(Math.PI / 2), mat.darkMetal, { z: -0.15 }));
  head.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 24).rotateX(Math.PI / 2), mat.glass, { z: -0.18, shadow: false }));
  const ledStrip = [];
  for (let i = 0; i < 3; i++) {
    const led = mesh(new THREE.BoxGeometry(0.03, 0.015, 0.01), makeEmissive('#22c55e', 2), { x: 0.09 + i * 0.035, y: 0.06, z: -0.131, shadow: false });
    head.add(led);
    ledStrip.push(led);
  }
  rover.add(head);

  // ---- Headlights ----
  const headlights = [];
  for (const x of [-0.5, 0.5]) {
    const lensPos = new THREE.Vector3(x, 0.8, ROVER_FRONT_Z + 0.02);
    rover.add(mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.08, 20).rotateX(Math.PI / 2), mat.darkMetal, { x, y: 0.8, z: ROVER_FRONT_Z + 0.06 }));
    const lensMaterial = makeEmissive('#fff3d6', 2.5);
    rover.add(mesh(new THREE.CircleGeometry(0.065, 24).rotateY(Math.PI), lensMaterial, { x, y: lensPos.y, z: lensPos.z - 0.001, shadow: false }));

    const tilt = -0.15;
    const dir = new THREE.Vector3(0, Math.sin(tilt), -Math.cos(tilt));
    const spot = new THREE.SpotLight('#fff1d0', 20, 14, 0.42, 0.7, 1.5);
    spot.position.copy(lensPos);
    spot.target.position.copy(lensPos).addScaledVector(dir, 7);
    rover.add(spot, spot.target);

    // Faint additive "volumetric" cone.
    const len = 5;
    const coneGeometry = new THREE.ConeGeometry(Math.tan(0.42) * len, len, 24, 1, true).translate(0, -len / 2, 0).rotateX(Math.PI / 2);
    const cone = new THREE.Mesh(coneGeometry, new THREE.MeshBasicMaterial({
      color: '#fff1d0', transparent: true, opacity: 0.012, blending: THREE.AdditiveBlending, depthWrite: false,
      side: THREE.FrontSide, fog: false,
    }));
    cone.position.copy(lensPos);
    cone.rotation.x = tilt;
    rover.add(cone);
    headlights.push({ spot, lensMaterial, cone });
  }

  // ---- Sensor housings (clickable) ----
  const pickables = [];

  // HC-SR04 boards on both bumpers.
  const eyeGeometry = new THREE.CylinderGeometry(0.06, 0.06, 0.06, 20).rotateX(Math.PI / 2);
  for (const [key, z, dir] of [['sonarFront', ROVER_FRONT_Z - 0.01, -1], ['sonarRear', ROVER_REAR_Z + 0.01, 1]]) {
    const board = tag(new THREE.Group(), key);
    board.position.set(0, SONAR_HEIGHT, z);
    board.add(mesh(new THREE.BoxGeometry(0.38, 0.13, 0.025), mat.pcb));
    for (const x of [-0.11, 0.11]) {
      board.add(mesh(eyeGeometry, mat.aluminum, { x, z: dir * 0.04 }));
      board.add(mesh(new THREE.CircleGeometry(0.045, 20).rotateY(dir < 0 ? Math.PI : 0), mat.mesh, { x, z: dir * 0.071, shadow: false }));
    }
    rover.add(board);
    pickables.push(board);
  }

  // MQ-2 / MQ-6 gas sensor cans with indicator rings.
  const gasRings = {};
  for (const [key, x] of [['mq2', 0.38], ['mq6', 0.58]]) {
    const can = tag(new THREE.Group(), key);
    can.position.set(x, 1.0, -0.72);
    can.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 20), mat.pcb, { y: 0.015 }));
    can.add(mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.09, 20), mat.mesh, { y: 0.075 }));
    const ringMaterial = makeEmissive('#f59e0b', 0.05);
    const ring = mesh(new THREE.TorusGeometry(0.058, 0.012, 8, 24).rotateX(Math.PI / 2), ringMaterial, { y: 0.03, shadow: false });
    can.add(ring);
    gasRings[key] = ringMaterial;
    rover.add(can);
    pickables.push(can);
  }

  // Flame sensor: small housing with an IR lens.
  const flamePod = tag(new THREE.Group(), 'flame');
  flamePod.position.set(-0.42, 1.03, ROVER_FRONT_Z + 0.22);
  flamePod.add(mesh(new RoundedBoxGeometry(0.14, 0.1, 0.12, 2, 0.02), mat.darkMetal));
  const flameLensMaterial = makeEmissive('#ef4444', 0.05);
  flamePod.add(mesh(new THREE.SphereGeometry(0.035, 16, 12), flameLensMaterial, { z: -0.065, shadow: false }));
  rover.add(flamePod);
  pickables.push(flamePod);

  // DHT11 vented box on the left side.
  const dht = tag(new THREE.Group(), 'dht');
  dht.position.set(-0.72, 0.82, 0.55);
  dht.add(mesh(new THREE.BoxGeometry(0.04, 0.16, 0.13), mat.grille));
  const dhtLedMaterial = makeEmissive('#22c55e', 1.5);
  dht.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), dhtLedMaterial, { x: -0.025, y: 0.065, shadow: false }));
  rover.add(dht);
  pickables.push(dht);

  // Status LED on the rear deck.
  const statusLedMaterial = makeEmissive('#22c55e', 2.5);
  rover.add(mesh(new THREE.SphereGeometry(0.035, 14, 10), statusLedMaterial, { x: 0.2, y: 1.01, z: 0.95, shadow: false }));

  // ---- State ----
  const state = { flame: false, gas: false, alarm: false, online: true };

  function update({ sensors, online }) {
    const s = sensors || {};
    state.flame = s.flame === true;
    state.gas = s.mq2 === true || s.mq6 === true;
    state.alarm = state.flame || state.gas;
    state.online = Boolean(online);

    if (!state.flame) flameLensMaterial.emissiveIntensity = 0.05;
    gasRings.mq2.emissiveIntensity = s.mq2 === true ? 3 : 0.05;
    gasRings.mq6.emissiveIntensity = s.mq6 === true ? 3 : 0.05;

    const statusColor = state.online ? COLORS.ok : COLORS.alert;
    statusLedMaterial.color.copy(statusColor);
    statusLedMaterial.emissive.copy(statusColor);

    const tempLevel = temperatureLevel(s.temperature ?? null);
    const dhtColor = tempLevel === 'danger' ? COLORS.alert : tempLevel === 'warning' ? COLORS.amber : COLORS.ok;
    dhtLedMaterial.color.copy(dhtColor);
    dhtLedMaterial.emissive.copy(dhtColor);

    mat.paint.color.copy(state.online ? COLORS.paint : COLORS.paintOffline);
    const tint = TEMP_TINT[tempLevel];
    mat.paint.emissive.copy(tint ? tint.color : COLORS.black);
    mat.paint.emissiveIntensity = tint ? tint.intensity : 0;

    for (const h of headlights) {
      h.spot.intensity = state.online ? 20 : 4;
      h.lensMaterial.emissiveIntensity = state.online ? 2.5 : 0.4;
      h.cone.visible = state.online;
    }
    if (!state.alarm) {
      beaconDomeMaterial.emissiveIntensity = 0.05;
      reflector.material.emissiveIntensity = 0.05;
      beaconLight.intensity = 0;
    }
  }

  function tick(time, dt, { reduceMotion }) {
    const motion = reduceMotion ? 0 : 1;
    antenna.rotation.z = motion * (Math.sin(time * 1.7) * 0.05 + Math.sin(time * 3.3) * 0.015);
    antenna.rotation.x = motion * Math.sin(time * 1.1) * 0.03;
    if (state.online) head.rotation.y = motion * Math.sin(time * 0.4) * 0.35;

    // Camera-head LEDs: chase pattern when online, solid red when offline.
    ledStrip.forEach((led, i) => {
      const on = state.online ? (reduceMotion ? true : Math.floor(time * 4) % 3 === i) : true;
      led.material.emissive.copy(state.online ? COLORS.ok : COLORS.alert);
      led.material.emissiveIntensity = on ? 3 : 0.2;
    });

    if (state.flame) {
      const pulse = reduceMotion ? 1 : 0.6 + 0.4 * Math.sin(time * 10);
      flameLensMaterial.emissiveIntensity = 4 * pulse;
    }
    if (state.alarm) {
      reflector.rotation.y += dt * (reduceMotion ? 0 : 7);
      const sweep = reduceMotion ? 1 : 0.5 + 0.5 * Math.abs(Math.sin(reflector.rotation.y));
      beaconDomeMaterial.emissiveIntensity = 1.5 + 2.5 * sweep;
      reflector.material.emissiveIntensity = 4;
      beaconLight.intensity = 3 + 5 * sweep;
    }
  }

  return {
    object3d: rover,
    pickables,
    anchors: {
      flame: new THREE.Vector3(-0.42, 1.08, ROVER_FRONT_Z + 0.16),
      deckTop: new THREE.Vector3(0, 1.05, 0.1),
    },
    update,
    tick,
    dispose: () => disposeObject(rover),
  };
}
