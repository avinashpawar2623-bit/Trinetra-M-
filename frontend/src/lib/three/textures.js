/**
 * Procedural CanvasTextures (no image assets). Each factory returns a new
 * texture; callers own it and must dispose() it.
 */
import * as THREE from 'three';
import { mulberry32 } from './noise';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { color = true, repeat } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (color) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  tex.anisotropy = 4;
  return tex;
}

/** Tire tread: chevron lugs around the circumference (u wraps around the tire). */
export function makeTreadTexture() {
  const [c, ctx] = canvas(512, 64);
  ctx.fillStyle = '#1b1d21';
  ctx.fillRect(0, 0, 512, 64);
  ctx.fillStyle = '#3a3d44';
  for (let i = 0; i < 24; i++) {
    const x = i * (512 / 24);
    ctx.beginPath();
    ctx.moveTo(x, 4);
    ctx.lineTo(x + 10, 32);
    ctx.lineTo(x, 60);
    ctx.lineTo(x + 8, 60);
    ctx.lineTo(x + 18, 32);
    ctx.lineTo(x + 8, 4);
    ctx.closePath();
    ctx.fill();
  }
  return finish(c);
}

/** Solar panel: dark blue cells with silver bus lines. */
export function makeSolarTexture() {
  const [c, ctx] = canvas(256, 256);
  ctx.fillStyle = '#0b1a3a';
  ctx.fillRect(0, 0, 256, 256);
  const cell = 256 / 6;
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 6; x++) {
      const g = ctx.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
      g.addColorStop(0, '#1d3b7a');
      g.addColorStop(1, '#0f2350');
      ctx.fillStyle = g;
      ctx.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
    }
  }
  ctx.strokeStyle = 'rgba(200,210,230,0.5)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(256, i * cell);
    ctx.stroke();
  }
  return finish(c);
}

/** Yellow/black diagonal hazard stripes. */
export function makeHazardTexture(repeat = [1, 1]) {
  const [c, ctx] = canvas(128, 128);
  ctx.fillStyle = '#facc15';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#111827';
  for (let i = -128; i < 256; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + 16, 0);
    ctx.lineTo(i + 16 + 128, 128);
    ctx.lineTo(i + 128, 128);
    ctx.closePath();
    ctx.fill();
  }
  return finish(c, { repeat });
}

/** Soft round particle sprite (alpha falloff). */
export function makeParticleTexture() {
  const [c, ctx] = canvas(64, 64);
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return finish(c, { color: false });
}

/** Gritty grayscale detail map, multiplied with terrain vertex colors. */
export function makeGroundTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = mulberry32(7);
  ctx.fillStyle = '#9a9a9a';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 6000; i++) {
    const v = 110 + Math.floor(rand() * 120);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    const s = rand() < 0.9 ? 1 : 2 + rand() * 3;
    ctx.fillRect(rand() * 256, rand() * 256, s, s);
  }
  // Cracks.
  ctx.strokeStyle = 'rgba(40,40,40,0.5)';
  for (let i = 0; i < 14; i++) {
    let x = rand() * 256;
    let y = rand() * 256;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 6; k++) {
      x += (rand() - 0.5) * 40;
      y += (rand() - 0.5) * 40;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finish(c, { repeat: [10, 10] });
}

/** Ventilation grille for the DHT11 / MQ housings. */
export function makeGrilleTexture(bg = '#e5e7eb', hole = '#1f2937') {
  const [c, ctx] = canvas(64, 64);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = hole;
  for (let y = 4; y < 64; y += 8) {
    for (let x = 4; x < 64; x += 8) ctx.fillRect(x, y, 4, 4);
  }
  return finish(c);
}

/** Stenciled side decal (transparent background). */
export function makeDecalTexture(text) {
  const [c, ctx] = canvas(512, 128);
  ctx.clearRect(0, 0, 512, 128);
  ctx.fillStyle = 'rgba(17,24,39,0.85)';
  ctx.font = '900 72px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '10px';
  ctx.fillText(text, 256, 68);
  return finish(c);
}

/** Text label drawn on a rounded pill; returns { texture, aspect }. */
export function makeLabelTexture(text, background, { font = '600 30px', height = 64 } = {}) {
  const measure = canvas(1, 1)[1];
  measure.font = `${font} ui-sans-serif, system-ui, sans-serif`;
  const width = Math.ceil(measure.measureText(text).width) + 40;
  const [c, ctx] = canvas(width, height);
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.roundRect(2, 6, width - 4, height - 12, 14);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = measure.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 1);
  return { texture: finish(c), aspect: width / height };
}
