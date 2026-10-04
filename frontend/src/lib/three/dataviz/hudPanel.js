/**
 * Floating, camera-facing telemetry panel above the rover. The canvas is
 * redrawn only when the displayed values change.
 */
import * as THREE from 'three';
import { batteryLevel, formatAge, humidityLevel, temperatureLevel } from '../../levels';

const HEX = { normal: '#34d399', warning: '#fbbf24', danger: '#f87171', unknown: '#94a3b8' };
const W = 512;
const H = 300;

function draw(ctx, v) {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(8, 12, 22, 0.82)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(6, 6, W - 12, H - 12, 22);
  ctx.fill();
  ctx.stroke();

  ctx.font = '700 30px ui-sans-serif, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = v.online ? HEX.normal : HEX.danger;
  ctx.beginPath();
  ctx.arc(40, 46, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`TRINETRA · ${v.online ? 'ONLINE' : 'OFFLINE'}`, 62, 47);

  const row = (y, label, value, level) => {
    ctx.font = '500 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(label, 32, y);
    ctx.font = '700 34px ui-monospace, Menlo, monospace';
    ctx.fillStyle = HEX[level];
    ctx.textAlign = 'right';
    ctx.fillText(value, W - 32, y);
    ctx.textAlign = 'left';
  };
  row(104, 'Temperature', v.temp === null ? '--' : `${v.temp.toFixed(1)} °C`, temperatureLevel(v.temp));
  row(152, 'Humidity', v.hum === null ? '--' : `${Math.round(v.hum)} %`, humidityLevel(v.hum));

  if (v.battery !== null) {
    const level = batteryLevel(v.battery);
    ctx.font = '500 26px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Battery', 32, 200);
    const x = 170;
    const w = W - 32 - x - 80;
    ctx.fillStyle = 'rgba(30, 41, 59, 1)';
    ctx.beginPath();
    ctx.roundRect(x, 188, w, 24, 8);
    ctx.fill();
    ctx.fillStyle = HEX[level];
    ctx.beginPath();
    ctx.roundRect(x, 188, Math.max(8, (w * Math.min(100, v.battery)) / 100), 24, 8);
    ctx.fill();
    ctx.font = '700 28px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(v.battery)}%`, W - 32, 201);
    ctx.textAlign = 'left';
  }

  ctx.font = '500 22px ui-sans-serif, system-ui, sans-serif';
  ctx.fillStyle = '#64748b';
  ctx.fillText(v.age === null ? 'Awaiting telemetry' : `Last seen ${v.age}`, 32, 256);
}

export function createHudPanel({ anchor }) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(1.7, (1.7 * H) / W, 1);
  sprite.position.copy(anchor).add(new THREE.Vector3(0, 1.45, 0));
  sprite.renderOrder = 5;

  let lastKey = '';

  return {
    object3d: sprite,
    update({ sensors, online, lastSeen, now }) {
      const s = sensors || {};
      const v = {
        online: Boolean(online),
        temp: s.temperature ?? null,
        hum: s.humidity ?? null,
        battery: s.battery ?? null,
        age: typeof lastSeen === 'number' ? formatAge(now - lastSeen) : null,
      };
      const key = JSON.stringify(v);
      if (key === lastKey) return;
      lastKey = key;
      draw(ctx, v);
      texture.needsUpdate = true;
    },
    tick(time, dt, { reduceMotion }) {
      if (!reduceMotion) sprite.position.y = anchor.y + 1.45 + Math.sin(time * 1.2) * 0.03;
    },
    dispose() {
      texture.dispose();
      sprite.material.dispose();
    },
  };
}
