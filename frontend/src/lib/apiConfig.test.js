import test from 'node:test';
import assert from 'node:assert/strict';

import { buildPiConfig, resolveApiUrl } from './apiConfig.js';

test('resolveApiUrl keeps a backend base URL explicit and strips duplicate slashes', () => {
  assert.equal(resolveApiUrl('/api/health', 'https://backend.example.com/'), 'https://backend.example.com/api/health');
  assert.equal(resolveApiUrl('camera/stream', 'https://backend.example.com'), 'https://backend.example.com/camera/stream');
  assert.equal(resolveApiUrl('health', ''), '/health');
});

test('buildPiConfig does not default to a stale Tailscale host when no host is configured', () => {
  const config = buildPiConfig({ host: '', port: '' });
  assert.equal(config.baseUrl, '');
  assert.equal(config.wsUrl, '');
  assert.equal(config.streamUrl, '');
});

test('buildPiConfig builds LAN URLs when a host and port are provided', () => {
  const config = buildPiConfig({ host: '192.168.1.50', port: '8000' });
  assert.equal(config.baseUrl, 'http://192.168.1.50:8000');
  assert.equal(config.wsUrl, 'ws://192.168.1.50:8000/ws');
  assert.equal(config.streamUrl, 'http://192.168.1.50:8000/stream');
});
