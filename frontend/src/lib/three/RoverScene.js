/**
 * Orchestrates the 3D rover scene: renderer, optional bloom composer, camera,
 * controls, render loop, and a list of "systems". Each system may implement:
 *   object3d         added to the scene
 *   update(data)     on data change
 *   tick(t, dt, ctx) every frame; ctx = { camera, reduceMotion }
 *   resize(view)     on viewport change; view = { height, pixelRatio, fov }
 *   dispose()
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ROVER3D } from '../../config/constants';
import { buildEnvironment } from './environment/buildEnvironment';
import { buildRoverModel } from './rover/buildRoverModel';
import { createFlameEffect } from './effects/flameParticles';
import { createGasSmokeEffect } from './effects/gasSmoke';
import { createSonarBeam } from './effects/sonarPulses';
import { createHeatShimmer } from './effects/heatShimmer';
import { createHudPanel } from './dataviz/hudPanel';
import { createObstacleWalls } from './dataviz/obstacleWalls';
import { createDetectionMarkers } from './dataviz/detectionMarkers';
import { createDetectionTrails } from './dataviz/detectionTrails';
import { createCameraRig } from './interaction/cameraRig';
import { createPicker } from './interaction/picking';
import { makeParticleTexture } from './textures';

export class RoverScene {
  /**
   * @param container  element the canvas is appended to (sized by CSS)
   * @param options    { quality: QUALITY_PRESETS[x], reduceMotion: boolean }
   * Throws if WebGL is unavailable.
   */
  constructor(container, { quality, reduceMotion }) {
    this.container = container;
    this.quality = quality;
    this.reduceMotion = reduceMotion;
    this.autoRotateWanted = ROVER3D.autoRotate;
    this.online = true;
    this.running = false;
    this.frameId = 0;

    // ---- Renderer ----
    const renderer = new THREE.WebGLRenderer({
      antialias: !quality.bloom, // the composer's MSAA target handles AA when bloom is on
      powerPreference: quality.name === 'high' ? 'high-performance' : 'low-power',
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = quality.shadows;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'absolute inset-0 h-full w-full touch-none';
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    // ---- Scene, camera, controls ----
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 80);
    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 2.5;
    controls.maxDistance = 16;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.autoRotateSpeed = 0.7;
    this.controls = controls;
    this.rig = createCameraRig(this.camera, controls);
    this.picker = createPicker(this.camera);

    // ---- Systems ----
    this.particleTexture = makeParticleTexture();
    this.env = buildEnvironment({ renderer, scene: this.scene, quality });
    const { heightAt } = this.env;
    this.model = buildRoverModel();
    this.markers = createDetectionMarkers({ heightAt });

    this.systems = [
      this.env,
      this.model,
      createSonarBeam({ side: 'front' }),
      createSonarBeam({ side: 'rear' }),
      createFlameEffect({ anchor: this.model.anchors.flame, texture: this.particleTexture, quality }),
      createGasSmokeEffect({ texture: this.particleTexture, quality }),
      ...(quality.heatShader ? [createHeatShimmer({ anchor: this.model.anchors.deckTop })] : []),
      createHudPanel({ anchor: this.model.anchors.deckTop }),
      createObstacleWalls({ heightAt }),
      this.markers,
      createDetectionTrails({ heightAt }),
    ];
    for (const s of this.systems) if (s.object3d) this.scene.add(s.object3d);

    // ---- Bloom (high quality only) ----
    if (quality.bloom) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(renderer, target);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      const { strength, radius, threshold } = ROVER3D.bloom;
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), strength, radius, threshold);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    // ---- Sizing + loop ----
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.rig.setPreset('orbit', 0);
    this.applyAutoRotate();

    this.timer = new THREE.Timer();
    this.timer.connect(document);
    this.loop = this.loop.bind(this);
    this.setActive(true);
  }

  // ---- Loop ----

  loop(timestamp) {
    this.frameId = requestAnimationFrame(this.loop);
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.1);
    this.renderFrame(this.timer.getElapsed(), dt);
  }

  renderFrame(time, dt) {
    if (!this.rig.update(performance.now())) this.controls.update(dt);
    const ctx = { camera: this.camera, reduceMotion: this.reduceMotion };
    for (const s of this.systems) s.tick?.(time, dt, ctx);
    this.draw(dt);
  }

  draw(dt = 0) {
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  /** Pause rendering while off-screen / hidden; resume without a time jump. */
  setActive(active) {
    if (active === this.running) return;
    this.running = active;
    if (active) {
      this.timer.reset();
      this.frameId = requestAnimationFrame(this.loop);
    } else {
      cancelAnimationFrame(this.frameId);
    }
  }

  resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, this.quality.maxPixelRatio);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(w, h);
    }
    const view = { height: h, pixelRatio, fov: this.camera.fov };
    for (const s of this.systems) s.resize?.(view);
    if (!this.running) this.draw();
  }

  // ---- Data + settings ----

  /** data = { sensors, online, detections, fresh, lastSeen, now } */
  setData(data) {
    this.online = Boolean(data.online);
    for (const s of this.systems) s.update?.(data);
    this.applyAutoRotate();
  }

  setReduceMotion(reduceMotion) {
    this.reduceMotion = reduceMotion;
    this.applyAutoRotate();
  }

  setAutoRotate(on) {
    this.autoRotateWanted = on;
    this.applyAutoRotate();
  }

  applyAutoRotate() {
    this.controls.autoRotate =
      this.autoRotateWanted && this.online && !this.reduceMotion && this.rig.preset === 'orbit';
  }

  setPreset(name, { instant = false } = {}) {
    this.clearSelection();
    this.rig.setPreset(name, instant || this.reduceMotion ? 0 : ROVER3D.presetTweenMs);
    this.applyAutoRotate();
  }

  // ---- Interaction ----

  /**
   * Pick at a client-space point. Sensors get a highlight box; detections
   * also move the camera to focus on them. Returns the pick info or null.
   */
  pickAt(clientX, clientY) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const hit = this.picker(
      clientX - rect.left,
      clientY - rect.top,
      rect.width,
      rect.height,
      [...this.model.pickables, this.markers.pickRoot],
    );
    this.clearSelection();
    if (!hit) return null;

    this.highlight = new THREE.Box3Helper(new THREE.Box3().setFromObject(hit.object).expandByScalar(0.04), '#38bdf8');
    this.scene.add(this.highlight);

    if (hit.pick.type === 'detection') {
      this.rig.focusOn(hit.object.getWorldPosition(new THREE.Vector3()), this.reduceMotion ? 0 : ROVER3D.presetTweenMs);
      this.applyAutoRotate();
    }
    return hit.pick;
  }

  clearSelection() {
    if (!this.highlight) return;
    this.scene.remove(this.highlight);
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
    this.highlight = null;
  }

  /** Render a fresh frame and return it as a PNG data URL. */
  screenshot() {
    this.draw();
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.setActive(false);
    this.resizeObserver.disconnect();
    this.timer.dispose();
    this.controls.dispose();
    this.clearSelection();
    for (const s of this.systems) s.dispose?.();
    this.particleTexture.dispose();
    if (this.composer) {
      this.bloomPass.dispose();
      this.composer.dispose();
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
