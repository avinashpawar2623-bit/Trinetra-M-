import { useEffect, useRef } from 'react';
import { auth } from '../../lib/firebase';

/**
 * Reads a same-origin MJPEG response and keeps only the newest complete JPEG.
 * Older bytes are discarded so a slow browser cannot build a frame backlog.
 */
export default function LatestFrameStream({ url, retryKey, onFrame, onFallback, onError }) {
  const onFrameRef = useRef(onFrame);
  const onFallbackRef = useRef(onFallback);
  const onErrorRef = useRef(onError);
  onFrameRef.current = onFrame;
  onFallbackRef.current = onFallback;
  onErrorRef.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    let objectUrl = null;

    async function run() {
      let response;
      try {
        const headers = { accept: 'multipart/x-mixed-replace, image/jpeg' };
        const user = auth?.currentUser;
        if (user) headers.authorization = `Bearer ${await user.getIdToken()}`;
        const joiner = url.includes('?') ? '&' : '?';
        response = await fetch(`${url}${joiner}_r=${retryKey}`, {
          headers,
          cache: 'no-store',
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted || stopped) return;
        if (err?.name === 'TypeError') onFallbackRef.current?.();
        else onErrorRef.current?.();
        return;
      }

      if (!response.ok || !response.body) {
        if (response.status === 401 || response.status === 403) onErrorRef.current?.();
        else onFallbackRef.current?.();
        return;
      }

      const reader = response.body.getReader();
      let buffer = new Uint8Array(0);
      try {
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer = concat(buffer, value);
          if (buffer.length > 1_500_000) buffer = trimToLastStart(buffer);
          const extracted = takeLastJpeg(buffer);
          if (!extracted) continue;
          buffer = extracted.rest;
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = URL.createObjectURL(new Blob([extracted.jpeg], { type: 'image/jpeg' }));
          onFrameRef.current?.(objectUrl, Date.now());
        }
        if (!stopped) onErrorRef.current?.();
      } catch (err) {
        if (!controller.signal.aborted && !stopped) onErrorRef.current?.();
      }
    }

    run();
    return () => {
      stopped = true;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url, retryKey]);

  return null;
}

function concat(left, right) {
  const next = new Uint8Array(left.length + right.length);
  next.set(left, 0);
  next.set(right, left.length);
  return next;
}

function takeLastJpeg(buffer) {
  let start = -1;
  let last = null;
  for (let i = 0; i < buffer.length - 1; i += 1) {
    if (buffer[i] !== 0xff) continue;
    if (buffer[i + 1] === 0xd8) start = i;
    else if (buffer[i + 1] === 0xd9 && start >= 0) {
      last = { from: start, to: i + 2 };
      start = -1;
    }
  }
  if (!last) return null;
  return {
    jpeg: buffer.slice(last.from, last.to),
    rest: buffer.slice(Math.max(last.to, start >= 0 ? start : last.to)),
  };
}

function trimToLastStart(buffer) {
  for (let i = buffer.length - 2; i >= 0; i -= 1) {
    if (buffer[i] === 0xff && buffer[i + 1] === 0xd8) return buffer.slice(i);
  }
  return new Uint8Array(0);
}
