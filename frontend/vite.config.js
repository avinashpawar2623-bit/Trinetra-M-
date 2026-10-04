import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// In dev, /api is proxied to the Express backend so the camera proxy
// (/api/camera/stream) behaves the same as in production.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // The Firebase SDK alone is ~500 kB minified; that is expected.
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
